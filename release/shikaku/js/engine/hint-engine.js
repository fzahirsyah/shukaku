import {isComplete,validatePuzzle} from './validator.js';
import {searchBudget,pulse,candidateSteps,solveSteps,maskFor,rectangleKey,limitReason,drain} from './solver.js';
const unavailable=reason=>({status:'UNAVAILABLE',reason,title:'A little more room to think',message:reason==='NO_FORCED_MOVE'?'More than one completion is possible, and no guaranteed next rectangle was found. Try a choice of your own.':'Hint is unavailable for this position. You can try again, undo a move, or revisit How to Play.'});
function hasSolution(result){return result.count>0;}
export function* analyzeSteps(puzzle,rectangles=[],{kind='hint',strength='nudge',...options}={}){
  const budget=searchBudget(options);
  try{
    if(!validatePuzzle(puzzle))return unavailable('INVALID_PUZZLE');
    if(isComplete(puzzle,rectangles))return{status:'COMPLETE',title:'Every shape is home',message:'The board is already complete.'};
    const result=yield* solveSteps(puzzle,rectangles,{},budget);
    if(result.status==='UNSOLVABLE'){
      if(!rectangles.length)return unavailable('PUZZLE_UNSOLVABLE');
      const original=yield* solveSteps(puzzle,[],{},budget);
      if(!hasSolution(original))return unavailable(original.status==='UNKNOWN'?original.reason:'PUZZLE_UNSOLVABLE');
      let clueId=null;
      for(let index=rectangles.length-1;index>=0;index--){
        const relaxed=yield* solveSteps(puzzle,rectangles.filter((_,i)=>i!==index),{},budget);
        if(hasSolution(relaxed)){clueId=rectangles[index].clueId;break;}
        if(relaxed.status==='UNKNOWN')break;
      }
      return{status:'CONTRADICTION',title:'A shape needs another look',message:clueId?'These choices leave no complete solution. Removing the highlighted rectangle makes a completion possible; review that choice.':'These choices leave no complete solution. One or more earlier rectangles need reconsidering. Try undoing a move.',clueId};
    }
    if(!hasSolution(result))return unavailable(result.reason||'UNKNOWN');
    if(kind==='check')return{status:'CONSISTENT',title:'There is still a way through',message:'At least one complete solution remains for your rectangles. Keep finding the shapes.'};
    if(!['nudge','explain','reveal'].includes(strength))return unavailable('INVALID_STRENGTH');
    const assigned=new Set(rectangles.map(r=>r.clueId));let occupied=0n;for(const rect of rectangles)occupied|=maskFor(rect,puzzle);
    const all=yield* candidateSteps(puzzle,budget),remaining=[];
    for(let i=0;i<all.length;i++){
      if(assigned.has(puzzle.clues[i].id))continue;const list=[];
      for(const candidate of all[i]){yield* pulse(budget);if(!(candidate.mask&occupied))list.push(candidate);}
      remaining.push({clue:puzzle.clues[i],candidates:list,total:all[i].length});
    }
    let forced=null,proof=null,detail=null;
    const single=remaining.find(entry=>entry.candidates.length===1);
    if(single){forced=single.candidates[0].rectangle;proof='SINGLE_CANDIDATE';detail=single.total>1?'Every other rectangle for this clue would overlap a placed region.':'Within the board, only this rectangle can contain that clue alone.';}
    if(!forced){
      for(let cell=0;cell<puzzle.rows*puzzle.cols;cell++){
        const bit=1n<<BigInt(cell);if(occupied&bit)continue;let only=null,count=0;
        for(const entry of remaining)for(const candidate of entry.candidates){yield* pulse(budget);if(candidate.mask&bit){only=candidate;count++;}}
        if(count===1){forced=only.rectangle;proof='SOLE_COVER';detail=`Cell at row ${Math.floor(cell/puzzle.cols)+1}, column ${cell%puzzle.cols+1} can only be covered by this rectangle.`;break;}
      }
    }
    if(!forced){
      const order=[...remaining].sort((a,b)=>a.candidates.length-b.candidates.length);
      for(const entry of order){
        const candidate=result.solution.find(r=>r.clueId===entry.clue.id);if(!candidate)continue;
        if(result.status==='UNIQUE'){forced=candidate;proof='SEARCH_PROOF';detail='A complete search of the remaining possibilities proves this rectangle is forced.';break;}
        const alternative=yield* solveSteps(puzzle,rectangles,{forbiddenRectangle:candidate},budget);
        if(alternative.status==='UNSOLVABLE'){forced=candidate;proof='SEARCH_PROOF';detail='Without this rectangle, no complete solution remains.';break;}
        if(alternative.status==='UNKNOWN')return unavailable(alternative.reason);
      }
    }
    if(!forced)return unavailable('NO_FORCED_MOVE');
    const clue=puzzle.clues.find(c=>c.id===forced.clueId),location=`the ${clue.value} at row ${clue.row+1}, column ${clue.col+1}`;
    return{status:'READY',strength,clueId:clue.id,proof,rectangle:strength==='reveal'?forced:null,title:strength==='nudge'?'Look a little closer':strength==='explain'?'A rectangle is forced':'One shape found',message:strength==='nudge'?`Look at ${location}. There is a forced rectangle around this number.`:`For ${location}: ${detail} Its ${forced.height} × ${forced.width} rectangle starts at row ${forced.row+1}, column ${forced.col+1}, and covers exactly ${clue.value} cells.`};
  }catch(error){const reason=limitReason(error);if(reason)return unavailable(reason);throw error;}
}
export function analyzeBoard(puzzle,rectangles=[],options={}){return drain(analyzeSteps(puzzle,rectangles,options));}
