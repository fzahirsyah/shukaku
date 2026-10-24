export class ActiveTimer {
  constructor(now=()=>performance.now()){this.now=now;this.elapsed=0;this.since=null;}
  load(elapsed=0){this.elapsed=elapsed;this.since=null;}
  start(){if(this.since===null)this.since=this.now();}
  read(){return this.elapsed+(this.since===null?0:Math.max(0,this.now()-this.since));}
  checkpoint(){this.elapsed=this.read();if(this.since!==null)this.since=this.now();return this.elapsed;}
  pause(){this.elapsed=this.read();this.since=null;return this.elapsed;}
}
export function formatDuration(milliseconds){const total=Math.floor(milliseconds/1000),hours=Math.floor(total/3600),minutes=Math.floor(total/60)%60,seconds=total%60;return hours?`${hours}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`:`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;}
export function summarize(results,sessions){
  const records={};
  for(const session of sessions.filter(s=>s.mode==='classic')){records[session.puzzleId]??={attempts:0,completions:0,bestTimeMs:null,bestNoHintTimeMs:null,lastPlayedAt:0};const record=records[session.puzzleId];record.attempts++;record.lastPlayedAt=Math.max(record.lastPlayedAt,session.updatedAt);}
  for(const result of results.filter(r=>r.mode==='classic')){records[result.puzzleId]??={attempts:0,completions:0,bestTimeMs:null,bestNoHintTimeMs:null,lastPlayedAt:0};const record=records[result.puzzleId];record.completions++;record.bestTimeMs=Math.min(record.bestTimeMs??Infinity,result.elapsedActiveMs);if(!result.hintsUsed)record.bestNoHintTimeMs=Math.min(record.bestNoHintTimeMs??Infinity,result.elapsedActiveMs);}
  return {records,completedIds:Object.keys(records).filter(id=>records[id].completions>0),zenCount:results.filter(r=>r.mode==='zen').length,recent:[...results].sort((a,b)=>b.completedAt-a.completedAt).slice(0,10)};
}
