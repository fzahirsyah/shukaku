import { tutorialPuzzle } from '../js/data/fixtures.js';
import { classicLevels } from '../js/data/classic-levels.js';
import { validatePuzzle,validateRectangle,isComplete } from '../js/engine/validator.js';
import { createSession,applyMove,setPaused } from '../js/engine/moves.js';
import { countSolutions } from './content-verifier.js';
export function runTests(){
  const results=[];
  function test(name,body){try{body();results.push({name,pass:true});}catch(error){results.push({name,pass:false,error:error.message});}}
  function equal(actual,expected){if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);}
  const p=tutorialPuzzle;
  const validate=(rect,regions=[])=>validateRectangle(p,regions,rect);
  test('VAL-01 accepts 2×3 clue 6',()=>equal(validate(p.solution[2]).code,'OK'));
  test('VAL-02 rejects incorrect area',()=>equal(validate({row:0,col:0,height:1,width:2}).code,'WRONG_AREA'));
  test('VAL-03 rejects zero clues',()=>equal(validate({row:2,col:0,height:1,width:1}).code,'NO_CLUE'));
  test('VAL-04 rejects multiple clues',()=>equal(validate({row:0,col:0,height:2,width:3}).code,'MULTIPLE_CLUES'));
  test('VAL-05 rejects out of bounds',()=>equal(validate({row:-1,col:0,height:1,width:1}).code,'OUT_OF_BOUNDS'));
  test('VAL-06 rejects overlap',()=>equal(validate(p.solution[2],[p.solution[2]]).code,'OVERLAP'));
  test('VAL-07 invalid replacement preserves exact state',()=>{
    let s=applyMove(p,createSession(p),{type:'PLACE',rectangle:p.solution[0]}).session;
    const before=JSON.stringify(s),result=applyMove(p,s,{type:'REPLACE',clueId:p.clues[0].id,rectangle:{row:0,col:0,height:2,width:3}});
    equal(result.ok,false);equal(JSON.stringify(result.session),before);
  });
  test('Dimension and structure guards',()=>{
    equal(validate({row:0,col:0,height:0,width:1}).code,'BAD_DIMENSIONS');
    equal(validate({row:0,col:0,height:1.2,width:1}).code,'BAD_DIMENSIONS');
    equal(validatePuzzle({...p,clues:p.clues.slice(1)}),false);
    equal(validatePuzzle({...p,clues:[...p.clues,{...p.clues[0]}]}),false);
  });
  test('WIN-01 complete once and lock all further moves',()=>{
    let s=createSession(p),completions=0;
    for(const rectangle of p.solution){const result=applyMove(p,s,{type:'PLACE',rectangle});s=result.session;if(result.completed)completions++;}
    equal(isComplete(p,s.rectangles),true);equal(s.status,'COMPLETED');equal(completions,1);
    equal(applyMove(p,s,{type:'REMOVE',clueId:p.clues[0].id}).code,'SESSION_LOCKED');equal(s.completionCount,1);
  });
  test('WIN-02 uncovered and duplicate regions do not complete',()=>{
    equal(isComplete(p,p.solution.slice(0,-1)),false);
    equal(isComplete(p,[...p.solution.slice(0,-1),p.solution[0]]),false);
  });
  test('UNDO-01 place → undo → redo is exact',()=>{
    let s=applyMove(p,createSession(p),{type:'PLACE',rectangle:p.solution[0]}).session;
    const board=JSON.stringify(s.rectangles);s=applyMove(p,s,{type:'UNDO'}).session;equal(s.rectangles,[]);
    s=applyMove(p,s,{type:'REDO'}).session;equal(JSON.stringify(s.rectangles),board);
  });
  test('UNDO-02 new command clears redo',()=>{
    let s=applyMove(p,createSession(p),{type:'PLACE',rectangle:p.solution[0]}).session;
    s=applyMove(p,s,{type:'UNDO'}).session;s=applyMove(p,s,{type:'PLACE',rectangle:p.solution[1]}).session;equal(s.redoStack.length,0);
  });
  test('Local validity does not compare hidden solution',()=>{
    // The horizontal clue-2 region is locally valid, but the unique answer uses a vertical one.
    equal(validate({row:1,col:0,height:1,width:2}).ok,true);
  });
  test('Duplicate pointer token cannot double commit',()=>{
    let s=applyMove(p,createSession(p),{type:'PLACE',rectangle:p.solution[0],token:'once'}).session;
    const r=applyMove(p,s,{type:'PLACE',rectangle:p.solution[1],token:'once'});equal(r.code,'DUPLICATE');equal(r.session.rectangles.length,1);
  });
  test('Remove, restart and undo are reversible',()=>{
    let s=applyMove(p,createSession(p),{type:'PLACE',rectangle:p.solution[0]}).session;
    s=applyMove(p,s,{type:'REMOVE',clueId:p.clues[0].id}).session;equal(s.rectangles.length,0);
    s=applyMove(p,s,{type:'UNDO'}).session;equal(s.rectangles.length,1);
    s=applyMove(p,s,{type:'RESTART'}).session;equal(s.rectangles.length,0);
    s=applyMove(p,s,{type:'UNDO'}).session;equal(s.rectangles.length,1);
  });
  test('Replacement is atomic, undo restores original',()=>{
    const q={id:'replace',rows:2,cols:2,clues:[{id:'a',row:0,col:0,value:2},{id:'b',row:1,col:1,value:2}]};
    let s=applyMove(q,createSession(q),{type:'PLACE',rectangle:{row:0,col:0,height:1,width:2}}).session;
    const before=s.rectangles;s=applyMove(q,s,{type:'REPLACE',clueId:'a',rectangle:{row:0,col:0,height:2,width:1}}).session;
    equal(s.rectangles.length,1);equal(s.rectangles[0].height,2);s=applyMove(q,s,{type:'UNDO'}).session;equal(s.rectangles,before);
  });
  test('History restore of full coverage also locks completion',()=>{const s=createSession(p);s.redoStack=[{type:'PLACE',before:[],after:p.solution}];const result=applyMove(p,s,{type:'REDO'});equal(result.completed,true);equal(result.session.status,'COMPLETED');});
  test('Paused sessions reject input',()=>equal(applyMove(p,setPaused(createSession(p),true),{type:'PLACE',rectangle:p.solution[0]}).code,'SESSION_LOCKED'));
  test('History is bounded at 100 commands',()=>{
    let s=createSession(p);for(let i=0;i<120;i++){s=applyMove(p,s,{type:'PLACE',rectangle:p.solution[0]}).session;s=applyMove(p,s,{type:'REMOVE',clueId:p.clues[0].id}).session;}equal(s.undoStack.length,100);
  });
  test('Verifier distinguishes ambiguous, unsolvable and unique',()=>{
    equal(countSolutions({rows:2,cols:2,clues:[{id:'a',row:0,col:0,value:2},{id:'b',row:1,col:1,value:2}]}),2);
    equal(countSolutions({rows:2,cols:2,clues:[{id:'a',row:0,col:0,value:3}]}),0);
    equal(countSolutions(p),1);
  });
  for(const level of [p,...classicLevels])test(`CONTENT ${level.id}: unique and valid canonical partition`,()=>{equal(validatePuzzle(level),true);equal(countSolutions(level),1);equal(isComplete(level,level.solution),true);});
  return results;
}
