import { validatePuzzle, validateRectangle, isComplete, messages } from './validator.js';
const copy = value => JSON.parse(JSON.stringify(value));
export function createSession(puzzle, id = puzzle.id) {
  if (!validatePuzzle(puzzle)) throw new Error('Invalid puzzle definition');
  return { id, puzzleId:puzzle.id, status:'PLAYING', rectangles:[], undoStack:[], redoStack:[], revision:0, completionCount:0, moveTokens:[], hintsUsed:0 };
}
function reject(session,code) { return { session, ok:false, code, message:messages[code] || code }; }
function commit(puzzle, session, type, after, token) {
  const next=copy(session);
  next.undoStack.push({type,before:copy(session.rectangles),after:copy(after)});
  next.undoStack=next.undoStack.slice(-100);next.redoStack=[];next.rectangles=copy(after);next.revision++;
  if (token) next.moveTokens=[...next.moveTokens,token].slice(-100);
  const completed=isComplete(puzzle,next.rectangles);
  if (completed) {next.status='COMPLETED';next.completionCount=1;}
  return {ok:true,session:next,completed,code:'OK',message:completed?'Beautifully done.':messages.OK};
}
export function applyMove(puzzle, session, action) {
  if (session.status !== 'PLAYING') return reject(session,'SESSION_LOCKED');
  if (action.token && session.moveTokens.includes(action.token)) return {session,ok:false,code:'DUPLICATE',message:'This move has already been applied.'};
  if (action.type === 'PLACE' || action.type === 'REPLACE') {
    if (action.type === 'REPLACE' && !session.rectangles.some(r=>r.clueId===action.clueId)) return reject(session,'NO_REGION');
    const result=validateRectangle(puzzle,session.rectangles,action.rectangle,action.type==='REPLACE'?action.clueId:null);
    if (!result.ok) return {session,...result};
    return commit(puzzle,session,action.type,[...session.rectangles.filter(r=>r.clueId!==action.clueId),result.rectangle],action.token);
  }
  if (action.type === 'REMOVE') {
    if (!session.rectangles.some(r=>r.clueId===action.clueId)) return reject(session,'NO_REGION');
    return commit(puzzle,session,'REMOVE',session.rectangles.filter(r=>r.clueId!==action.clueId),action.token);
  }
  if (action.type === 'RESTART') return commit(puzzle,session,'RESTART',[],action.token);
  if (action.type === 'UNDO' || action.type === 'REDO') {
    const undo=action.type==='UNDO', source=undo?'undoStack':'redoStack', target=undo?'redoStack':'undoStack';
    if (!session[source].length) return reject(session,'NO_HISTORY');
    const next=copy(session), command=next[source].pop();
    next[target].push(command);next[target]=next[target].slice(-100);
    next.rectangles=copy(undo?command.before:command.after);next.revision++;
    const completed=isComplete(puzzle,next.rectangles);if(completed){next.status='COMPLETED';next.completionCount=1;}
    return {ok:true,session:next,code:'OK',completed,message:completed?'Beautifully done.':undo?'Move undone.':'Move restored.'};
  }
  return reject(session,'UNKNOWN_ACTION');
}
export function setPaused(session, paused) {
  if (session.status==='COMPLETED') return session;
  return {...session,status:paused?'PAUSED':'PLAYING'};
}
