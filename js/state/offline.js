export class OfflineSupport {
  constructor(onChange){this.onChange=onChange;this.registration=null;this.disposed=false;this.cleanups=[];this.state={offline:!navigator.onLine,ready:false,update:false,error:''};this.connectivity=()=>{this.publish({offline:!navigator.onLine});this.probe();};this.controllerChange=()=>this.probe();}
  publish(values){if(this.disposed)return;this.state={...this.state,...values};this.onChange({...this.state});}
  async start(){
    if(!('serviceWorker'in navigator)||!window.isSecureContext){this.publish({error:'Offline play is unavailable in this browser. You can still play online.'});return;}
    if(!this.listening){this.listening=true;window.addEventListener('online',this.connectivity);window.addEventListener('offline',this.connectivity);navigator.serviceWorker.addEventListener('controllerchange',this.controllerChange);}
    try{
      const registration=await navigator.serviceWorker.register(new URL('../../service-worker.js',import.meta.url),{updateViaCache:'none'});
      if(this.disposed)return;
      if(this.registration!==registration){
        this.registration=registration;
        const changed=()=>this.watch(registration.installing);registration.addEventListener('updatefound',changed);this.cleanups.push(()=>registration.removeEventListener('updatefound',changed));
      }
      this.publish({update:!!registration.waiting,error:''});this.watch(registration.installing);this.probe();
      navigator.serviceWorker.ready.then(()=>this.probe());
    }catch{this.publish({error:'Offline setup did not finish. You can keep playing online and retry.'});}
  }
  watch(worker){
    if(!worker||this.watched===worker)return;this.watched=worker;
    const changed=()=>{
      if(worker.state==='installed'){this.publish({update:!!navigator.serviceWorker.controller});this.probe();}
      if(worker.state==='activated'){this.publish({update:false,error:''});this.probe();}
      if(worker.state==='redundant')this.publish({error:'Offline setup did not finish. You can keep playing online and retry.'});
    };
    worker.addEventListener('statechange',changed);this.cleanups.push(()=>worker.removeEventListener('statechange',changed));changed();
  }
  async probe(){
    if(this.disposed)return;const worker=this.registration?.active;if(!worker){this.publish({ready:false});return;}
    const channel=new MessageChannel();let timer;
    const result=await new Promise(resolve=>{timer=setTimeout(()=>resolve(null),2000);channel.port1.onmessage=event=>resolve(event.data);try{worker.postMessage({type:'CACHE_STATUS'},[channel.port2]);}catch{resolve(null);}});
    clearTimeout(timer);channel.port1.close();
    if(result?.type==='CACHE_STATUS')this.publish({ready:result.ready,error:result.ready?'':'The offline cache is incomplete. Reconnect and retry offline setup.'});
  }
  async retry(){try{if(this.registration)await this.registration.update();else await this.start();await this.probe();}catch{this.publish({error:'Offline setup did not finish. Reconnect and try again.'});}}
  stop(){this.disposed=true;for(const cleanup of this.cleanups)cleanup();window.removeEventListener('online',this.connectivity);window.removeEventListener('offline',this.connectivity);navigator.serviceWorker?.removeEventListener('controllerchange',this.controllerChange);}
}
