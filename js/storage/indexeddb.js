import { clone,resultFor,cleanPuzzle } from './schema.js';
export const DB_NAME='shikaku-db', DB_VERSION=1;
export class ConflictError extends Error { constructor(message='This puzzle is open in another tab.'){super(message);this.name='ConflictError';} }
export function openDatabase(name=DB_NAME) {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(name,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      for(const [store,key,indexes] of [['puzzles','id',['modeSource','difficulty']],['sessions','id',['puzzleId','mode','status','updatedAt']],['results','id',['puzzleId','mode','completedAt']],['settings','key',[]]]){
        const table=db.objectStoreNames.contains(store)?request.transaction.objectStore(store):db.createObjectStore(store,{keyPath:key});
        for(const index of indexes)if(!table.indexNames.contains(index))table.createIndex(index,index,{unique:false});
      }
    };
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(Error('Close other Shikaku tabs to update local storage.'));
  });
}
export function transaction(db,stores,mode,body){
  return new Promise((resolve,reject)=>{
    let result,customError,aborted=false;
    const tx=db.transaction(stores,mode);
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>{};tx.onabort=()=>reject(customError||tx.error||Error('Local transaction failed.'));
    const api={store:name=>tx.objectStore(name),result:value=>{result=value;},fail:error=>{if(aborted)return;aborted=true;customError=error;try{tx.abort();}catch{}}};
    api.guard=handler=>(...args)=>{try{return handler(...args);}catch(error){api.fail(error);}};
    try{body(api);}catch(error){api.fail(error);}
  });
}
export class Repository {
  constructor(db,{owner=crypto.randomUUID(),locks=navigator.locks,channel=true,leaseMs=16000}={}){
    this.db=db;this.owner=owner;this.locks=locks;this.leaseMs=leaseMs;this.versions=new Map();this.queues=new Map();this.held=new Map();this.lockReleases=new Map();this.onchange=()=>{};
    this.channel=channel&&typeof BroadcastChannel!=='undefined'?new BroadcastChannel(DB_NAME+'-changes'):null;
    if(this.channel)this.channel.onmessage=event=>{if(event.data?.owner!==this.owner)this.onchange(event.data);};
  }
  announce(type,id){this.channel?.postMessage({type,id,owner:this.owner});}
  async snapshot(){return transaction(this.db,['puzzles','sessions','results','settings'],'readonly',api=>{const data={};for(const name of ['puzzles','sessions','results','settings']){const request=api.store(name).getAll();request.onsuccess=api.guard(()=>{data[name]=request.result;});}api.result(data);});}
  async seed(puzzles){return transaction(this.db,['puzzles'],'readwrite',api=>{for(const puzzle of puzzles)api.store('puzzles').put(clone(puzzle));});}
  async hold(scope){
    if(this.lockReleases.has(scope))return true;
    if(!this.locks)return false;
    return new Promise((resolve,reject)=>{
      this.locks.request('shikaku-editor:'+scope,{ifAvailable:true},lock=>{
        if(!lock){resolve(null);return;}
        return new Promise(release=>{this.lockReleases.set(scope,release);resolve(true);});
      }).catch(reject);
    });
  }
  async holdData(){
    if(!this.locks||this.dataRelease)return;
    await new Promise((resolve,reject)=>{this.locks.request('shikaku-data',{mode:'shared'},()=>new Promise(release=>{this.dataRelease=release;resolve();})).catch(reject);});
  }
  releaseData(){if(!this.held.size&&this.dataRelease){this.dataRelease();this.dataRelease=null;}}
  async claim(proposed,{separate=false,skipIds=[],validate=null,puzzle=null}={}){
    await this.holdData();
    const scope=proposed.mode==='classic'&&!separate?`classic:${proposed.puzzleId}`:`session:${proposed.id}`;
    const held=await this.hold(scope);
    if(held===null){this.releaseData();throw new ConflictError();}
    try{
      const record=await transaction(this.db,['sessions','puzzles'],'readwrite',api=>{
        // Definition and first session are committed together, under the same
        // shared data lock used to exclude replacement imports.
        if(puzzle){
          if(puzzle.id!==proposed.puzzleId)throw Error('Puzzle does not match session.');
          const definitions=api.store('puzzles'),existing=definitions.get(puzzle.id);
          existing.onsuccess=api.guard(()=>{if(existing.result)cleanPuzzle(existing.result,[puzzle]);definitions.put(clone(puzzle));});
        }
        const store=api.store('sessions'),request=store.getAll();
        request.onsuccess=api.guard(()=>{
          let old=request.result.find(s=>s.id===proposed.id);
          if(!old&&proposed.mode==='classic'&&!separate)old=request.result.filter(s=>s.mode==='classic'&&s.puzzleId===proposed.puzzleId&&s.status!=='COMPLETED'&&!s.separate&&!skipIds.includes(s.id)).sort((a,b)=>b.updatedAt-a.updatedAt)[0];
          if(old?._owner&&old._owner!==this.owner&&old._leaseUntil>Date.now()&&!held){api.fail(new ConflictError());return;}
          if(validate){try{validate(old||proposed);}catch(error){api.fail(error);return;}}
          const next={...clone(old||proposed),_owner:this.owner,_leaseUntil:Date.now()+this.leaseMs,_storageRevision:(old?._storageRevision||0)+1};
          store.put(next);api.result(next);
        });
      });
      this.versions.set(record.id,record._storageRevision);this.held.set(record.id,scope);this.announce('claimed',record.id);return record;
    }catch(error){this.lockReleases.get(scope)?.();this.lockReleases.delete(scope);this.releaseData();throw error;}
  }
  save(snapshot){
    const data=clone(snapshot),id=data.id;
    const pending=(this.queues.get(id)||Promise.resolve()).catch(()=>{}).then(async()=>{
      const revision=await transaction(this.db,['sessions','results'],'readwrite',api=>{
        const store=api.store('sessions'),request=store.get(id);
        request.onsuccess=api.guard(()=>{
          const old=request.result;
          if(!old||old._owner!==this.owner||old._storageRevision!==this.versions.get(id)){api.fail(new ConflictError('A newer save exists in another tab.'));return;}
          const next={...data,_owner:this.owner,_leaseUntil:Date.now()+this.leaseMs,_storageRevision:old._storageRevision+1};
          store.put(next);
          if(data.status==='COMPLETED'){
            const results=api.store('results'),key=`result:${data.id}`,existing=results.get(key);
            existing.onsuccess=api.guard(()=>{if(!existing.result)results.add(resultFor(data));});
          }
          api.result(next._storageRevision);
        });
      });
      this.versions.set(id,revision);this.announce('saved',id);return revision;
    });
    this.queues.set(id,pending);return pending;
  }
  async renew(){
    if(!this.held.size)return;
    await transaction(this.db,['sessions'],'readwrite',api=>{for(const id of this.held.keys()){const store=api.store('sessions'),request=store.get(id);request.onsuccess=api.guard(()=>{const record=request.result;if(!record||record._owner!==this.owner){api.fail(new ConflictError());return;}record._leaseUntil=Date.now()+this.leaseMs;store.put(record);});}});
  }
  async release(id){
    await this.queues.get(id)?.catch(()=>{});
    const scope=this.held.get(id);if(!scope)return;
    try{await transaction(this.db,['sessions'],'readwrite',api=>{const store=api.store('sessions'),request=store.get(id);request.onsuccess=api.guard(()=>{if(request.result?._owner===this.owner)store.put({...request.result,_owner:null,_leaseUntil:0});});});}
    finally{this.held.delete(id);this.versions.delete(id);this.lockReleases.get(scope)?.();this.lockReleases.delete(scope);this.announce('released',id);this.releaseData();}
  }
  async setting(key,value){await transaction(this.db,['settings'],'readwrite',api=>api.store('settings').put({key,value:clone(value)}));this.announce('settings');}
  async importData(data,mode){
    const write=()=>transaction(this.db,['puzzles','sessions','results','settings'],'readwrite',api=>{
      // The check and all writes share a transaction, so an active editor cannot be silently overwritten.
      const request=api.store('sessions').getAll();request.onsuccess=api.guard(()=>{
        if(mode==='replace'&&request.result.some(s=>s._owner&&s._owner!==this.owner&&s._leaseUntil>Date.now())){api.fail(new ConflictError('Close the other editing tab before replacing local data.'));return;}
        const existingIds=new Set(request.result.map(s=>s.id));
        if(mode==='replace')for(const store of ['puzzles','sessions','results','settings'])api.store(store).clear();
        for(const name of ['puzzles','sessions','results'])for(const item of data[name]){
          if(mode==='merge'&&name==='results'&&existingIds.has(item.sessionId))continue;
          const store=api.store(name),value=name==='sessions'?{...clone(item),_owner:null,_leaseUntil:0,_storageRevision:0}:clone(item);
          if(mode==='replace')store.put(value);
          else{const existing=store.get(value.id);existing.onsuccess=api.guard(()=>{if(!existing.result)store.add(value);});}
        }
        if(mode==='replace')for(const [key,value]of Object.entries(data.settings))api.store('settings').put({key,value});
      });
    });
    if(this.locks)await this.locks.request('shikaku-data',{mode:'exclusive',ifAvailable:true},lock=>{if(!lock)throw new ConflictError('Close the other editing tab before changing local data.');return write();});else await write();
    this.announce('imported');
  }
  async clear(){await this.importData({puzzles:[],sessions:[],results:[],settings:{}},'replace');this.announce('reset');}
  close(){this.dataRelease?.();for(const release of this.lockReleases.values())release();this.lockReleases.clear();this.channel?.close();this.db.close();}
}
