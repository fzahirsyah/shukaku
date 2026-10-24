import {candidateSteps,pulse,searchBudget} from './solver.js';
export const zenDifficulties=[{id:'gentle',label:'Gentle',min:0,max:30},{id:'balanced',label:'Balanced',min:31,max:60},{id:'challenging',label:'Challenging',min:61,max:100}];
// A provisional logical rating, independent of board dimensions. Human calibration
// belongs to content review; the score is not a promise of a player's solve time.
export function* difficultySteps(puzzle,budget=searchBudget()){
  let lists=yield* candidateSteps(puzzle,budget);
  const initialCandidates=lists.reduce((sum,list)=>sum+list.length,0),initialForced=lists.filter(list=>list.length===1).length;
  const placed=new Set();let occupied=0n,rounds=0,soleCellDeductions=0;
  while(placed.size<lists.length){
    const forced=new Map();
    for(let index=0;index<lists.length;index++){
      if(placed.has(index))continue;
      lists[index]=lists[index].filter(candidate=>!(candidate.mask&occupied));yield* pulse(budget);
      if(!lists[index].length)throw Error('Contradictory logical evaluation.');
      if(lists[index].length===1)forced.set(index,lists[index][0]);
    }
    // A cell covered by only one remaining candidate forces that candidate.
    for(let cell=0;cell<puzzle.rows*puzzle.cols;cell++){
      const bit=1n<<BigInt(cell);if(occupied&bit)continue;let only=null,multiple=false;
      for(let index=0;index<lists.length&&!multiple;index++){
        if(placed.has(index))continue;
        for(const candidate of lists[index]){yield* pulse(budget);if(candidate.mask&bit){if(only){multiple=true;break;}only={index,candidate};}}
      }
      if(only&&!multiple&&!forced.has(only.index)){forced.set(only.index,only.candidate);soleCellDeductions++;}
    }
    if(!forced.size)break;
    rounds++;
    for(const [index,candidate]of forced){yield* pulse(budget);if(candidate.mask&occupied)throw Error('Conflicting forced deductions.');placed.add(index);occupied|=candidate.mask;}
  }
  const unresolved=lists.length-placed.size;
  const logicScore=Math.min(100,Math.round(12*Math.log2(Math.max(1,initialCandidates/lists.length))+Math.min(30,rounds*3)+40*unresolved/lists.length));
  return {logicScore,initialCandidates,initialForced,deductionRounds:rounds,soleCellDeductions,logicalRegions:placed.size,unresolved};
}
