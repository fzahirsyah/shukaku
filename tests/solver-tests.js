import {solvePuzzle,solveSteps,drain,rectangleKey} from '../js/engine/solver.js';
import {analyzeBoard} from '../js/engine/hint-engine.js';
import {validateRectangle,isComplete} from '../js/engine/validator.js';
import {createSession,applyMove} from '../js/engine/moves.js';
import {tutorialPuzzle} from '../js/data/fixtures.js';
import {classicLevels} from '../js/data/classic-levels.js';
import {zenFallbackLevels} from '../js/data/zen-fallback-levels.js';
import {countSolutions} from './content-verifier.js';
const ambiguous={id:'ambiguous',rows:2,cols:2,clues:[{id:'a',row:0,col:0,value:2},{id:'b',row:1,col:1,value:2}]};
const unsolvable={id:'unsolvable',rows:2,cols:2,clues:[{id:'a',row:0,col:0,value:3},{id:'b',row:1,col:1,value:1}]};
export function runSolverTests(){
 const results=[];const equal=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);};
 function test(name,body){try{body();results.push({name,pass:true});}catch(error){results.push({name,pass:false,error:error.message});}}
 test('SOL-01 tutorial uniquely solved without stored solution',()=>{const result=solvePuzzle({...tutorialPuzzle,solution:[]});equal(result.status,'UNIQUE');equal(result.count,1);equal(isComplete(tutorialPuzzle,result.solution),true);});
 test('SOL-02 structurally valid unsolvable puzzle',()=>equal(solvePuzzle(unsolvable).status,'UNSOLVABLE'));
 test('SOL-03 ambiguous puzzle stops at two completions',()=>{const result=solvePuzzle(ambiguous);equal(result.status,'MULTIPLE');equal(result.count,2);});
 test('SOL-04 node/work/time budgets never imply uniqueness',()=>{for(const options of [{maxNodes:0},{maxWork:0},{maxMs:0}]){const result=solvePuzzle(tutorialPuzzle,[],options);equal(result.status,'UNKNOWN');equal(result.count,0);}});
 test('SOL-09 one found solution under interruption is never called unique',()=>{const result=solvePuzzle(ambiguous,[],{maxNodes:3});equal(result.status,'UNKNOWN');equal(result.count,1);equal(analyzeBoard(ambiguous,[],{kind:'check',maxNodes:3}).status,'CONSISTENT');equal(analyzeBoard(ambiguous,[],{strength:'reveal',maxNodes:3}).status,'UNAVAILABLE');});
 test('SOL-05 cooperative cancellation',()=>{let cancelled=false;const many={rows:12,cols:12,clues:Array.from({length:144},(_,i)=>({id:'c'+i,row:Math.floor(i/12),col:i%12,value:1}))};const iterator=solveSteps(many,[],{isCancelled:()=>cancelled});equal(iterator.next().done,false);cancelled=true;const result=drain(iterator);equal(result.status,'UNKNOWN');equal(result.reason,'CANCELLED');});
 test('SOL-06 fixed rectangles and forbidden alternatives',()=>{const fixed=tutorialPuzzle.solution.slice(0,2);const result=solvePuzzle(tutorialPuzzle,fixed);equal(result.status,'UNIQUE');for(const rectangle of fixed)equal(result.solution.some(r=>rectangleKey(r)===rectangleKey(rectangle)),true);equal(solvePuzzle(tutorialPuzzle,[],{forbiddenRectangle:tutorialPuzzle.solution[0]}).status,'UNSOLVABLE');});
 test('SOL-07 invalid position and bad clue sum rejected',()=>{equal(solvePuzzle(tutorialPuzzle,[{...tutorialPuzzle.solution[0],width:1}]).status,'UNSOLVABLE');equal(solvePuzzle({...tutorialPuzzle,clues:tutorialPuzzle.clues.slice(1)}).status,'UNSOLVABLE');});
 test('SOL-08 exhaustive 2×3 clue layouts agree with independent verifier',()=>{
   let tested=0;const cells=6;
   function compositions(total,count,prefix=[]){if(count===1)return [[...prefix,total]];const result=[];for(let n=1;n<=total-count+1;n++)result.push(...compositions(total-n,count-1,[...prefix,n]));return result;}
   for(let mask=1;mask<(1<<cells);mask++){
     const positions=Array.from({length:cells},(_,i)=>i).filter(i=>mask&(1<<i));
     for(const values of compositions(cells,positions.length)){
       const puzzle={rows:2,cols:3,clues:positions.map((cell,i)=>({id:'c'+i,row:Math.floor(cell/3),col:cell%3,value:values[i]}))};
       const expected=countSolutions(puzzle),result=solvePuzzle(puzzle);equal(result.count,expected);equal(result.status,expected===0?'UNSOLVABLE':expected===1?'UNIQUE':'MULTIPLE');if(result.solution)equal(isComplete(puzzle,result.solution),true);tested++;
     }
   }
   equal(tested,462);
 });
 test('HINT-01 nudge/explain do not mutate a board',()=>{const fixed=[];const before=JSON.stringify(fixed);for(const strength of ['nudge','explain']){const hint=analyzeBoard(tutorialPuzzle,fixed,{strength});equal(hint.status,'READY');equal(hint.rectangle,null);equal(hint.clueId,'t4-0');equal(hint.proof,'SINGLE_CANDIDATE');}equal(JSON.stringify(fixed),before);});
 test('HINT-02 reveal is valid and forced, not copied from stored answer',()=>{const puzzle={...tutorialPuzzle,solution:[]},hint=analyzeBoard(puzzle,[],{strength:'reveal'});equal(hint.status,'READY');equal(validateRectangle(puzzle,[],hint.rectangle).ok,true);equal(solvePuzzle(puzzle,[],{forbiddenRectangle:hint.rectangle}).status,'UNSOLVABLE');});
 test('HINT-03 contradiction preserves rectangles and never reveals',()=>{const wrong={clueId:'t4-1',row:1,col:0,height:1,width:2};equal(validateRectangle(tutorialPuzzle,[],wrong).ok,true);const fixed=[wrong],before=JSON.stringify(fixed),hint=analyzeBoard(tutorialPuzzle,fixed,{strength:'reveal'});equal(hint.status,'CONTRADICTION');equal(hint.clueId,wrong.clueId);equal(hint.rectangle,undefined);equal(JSON.stringify(fixed),before);});
 test('HINT-04 consistent Check does not promise the answer is unique',()=>{const result=analyzeBoard(ambiguous,[],{kind:'check'});equal(result.status,'CONSISTENT');});
 test('HINT-05 ambiguous choices cannot reveal an unproven rectangle',()=>{equal(analyzeBoard(ambiguous,[],{strength:'reveal'}).status,'UNAVAILABLE');});
 test('HINT-06 timeout/cancel/invalid puzzle stay honest',()=>{equal(analyzeBoard(tutorialPuzzle,[],{maxNodes:0}).status,'UNAVAILABLE');equal(analyzeBoard(tutorialPuzzle,[],{isCancelled:()=>true}).reason,'CANCELLED');equal(analyzeBoard(unsolvable,[],{strength:'reveal'}).status,'UNAVAILABLE');});
 test('HINT-07 completed board needs no hint',()=>equal(analyzeBoard(tutorialPuzzle,tutorialPuzzle.solution).status,'COMPLETE'));
 test('HINT-08 repeated reveal can finish all shipped levels without contradiction',()=>{
   for(const puzzle of classicLevels){let state=createSession(puzzle),steps=0;while(state.status!=='COMPLETED'&&steps++<puzzle.clues.length){const hint=analyzeBoard(puzzle,state.rectangles,{strength:'reveal'});equal(hint.status,'READY');const result=applyMove(puzzle,state,{type:'PLACE',rectangle:hint.rectangle});equal(result.ok,true);state=result.session;}equal(state.status,'COMPLETED');}
 });
 for(const puzzle of [tutorialPuzzle,...classicLevels,...zenFallbackLevels])test(`VERIFY ${puzzle.id}: runtime and independent counters agree`,()=>{const result=solvePuzzle(puzzle);equal(countSolutions(puzzle),1);equal(result.status,'UNIQUE');equal(isComplete(puzzle,result.solution),true);});
 return results;
}
export async function runWorkerTests(){
 const results=[];function equal(a,b){if(a!==b)throw Error(`Expected ${b}, got ${a}`);}
 async function test(name,body){try{await body();results.push({name,pass:true});}catch(error){results.push({name,pass:false,error:error.message});}}
 const {PuzzleService,CancelledError}=await import('../js/state/puzzle-service.js');
 await test('WORKER-01 actual worker solves and explains',async()=>{const service=new PuzzleService();try{equal((await service.request('solve',{puzzle:tutorialPuzzle})).status,'UNIQUE');equal((await service.request('hint',{puzzle:tutorialPuzzle,strength:'explain'})).status,'READY');}finally{service.close();}});
 await test('WORKER-02 interrupted search reports UNKNOWN',async()=>{const service=new PuzzleService();try{const result=await service.request('solve',{puzzle:tutorialPuzzle,budget:{maxNodes:0}});equal(result.status,'UNKNOWN');}finally{service.close();}});
 await test('WORKER-03 cancel rejects stale request, next request works',async()=>{const service=new PuzzleService();try{const promise=service.request('solve',{puzzle:tutorialPuzzle}).catch(error=>error);service.cancel();equal((await promise) instanceof CancelledError,true);equal((await service.request('check',{puzzle:tutorialPuzzle})).status,'CONSISTENT');}finally{service.close();}});
 await test('WORKER-04 unsupported worker returns safe unavailable',async()=>{const service=new PuzzleService({workerFactory:()=>{throw Error('No workers');}});equal((await service.request('hint',{puzzle:tutorialPuzzle})).reason,'WORKER_UNAVAILABLE');service.close();});
 await test('WORKER-05 hard deadline terminates stalled worker',async()=>{let terminated=false;const service=new PuzzleService({workerFactory:()=>({postMessage(){},terminate(){terminated=true;}}),deadlineMs:10});const result=await service.request('hint',{puzzle:tutorialPuzzle});equal(result.reason,'DEADLINE');equal(terminated,true);service.close();});
 await test('WORKER-06 late messages cannot resolve a newer request',async()=>{let fake;const service=new PuzzleService({workerFactory:()=>fake={postMessage(){},terminate(){}},deadlineMs:1000});const stale=service.request('hint',{}).catch(error=>error);service.cancel();const next=service.request('check',{});fake.onmessage({data:{id:'analysis-1',result:{status:'READY'}}});fake.onmessage({data:{id:'analysis-2',result:{status:'CONSISTENT'}}});equal((await stale) instanceof CancelledError,true);equal((await next).status,'CONSISTENT');service.close();});
 await test('WORKER-07 failure resolves safely and allows a fresh worker',async()=>{let fake;const service=new PuzzleService({workerFactory:()=>fake={postMessage(){},terminate(){}},deadlineMs:1000});const first=service.request('hint',{});fake.onerror({preventDefault(){}});equal((await first).reason,'WORKER_UNAVAILABLE');const next=service.request('check',{});fake.onmessage({data:{id:'analysis-2',result:{status:'CONSISTENT'}}});equal((await next).status,'CONSISTENT');service.close();});
 await test('WORKER-08 cooperative worker cancellation keeps main thread responsive',async()=>{const worker=new Worker(new URL('../js/workers/puzzle-worker.js',import.meta.url),{type:'module'});let ticks=0;const interval=setInterval(()=>ticks++,5);try{const puzzle={rows:30,cols:30,clues:Array.from({length:900},(_,i)=>({id:'c'+i,row:Math.floor(i/30),col:i%30,value:1}))};const result=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Worker did not cancel')),4000);worker.onmessage=event=>{clearTimeout(timeout);resolve(event.data.result);};worker.onerror=reject;worker.postMessage({id:'cancel-me',type:'solve',puzzle,budget:{maxMs:3000,maxWork:3000000}});setTimeout(()=>worker.postMessage({id:'cancel-me',type:'cancel'}),20);});equal(result.status,'UNKNOWN');equal(result.reason,'CANCELLED');equal(ticks>0,true);}finally{clearInterval(interval);worker.terminate();}});
 return results;
}
