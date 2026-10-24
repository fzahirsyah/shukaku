// A saved collection is a sequence of bounded proofs, not one giant proof.
// Unfinished work remains pending; it is never reported as invalid content.
export async function verifyDefinitions(service,puzzles,{onProgress=()=>{},isCancelled=()=>false,now=()=>Date.now(),maxMs=60000,batchSize=16}={}){
  const accepted=[],rejected=[],deferred=[],queue=[];const started=now();
  for(let index=0;index<puzzles.length;index+=batchSize)queue.push(puzzles.slice(index,index+batchSize));
  const progress=()=>onProgress({completed:accepted.length+rejected.length,total:puzzles.length});progress();
  while(queue.length){
    if(isCancelled()||now()-started>=maxMs){deferred.push(...queue.flat());break;}
    const batch=queue.shift();let result;
    try{result=await service.request('verify-generated',{puzzles:batch,budget:{maxMs:4000,maxWork:6000000,maxNodes:200000}});}
    catch(error){if(error.name!=='CancelledError')throw error;deferred.push(...batch,...queue.flat());break;}
    accepted.push(...(result.accepted||[]));rejected.push(...(result.rejected||[]));
    const finished=new Set([...(result.accepted||[]),...(result.rejected||[])].map(p=>p.id)),unfinished=batch.filter(p=>!finished.has(p.id));
    if(unfinished.length){
      if(result.status==='PARTIAL'&&batch.length>1){
        if(unfinished.length===1)queue.unshift(unfinished);
        else{const middle=Math.ceil(unfinished.length/2);queue.unshift(unfinished.slice(0,middle),unfinished.slice(middle));}
      }
      else{deferred.push(...unfinished);if(result.status!=='PARTIAL'){deferred.push(...queue.flat());queue.length=0;}}
    }
    progress();
  }
  return{accepted,rejected,deferred};
}
