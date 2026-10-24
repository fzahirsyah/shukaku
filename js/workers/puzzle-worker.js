import {solveSteps} from '../engine/solver.js';
import {analyzeSteps} from '../engine/hint-engine.js';
import {generateSteps,verifyGeneratedSteps} from '../engine/generator.js';
let current=null;
function unknown(reason){return{status:'UNKNOWN',count:0,solution:null,reason};}
self.onmessage=event=>{
  const request=event.data;
  if(request?.type==='cancel'){if(current?.id===request.id)current.cancelled=true;return;}
  if(!request||typeof request.id!=='string'||!['solve','hint','check','generate','verify-generated'].includes(request.type)){if(request?.id)self.postMessage({id:request.id,result:unknown('INVALID_REQUEST')});return;}
  if(current)current.cancelled=true;
  const task={id:request.id,cancelled:false};current=task;
  const input=request.budget||{},bounded=(value,fallback,max)=>Number.isFinite(value)?Math.max(0,Math.min(max,value)):fallback;
  const generation=['generate','verify-generated'].includes(request.type);
  const budget={now:()=>performance.now(),maxMs:bounded(input.maxMs,generation?2800:1600,generation?4000:3000),maxNodes:bounded(input.maxNodes,generation?200000:100000,200000),maxWork:bounded(input.maxWork,generation?6000000:1000000,generation?6000000:3000000),isCancelled:()=>task.cancelled};
  const iterator=request.type==='generate'?generateSteps(request.parameters,budget):request.type==='verify-generated'?verifyGeneratedSteps(request.puzzles,budget):request.type==='solve'?solveSteps(request.puzzle,request.rectangles||[],budget):analyzeSteps(request.puzzle,request.rectangles||[],{...budget,kind:request.type,strength:request.strength});
  function pump(){
    try{
      const slice=performance.now();let next;
      do{next=iterator.next();if(next.done){if(current===task)current=null;self.postMessage({id:task.id,result:next.value});return;}}while(performance.now()-slice<6);
      setTimeout(pump,0);
    }catch{if(current===task)current=null;self.postMessage({id:task.id,result:unknown('WORKER_ERROR')});}
  }
  pump();
};
