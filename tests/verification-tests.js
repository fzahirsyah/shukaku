import {verifyDefinitions} from '../js/state/definition-verifier.js';
export async function runVerificationTests(){
  const results=[],puzzles=Array.from({length:1000},(_,i)=>({id:'proof-'+i}));
  const equal=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);};
  async function test(name,body){try{await body();results.push({name,pass:true});}catch(error){results.push({name,pass:false,error:error.message});}}
  await test('VERIFY-01 supported histories use bounded chunks, not one shared proof budget',async()=>{
    const sizes=[],progress=[],result=await verifyDefinitions({async request(type,{puzzles}){sizes.push(puzzles.length);return{status:'VERIFIED',accepted:puzzles,rejected:[]};}},puzzles,{onProgress:p=>progress.push(p)});
    equal(result.accepted.length,1000);equal(result.deferred.length,0);equal(Math.max(...sizes),16);equal(progress.at(-1),{completed:1000,total:1000});
  });
  await test('VERIFY-02 partial batches split and finish remaining proofs',async()=>{
    const result=await verifyDefinitions({async request(type,{puzzles}){return puzzles.length>1?{status:'PARTIAL',accepted:puzzles.slice(0,1),rejected:[],reason:'WORK_BUDGET'}:{status:'VERIFIED',accepted:puzzles,rejected:[]};}},puzzles.slice(0,16));
    equal(result.accepted.length,16);equal(result.rejected.length,0);equal(result.deferred.length,0);
  });
  await test('VERIFY-03 one proof hitting its limit is pending, not invalid',async()=>{
    const result=await verifyDefinitions({async request(){return{status:'PARTIAL',accepted:[],rejected:[],reason:'TIME_BUDGET'};}},puzzles.slice(0,1));
    equal(result.deferred,puzzles.slice(0,1));equal(result.rejected,[]);
  });
  await test('VERIFY-04 unsupported workers preserve unverified definitions',async()=>{
    let calls=0;const result=await verifyDefinitions({async request(){calls++;return{status:'UNAVAILABLE',reason:'WORKER_UNAVAILABLE'};}},puzzles);
    equal(calls,1);equal(result.deferred.length,1000);equal(result.rejected.length,0);
  });
  await test('VERIFY-05 cancellation preserves all unfinished definitions',async()=>{
    let cancelled=false;const result=await verifyDefinitions({async request(type,{puzzles}){cancelled=true;return{status:'VERIFIED',accepted:puzzles,rejected:[]};}},puzzles,{isCancelled:()=>cancelled});
    equal(result.accepted.length,16);equal(result.deferred.length,984);equal(result.rejected.length,0);
  });
  await test('VERIFY-06 invalid content remains rejected while valid content finishes',async()=>{
    const result=await verifyDefinitions({async request(type,{puzzles}){return{status:'VERIFIED',accepted:puzzles.slice(1),rejected:[{id:puzzles[0].id,reason:'CONTENT_MISMATCH'}]};}},puzzles.slice(0,16));
    equal(result.accepted.length,15);equal(result.rejected.length,1);equal(result.deferred.length,0);
  });
  await test('VERIFY-07 overall deadline preserves pending history',async()=>{
    let now=0;const result=await verifyDefinitions({async request(type,{puzzles}){now=100;return{status:'VERIFIED',accepted:puzzles,rejected:[]};}},puzzles,{now:()=>now,maxMs:50});
    equal(result.accepted.length,16);equal(result.deferred.length,984);equal(result.rejected.length,0);
  });
  return results;
}
