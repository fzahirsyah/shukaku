import {seededRandom} from './seeded-random.js';
import {searchBudget,pulse,solveSteps,limitReason} from './solver.js';
import {difficultySteps,zenDifficulties} from './difficulty.js';
import {validatePuzzle,isComplete} from './validator.js';
export const GENERATOR_VERSION='zen-1';
export const zenSizes=[5,6,7,10,12];
const validSeed=seed=>typeof seed==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(seed);
export function boardFingerprint(puzzle){return JSON.stringify([puzzle.rows,puzzle.cols,[...puzzle.clues].sort((a,b)=>a.row-b.row||a.col-b.col).map(c=>[c.row,c.col,c.value])]);}
function parameters(size,difficulty,seed){return zenSizes.includes(size)&&zenDifficulties.some(d=>d.id===difficulty)&&validSeed(seed);}
export function puzzleFromSeed(size,difficulty,seed){
  if(!parameters(size,difficulty,seed))throw Error('Unsupported generation parameters.');
  const random=seededRandom(`${GENERATOR_VERSION}/${size}/${difficulty}/${seed}`),pick=max=>Math.floor(random()*max);
  const regions=[{row:0,col:0,height:size,width:size}];
  // Split existing rectangles: coverage and non-overlap hold at every step.
  const average=difficulty==='gentle'?3.5:difficulty==='balanced'?5:7;
  const target=Math.max(4,Math.round(size*size/average)+(pick(3)-1));
  while(regions.length<target){
    const splittable=regions.map((region,index)=>({region,index})).filter(({region:r})=>r.height*r.width>=4&&(r.height>1||r.width>1));
    if(!splittable.length)break;
    const total=splittable.reduce((sum,{region:r})=>sum+r.height*r.width,0);let choice=random()*total,chosen=splittable.at(-1);
    for(const candidate of splittable){choice-=candidate.region.height*candidate.region.width;if(choice<0){chosen=candidate;break;}}
    const {region:r,index}=chosen;
    const horizontal=r.height>1&&(r.width===1||random()<r.height/(r.height+r.width));
    const length=horizontal?r.height:r.width,cut=1+pick(length-1);
    const first={...r,[horizontal?'height':'width']:cut};
    const second=horizontal?{...r,row:r.row+cut,height:r.height-cut}:{...r,col:r.col+cut,width:r.width-cut};
    regions.splice(index,1,first,second);
  }
  const clues=regions.map((r,index)=>({id:`z${index}`,row:r.row+pick(r.height),col:r.col+pick(r.width),value:r.height*r.width}));
  return{id:`zen-${GENERATOR_VERSION}-${size}-${difficulty}-${seed}`,contentVersion:1,rows:size,cols:size,difficulty,modeSource:'generated',seed,generatorVersion:GENERATOR_VERSION,clues};
}
function quality(puzzle){
  const singles=puzzle.clues.filter(c=>c.value===1).length;
  return singles<=Math.floor(puzzle.clues.length/4)&&puzzle.clues.length>=4&&puzzle.clues.some(c=>c.value>=4);
}
function* certify(candidate,budget){
  if(!validatePuzzle(candidate)||!quality(candidate))return null;
  const proof=yield* solveSteps(candidate,[],{},budget);
  if(proof.status==='UNKNOWN')return {limited:proof.reason};
  if(proof.status!=='UNIQUE'||!isComplete(candidate,proof.solution))return null;
  const metrics=yield* difficultySteps(candidate,budget),range=zenDifficulties.find(d=>d.id===candidate.difficulty);
  if(metrics.logicScore<range.min||metrics.logicScore>range.max)return null;
  return {...candidate,uniqueVerified:true,logicScore:metrics.logicScore,logicMetrics:metrics,solution:proof.solution};
}
export function* generateSteps({size=5,difficulty='gentle',seed,maxAttempts=2048,exclude=[]}={},options={}){
  if(!parameters(size,difficulty,seed)||!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>4096||!Array.isArray(exclude)||exclude.length>2000)return{status:'UNAVAILABLE',reason:'INVALID_PARAMETERS'};
  const budget=searchBudget(options),seen=new Set(exclude);
  try{
    for(let attempt=0;attempt<maxAttempts;attempt++){
      yield* pulse(budget);
      // Each candidate has its own recorded seed, so it can be reconstructed
      // without replaying rejected attempts or depending on machine timing.
      const candidateSeed=attempt===0?seed:`${seed}_${attempt}`;
      if(!validSeed(candidateSeed))break;
      const candidate=puzzleFromSeed(size,difficulty,candidateSeed);
      if(seen.has(boardFingerprint(candidate)))continue;
      const accepted=yield* certify(candidate,budget);
      if(accepted?.limited)return{status:'UNAVAILABLE',reason:accepted.limited,attempts:attempt+1};
      if(accepted)return{status:'READY',puzzle:accepted,attempts:attempt+1};
    }
    return{status:'UNAVAILABLE',reason:'ATTEMPT_BUDGET',attempts:maxAttempts};
  }catch(error){const reason=limitReason(error);if(!reason)throw error;return{status:'UNAVAILABLE',reason};}
}
export function* verifyGeneratedSteps(puzzles,options={}){
  if(!Array.isArray(puzzles)||puzzles.length>1000)return{status:'UNAVAILABLE',reason:'INVALID_PARAMETERS'};
  const budget=searchBudget(options),accepted=[],rejected=[];
  try{
    for(const raw of puzzles){
      yield* pulse(budget);
      if(!raw||raw.generatorVersion!==GENERATOR_VERSION||!parameters(raw.rows,raw.difficulty,raw.seed)){rejected.push({id:raw?.id,reason:'UNSUPPORTED_GENERATOR'});continue;}
      const candidate=puzzleFromSeed(raw.rows,raw.difficulty,raw.seed);
      if(raw.id!==candidate.id||raw.contentVersion!==1||raw.modeSource!=='generated'||raw.cols!==raw.rows||!Array.isArray(raw.clues)||raw.clues.length!==candidate.clues.length||JSON.stringify(raw.clues)!==JSON.stringify(candidate.clues)){rejected.push({id:raw.id,reason:'CONTENT_MISMATCH'});continue;}
      const proof=yield* certify(candidate,budget);
      if(proof?.limited)return{status:'PARTIAL',accepted,rejected,reason:proof.limited};
      if(proof)accepted.push(proof);else rejected.push({id:raw.id,reason:'UNVERIFIED_PUZZLE'});
    }
    return{status:'VERIFIED',accepted,rejected};
  }catch(error){const reason=limitReason(error);if(!reason)throw error;return{status:'PARTIAL',accepted,rejected,reason};}
}
