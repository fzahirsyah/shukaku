import { cleanPuzzle,cleanSession,cleanResult,cleanSettings,clone } from './schema.js';
export function validateBackup(input,catalog){
  if(!input||input.exportFormatVersion!==1||!Array.isArray(input.puzzles)||!Array.isArray(input.sessions)||!Array.isArray(input.results)||input.puzzles.length>1000||input.sessions.length>2000||input.results.length>2000)throw Error('Unsupported backup version or size.');
  const unique=(items,label)=>{if(new Set(items.map(item=>item.id)).size!==items.length)throw Error(`Duplicate ${label} IDs.`);};
  const puzzles=input.puzzles.map(p=>cleanPuzzle(p,catalog));unique(puzzles,'puzzle');
  const sessions=input.sessions.map(raw=>{const puzzle=puzzles.find(p=>p.id===raw.puzzleId);if(!puzzle)throw Error('A session is missing its puzzle.');const session=cleanSession(raw,puzzle);delete session._storageRevision;if(session.status==='PLAYING')session.status='PAUSED';return session;});unique(sessions,'session');
  const results=input.results.map(result=>cleanResult(result,sessions));unique(results,'result');
  for(const session of sessions)if(session.status==='COMPLETED'&&!results.some(r=>r.sessionId===session.id))throw Error('Completed session is missing its result.');
  if(!input.settings||typeof input.settings!=='object'||Array.isArray(input.settings))throw Error('Invalid backup preferences.');
  return {exportFormatVersion:1,exportedAt:Date.now(),puzzles,sessions,results,settings:cleanSettings(input.settings)};
}
export function makeBackup(puzzles,sessions,results,settings){
  return {exportFormatVersion:1,exportedAt:Date.now(),puzzles:clone(puzzles),sessions:sessions.map(raw=>{const session=clone(raw);delete session._owner;delete session._leaseUntil;delete session._storageRevision;if(session.status==='PLAYING')session.status='PAUSED';return session;}),results:clone(results),settings:cleanSettings(settings)};
}
export function downloadJSON(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
