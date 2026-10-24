export class CancelledError extends Error {constructor(){super('Analysis cancelled.');this.name='CancelledError';}}
export class PuzzleService {
  constructor({workerFactory=()=>new Worker(new URL('../workers/puzzle-worker.js',import.meta.url),{type:'module'}),deadlineMs=4500}={}){this.workerFactory=workerFactory;this.deadlineMs=deadlineMs;this.worker=null;this.pending=null;this.serial=0;}
  ensureWorker(){
    if(this.worker)return;
    this.worker=this.workerFactory();
    this.worker.onmessage=event=>{const request=this.pending;if(!request||event.data?.id!==request.id)return;clearTimeout(request.timeout);this.pending=null;request.resolve(event.data.result);};
    this.worker.onerror=event=>{event.preventDefault?.();this.fail('WORKER_UNAVAILABLE');};
    this.worker.onmessageerror=()=>this.fail('WORKER_UNAVAILABLE');
  }
  fail(reason){const request=this.pending;this.pending=null;this.worker?.terminate();this.worker=null;if(request){clearTimeout(request.timeout);request.resolve({status:'UNAVAILABLE',reason,title:'Hints are unavailable',message:'Hints are unavailable right now. You can still play, undo a move, or revisit How to Play.'});}}
  request(type,payload={}){
    this.cancel();try{this.ensureWorker();}catch{return Promise.resolve({status:'UNAVAILABLE',reason:'WORKER_UNAVAILABLE',title:'Hints are unavailable',message:'Hints are unavailable in this browser. You can still play and undo moves.'});}
    return new Promise((resolve,reject)=>{
      const id=`analysis-${++this.serial}`;
      const timeout=setTimeout(()=>{this.worker?.postMessage({type:'cancel',id});this.fail('DEADLINE');},this.deadlineMs);
      this.pending={id,resolve,reject,timeout};
      try{this.worker.postMessage({id,type,...payload});}catch{this.fail('WORKER_UNAVAILABLE');}
    });
  }
  cancel(){if(!this.pending)return;const request=this.pending;this.pending=null;clearTimeout(request.timeout);this.worker?.postMessage({type:'cancel',id:request.id});request.reject(new CancelledError());}
  close(){this.cancel();this.worker?.terminate();this.worker=null;}
}
