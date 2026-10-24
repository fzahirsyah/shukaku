import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {generateSteps,verifyGeneratedSteps,boardFingerprint,zenSizes} from '../../../js/engine/generator.js';
import {drain} from '../../../js/engine/solver.js';
import {zenDifficulties} from '../../../js/engine/difficulty.js';
import {validatePuzzle,isComplete} from '../../../js/engine/validator.js';
import {countSolutions} from '../../../tests/content-verifier.js';
const out=new URL('./generator-results.json',import.meta.url),results=[],examples=[];
const options=()=>({maxWork:4000000,maxNodes:100000,now:()=>performance.now(),maxMs:2800});
for(const size of zenSizes)for(const difficulty of zenDifficulties){
 const started=performance.now(),seen=new Set(),accepted=[],failures={},violations=[];let requests=0,attempts=0,maxDurationMs=0;
 while(accepted.length<100&&requests<400&&performance.now()-started<20000){
  const input={size,difficulty:difficulty.id,seed:`audit-${size}-${difficulty.id}-${requests}`,exclude:[...seen]},t=performance.now();
  const result=drain(generateSteps(input,options()));requests++;attempts+=result.attempts||0;maxDurationMs=Math.max(maxDurationMs,performance.now()-t);
  if(result.status!=='READY'){failures[result.reason]=(failures[result.reason]||0)+1;continue;}
  const p=result.puzzle,fingerprint=boardFingerprint(p);
  const count=countSolutions(p,2);
  if(count!==1||!validatePuzzle(p)||!isComplete(p,p.solution)||seen.has(fingerprint)||p.logicScore<difficulty.min||p.logicScore>difficulty.max)violations.push({id:p.id,count,duplicate:seen.has(fingerprint)});
  if(accepted.length%10===0){
   const replay=drain(generateSteps({size,difficulty:difficulty.id,seed:p.seed},options()));
   if(replay.status!=='READY'||JSON.stringify(replay.puzzle)!==JSON.stringify(p))violations.push({id:p.id,reason:'REPLAY_MISMATCH'});
   const verified=drain(verifyGeneratedSteps([p],options()));
   if(verified.accepted?.length!==1||JSON.stringify(verified.accepted[0])!==JSON.stringify(p))violations.push({id:p.id,reason:'RESTORE_MISMATCH'});
  }
  seen.add(fingerprint);accepted.push({id:p.id,score:p.logicScore});if(accepted.length===1)examples.push(p);
 }
 const row={size,difficulty:difficulty.id,distinctAccepted:accepted.length,independentlyUnique:accepted.length-violations.filter(v=>v.count!==undefined&&v.count!==1).length,requests,attempts,failures,violations,elapsedMs:Math.round(performance.now()-started),maxDurationMs:Math.round(maxDurationMs),gatePassed:accepted.length===100&&!violations.length,accepted};
 results.push(row);fs.writeFileSync(out,JSON.stringify({method:'100 distinct accepted per size/difficulty; max 400 requests or 20 seconds per pairing; production work/node/time budgets; independent countSolutions implementation; replay/restore every tenth acceptance',results,examples},null,2));
 console.log(JSON.stringify({...row,accepted:undefined}));
}
