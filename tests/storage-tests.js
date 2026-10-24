import {openDatabase,Repository,transaction,ConflictError} from '../js/storage/indexeddb.js';
import {cleanSession,resultFor} from '../js/storage/schema.js';
import {makeBackup,validateBackup} from '../js/storage/backup.js';
import {ActiveTimer,formatDuration,summarize} from '../js/state/timer.js';
import {classicLevels} from '../js/data/classic-levels.js';
import {zenFallbackLevels} from '../js/data/zen-fallback-levels.js';
import {createSession,applyMove} from '../js/engine/moves.js';
const catalog=[...classicLevels,...zenFallbackLevels],p=classicLevels[0];
function session(id='test-session'){return{...createSession(p,id),mode:'classic',contentVersion:1,elapsedActiveMs:0,startedAt:100,updatedAt:100};}
function solved(id='solved',elapsed=1000,hints=0){let s=session(id);for(const rectangle of p.solution)s=applyMove(p,s,{type:'PLACE',rectangle}).session;return{...s,elapsedActiveMs:elapsed,hintsUsed:hints,completedAt:200,updatedAt:200};}
export async function runStorageTests(){
 const results=[];function equal(a,b){if(JSON.stringify(a)!==JSON.stringify(b))throw Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);}
 async function test(name,body){try{await body();results.push({name,pass:true});}catch(error){results.push({name,pass:false,error:error.message});}}
 const name='shikaku-test-'+crypto.randomUUID(),db=await openDatabase(name),a=new Repository(db,{owner:'owner-a',locks:null,channel:false}),b=new Repository(db,{owner:'owner-b',locks:null,channel:false});
 try{
 await test('SCHEMA v1 stores and indexes',()=>{equal([...db.objectStoreNames],['puzzles','results','sessions','settings']);equal([...db.transaction('sessions').objectStore('sessions').indexNames],['mode','puzzleId','status','updatedAt']);});
 await a.seed(catalog);
 await test('SAVE-01 move survives database read and validates',async()=>{let s=await a.claim(session());s=applyMove(p,s,{type:'PLACE',rectangle:p.solution[0]}).session;await a.save(s);const raw=(await a.snapshot()).sessions.find(s=>s.id==='test-session');equal(cleanSession(raw,p).rectangles,[p.solution[0]]);});
 await test('Concurrent tab cannot claim active lease',async()=>{let blocked=false;try{await b.claim(session('other'));}catch(error){blocked=error instanceof ConflictError;}equal(blocked,true);});
 await test('Revision mismatch rejects stale save',async()=>{await transaction(db,['sessions'],'readwrite',api=>{const request=api.store('sessions').get('test-session');request.onsuccess=()=>api.store('sessions').put({...request.result,_storageRevision:999});});let blocked=false;try{await a.save(session());}catch(error){blocked=error instanceof ConflictError;}equal(blocked,true);await a.release('test-session');});
 await test('Expired lease can be claimed without overwriting board',async()=>{await transaction(db,['sessions'],'readwrite',api=>{const request=api.store('sessions').get('test-session');request.onsuccess=()=>api.store('sessions').put({...request.result,_owner:'old-owner',_leaseUntil:0});});const s=await b.claim(session('candidate'));equal(s.id,'test-session');equal(s.rectangles,[p.solution[0]]);await b.release(s.id);});
 await test('Serialized writes preserve newest snapshot',async()=>{const s=await a.claim(session('serial'),{separate:true});const first={...s,elapsedActiveMs:100},last={...s,elapsedActiveMs:200};await Promise.all([a.save(first),a.save(last)]);equal((await a.snapshot()).sessions.find(s=>s.id==='serial').elapsedActiveMs,200);await a.release(s.id);});
 await test('SAVE-02 completion and result atomic and idempotent',async()=>{const s=await a.claim(solved(),{separate:true});await a.save(s);await a.save(s);const data=await a.snapshot();equal(data.results.filter(r=>r.sessionId===s.id).length,1);equal(data.sessions.find(item=>item.id===s.id).status,'COMPLETED');await a.release(s.id);});
 await test('Completion transaction rolls back on failure',async()=>{const before=(await a.snapshot()).results.length;try{await transaction(db,['sessions','results'],'readwrite',api=>{api.store('results').put({...resultFor(solved('abort')),id:'abort-record'});api.fail(Error('Simulated quota failure'));});}catch{}equal((await a.snapshot()).results.length,before);});
 await test('Settings survive write/read',async()=>{await a.setting('theme','dark');equal((await a.snapshot()).settings.find(s=>s.key==='theme').value,'dark');});
 await test('TIME-01 active clock excludes pause and wall-clock changes',()=>{let now=0;const clock=new ActiveTimer(()=>now);clock.load(100);clock.start();now=1000;equal(clock.pause(),1100);now=99999;equal(clock.read(),1100);clock.start();now+=500;equal(clock.checkpoint(),1600);clock.pause();clock.load(clock.read());now+=900000;equal(clock.read(),1600);equal(formatDuration(3723000),'1:02:03');});
 await test('Personal best and no-hint best never become slower',()=>{const sessions=[solved('fast',1000,1),solved('slow',2000,0),solved('slower',3000,0)];const stats=summarize(sessions.map(resultFor),sessions);equal(stats.records[p.id].bestTimeMs,1000);equal(stats.records[p.id].bestNoHintTimeMs,2000);equal(stats.records[p.id].attempts,3);});
 const backup=makeBackup([p],[solved('imported')],[resultFor(solved('imported'))],{theme:'dark'});
 await test('IMPORT-01 export/import roundtrip with safe paused restore',()=>{const active=session('active');const data=makeBackup([p],[active],[],{});equal(validateBackup(data,catalog).sessions[0].status,'PAUSED');equal(validateBackup(backup,catalog).results.length,1);});
 await test('Corrupted, missing, duplicate, incompatible backups rejected',()=>{for(const mutate of [d=>{d.exportFormatVersion=2;},d=>{d.puzzles[0].clues[0].value=99;},d=>{d.sessions[0].rectangles=[];},d=>{d.sessions.push(d.sessions[0]);},d=>{d.results[0].elapsedActiveMs=-1;},d=>{d.puzzles=[];}]){const data=JSON.parse(JSON.stringify(backup));mutate(data);let rejected=false;try{validateBackup(data,catalog);}catch{rejected=true;}equal(rejected,true);}});
 await test('Merge adds only new IDs and preserves preferences',async()=>{const data=validateBackup(backup,catalog);await a.importData(data,'merge');await a.importData(data,'merge');equal((await a.snapshot()).sessions.filter(s=>s.id==='imported').length,1);equal((await a.snapshot()).settings.find(s=>s.key==='theme').value,'dark');});
 await test('Replace import refuses another active editor',async()=>{await b.claim(session('editing'),{separate:true});let rejected=false;try{await a.importData(validateBackup(backup,catalog),'replace');}catch(error){rejected=error instanceof ConflictError;}equal(rejected,true);await b.release('editing');});
 await test('Replace import updates stores together and reset clears all',async()=>{await a.importData(validateBackup(backup,catalog),'replace');const data=await a.snapshot();equal(data.sessions.length,1);equal(data.results.length,1);equal(data.settings[0].value,'dark');await a.clear();const empty=await a.snapshot();for(const rows of Object.values(empty))equal(rows.length,0);});
 }finally{a.channel?.close();b.channel?.close();db.close();await new Promise(resolve=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=resolve;request.onerror=resolve;});}
 return results;
}
