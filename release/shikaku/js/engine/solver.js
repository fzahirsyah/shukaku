import {validatePuzzle,validateRectangle,contains} from './validator.js';
class SearchLimit extends Error {constructor(reason){super(reason);this.reason=reason;}}
export function searchBudget(options={}){
  const now=options.now||(()=>0),started=now();
  return {work:0,nodes:0,now,started,maxMs:options.maxMs??Infinity,maxWork:options.maxWork??1000000,maxNodes:options.maxNodes??100000,isCancelled:options.isCancelled||(()=>false)};
}
export function* pulse(budget,node=false){
  budget.work++;if(node)budget.nodes++;
  if(budget.isCancelled())throw new SearchLimit('CANCELLED');
  if(budget.nodes>budget.maxNodes)throw new SearchLimit('NODE_BUDGET');
  if(budget.work>budget.maxWork)throw new SearchLimit('WORK_BUDGET');
  if(budget.now()-budget.started>=budget.maxMs)throw new SearchLimit('TIME_BUDGET');
  if(budget.work%128===0)yield;
}
export function rectangleKey(rect){return `${rect.clueId}:${rect.row}:${rect.col}:${rect.height}:${rect.width}`;}
export function maskFor(rect,puzzle){let mask=0n;for(let row=rect.row;row<rect.row+rect.height;row++)for(let col=rect.col;col<rect.col+rect.width;col++)mask|=1n<<BigInt(row*puzzle.cols+col);return mask;}
export function* candidateSteps(puzzle,budget){
  const candidates=[];
  for(const clue of puzzle.clues){
    const list=[];
    for(let height=1;height<=puzzle.rows;height++){
      yield* pulse(budget);if(clue.value%height)continue;const width=clue.value/height;
      if(width>puzzle.cols)continue;
      for(let row=Math.max(0,clue.row-height+1);row<=Math.min(clue.row,puzzle.rows-height);row++){
        for(let col=Math.max(0,clue.col-width+1);col<=Math.min(clue.col,puzzle.cols-width);col++){
          yield* pulse(budget);const rect={clueId:clue.id,row,col,height,width};let another=false;
          for(const other of puzzle.clues){yield* pulse(budget);if(other.id!==clue.id&&contains(rect,other.row,other.col)){another=true;break;}}
          if(!another)list.push({rectangle:rect,mask:maskFor(rect,puzzle),key:rectangleKey(rect)});
        }
      }
    }
    candidates.push(list);
  }
  return candidates;
}
export function* solveSteps(puzzle,rectangles=[],options={},sharedBudget=null){
  const budget=sharedBudget||searchBudget(options),solutions=[];let candidates=[];
  const finish=(status,reason=null)=>({status,count:solutions.length,solution:solutions[0]||null,reason,nodes:budget.nodes,work:budget.work});
  try{
    yield* pulse(budget);
    if(!validatePuzzle(puzzle)||!Array.isArray(rectangles)||rectangles.length>puzzle.clues.length)return finish('UNSOLVABLE','INVALID_PUZZLE_OR_POSITION');
    const assigned=new Map();let used=0n;
    for(const rect of rectangles){yield* pulse(budget);const validation=validateRectangle(puzzle,[...assigned.values()],rect);if(!validation.ok||validation.rectangle.clueId!==rect.clueId)return finish('UNSOLVABLE','INVALID_POSITION');assigned.set(rect.clueId,validation.rectangle);used|=maskFor(rect,puzzle);}
    candidates=yield* candidateSteps(puzzle,budget);
    const fullMask=(1n<<BigInt(puzzle.rows*puzzle.cols))-1n;
    const forbidden=options.forbiddenRectangle?rectangleKey(options.forbiddenRectangle):null;
    if(forbidden&&rectangles.some(rect=>rectangleKey(rect)===forbidden))return finish('UNSOLVABLE');
    function* search(occupied){
      yield* pulse(budget,true);
      if(assigned.size===puzzle.clues.length){if(occupied===fullMask)solutions.push(puzzle.clues.map(clue=>({...assigned.get(clue.id)})));return;}
      let best=null,bestClue=null,possible=occupied;
      for(let index=0;index<puzzle.clues.length;index++){
        const clue=puzzle.clues[index];if(assigned.has(clue.id))continue;
        const compatible=[];
        for(const candidate of candidates[index]){yield* pulse(budget);if(candidate.key!==forbidden&&!(candidate.mask&occupied)){compatible.push(candidate);possible|=candidate.mask;}}
        if(!compatible.length)return;
        if(!best||compatible.length<best.length){best=compatible;bestClue=clue;}
      }
      if(possible!==fullMask)return;
      for(const candidate of best){
        assigned.set(bestClue.id,candidate.rectangle);yield* search(occupied|candidate.mask);assigned.delete(bestClue.id);
        if(solutions.length>=2)return;
      }
    }
    yield* search(used);
    return finish(solutions.length>=2?'MULTIPLE':solutions.length===1?'UNIQUE':'UNSOLVABLE');
  }catch(error){if(error instanceof SearchLimit)return finish(solutions.length>=2?'MULTIPLE':'UNKNOWN',error.reason);throw error;}
}
export function drain(iterator){let result;do{result=iterator.next();}while(!result.done);return result.value;}
export function solvePuzzle(puzzle,rectangles=[],options={}){return drain(solveSteps(puzzle,rectangles,options));}
export function limitReason(error){return error instanceof SearchLimit?error.reason:null;}
