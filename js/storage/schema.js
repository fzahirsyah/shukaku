import { validatePuzzle, validateRectangle, isComplete } from '../engine/validator.js';
export const clone = value => JSON.parse(JSON.stringify(value));
const id = value => typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,160}$/.test(value);
const integer = (value,max=Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value>=0 && value<=max;
const time = value => Number.isFinite(value) && value>=0 && value<=31536000000;
export function cleanSettings(raw={}) {
  const data={};
  if(['system','light','dark'].includes(raw.theme))data.theme=raw.theme;
  for(const key of ['reducedMotion','sound','highContrast'])if(typeof raw[key]==='boolean')data[key]=raw[key];
  if(['both','tap'].includes(raw.selection))data.selection=raw.selection;
  return data;
}
export function cleanPuzzle(raw, catalog) {
  if(!raw || !id(raw.id)||!validatePuzzle(raw)||!integer(raw.contentVersion))throw Error('Invalid puzzle definition.');
  const official=catalog.find(p=>p.id===raw.id);
  if(!official)throw Error(`Unsupported puzzle: ${raw.id}.`);
  const signature=p=>JSON.stringify({rows:p.rows,cols:p.cols,contentVersion:p.contentVersion,...(p.modeSource==='generated'?{modeSource:p.modeSource,seed:p.seed,generatorVersion:p.generatorVersion,difficulty:p.difficulty}:{}),clues:[...p.clues].sort((a,b)=>a.id.localeCompare(b.id)).map(c=>[c.id,c.row,c.col,c.value])});
  if(signature(raw)!==signature(official))throw Error(`Puzzle content does not match ${raw.id}.`);
  return clone(official);
}
function cleanBoard(board,puzzle) {
  if(!Array.isArray(board)||board.length>puzzle.clues.length)throw Error('Invalid saved rectangles.');
  const result=[];
  for(const rectangle of board){const checked=validateRectangle(puzzle,result,rectangle);if(!checked.ok||checked.rectangle.clueId!==rectangle.clueId)throw Error('Saved rectangles violate the puzzle rules.');result.push(checked.rectangle);}
  return result;
}
export function cleanSession(raw,puzzle) {
  if(!raw||!id(raw.id)||raw.puzzleId!==puzzle.id||raw.contentVersion!==puzzle.contentVersion||!['classic','zen'].includes(raw.mode)||!['PLAYING','PAUSED','COMPLETED'].includes(raw.status)||!time(raw.elapsedActiveMs)||!integer(raw.hintsUsed,100000)||!integer(raw.revision)||!integer(raw.startedAt)||!integer(raw.updatedAt)||raw.updatedAt<raw.startedAt)throw Error('Invalid or incompatible saved session.');
  if(raw.mode==='classic'&&puzzle.modeSource!=='curated'||raw.mode==='zen'&&!['zen-fallback','generated'].includes(puzzle.modeSource))throw Error('Session mode does not match puzzle.');
  const rectangles=cleanBoard(raw.rectangles,puzzle),completed=isComplete(puzzle,rectangles);
  if(completed!==(raw.status==='COMPLETED')||completed&&(!integer(raw.completedAt)||raw.completedAt<raw.startedAt||raw.completedAt>raw.updatedAt))throw Error('Saved completion is inconsistent.');
  function history(stack){if(!Array.isArray(stack)||stack.length>100)throw Error('Invalid move history.');return stack.map(command=>{if(!command||!['PLACE','REPLACE','REMOVE','RESTART'].includes(command.type))throw Error('Invalid history command.');return{type:command.type,before:cleanBoard(command.before,puzzle),after:cleanBoard(command.after,puzzle)};});}
  return {id:raw.id,puzzleId:puzzle.id,contentVersion:puzzle.contentVersion,mode:raw.mode,separate:raw.separate===true,status:raw.status,rectangles,undoStack:history(raw.undoStack),redoStack:history(raw.redoStack),elapsedActiveMs:raw.elapsedActiveMs,hintsUsed:raw.hintsUsed,startedAt:raw.startedAt,updatedAt:raw.updatedAt,...(completed?{completedAt:raw.completedAt}:{}),revision:raw.revision,completionCount:completed?1:0,moveTokens:Array.isArray(raw.moveTokens)?raw.moveTokens.filter(id).slice(-100):[],_storageRevision:integer(raw._storageRevision)?raw._storageRevision:0};
}
export function cleanResult(raw,sessions) {
  const session=sessions.find(s=>s.id===raw?.sessionId);
  if(!session||session.status!=='COMPLETED'||raw.id!==`result:${session.id}`||raw.puzzleId!==session.puzzleId||raw.mode!==session.mode||raw.completedAt!==session.completedAt||raw.elapsedActiveMs!==session.elapsedActiveMs||raw.hintsUsed!==session.hintsUsed)throw Error('Invalid completion record.');
  return {id:raw.id,sessionId:session.id,puzzleId:session.puzzleId,mode:session.mode,completedAt:session.completedAt,elapsedActiveMs:session.elapsedActiveMs,hintsUsed:session.hintsUsed};
}
export function resultFor(session){return{id:`result:${session.id}`,sessionId:session.id,puzzleId:session.puzzleId,mode:session.mode,completedAt:session.completedAt,elapsedActiveMs:session.elapsedActiveMs,hintsUsed:session.hintsUsed};}
