import { tiers,tutorialBeats,tutorialPuzzle } from '../data/fixtures.js';
import { classicLevels } from '../data/classic-levels.js';
import { zenFallbackLevels } from '../data/zen-fallback-levels.js';
import { boardFingerprint,zenSizes } from '../engine/generator.js';
import { zenDifficulties } from '../engine/difficulty.js';
import { PuzzleService,CancelledError } from './puzzle-service.js';
import { validateRectangle } from '../engine/validator.js';
import { createSession,applyMove,setPaused } from '../engine/moves.js';
import { readRoute,navigate } from '../router.js';
import { openDatabase,Repository,ConflictError } from '../storage/indexeddb.js';
import { cleanPuzzle,cleanSession,cleanResult,cleanSettings,resultFor,clone } from '../storage/schema.js';
import { makeBackup,validateBackup,downloadJSON } from '../storage/backup.js';
import { ActiveTimer,formatDuration,summarize } from './timer.js';
const {ref,computed,watch,nextTick,onMounted,onBeforeUnmount}=window.Vue;
export default function useGame(){
  const catalog=[...classicLevels,...zenFallbackLevels];
  const route=ref(readRoute()),ready=ref(false),loading=ref(true),available=ref(false),saving=ref(false),storageMessage=ref(''),conflict=ref(false),owns=ref(false),busy=ref(false);
  const theme=ref('system'),reducedMotion=ref(matchMedia('(prefers-reduced-motion: reduce)').matches),sound=ref(false),highContrast=ref(false),selection=ref('both');
  const systemDark=matchMedia('(prefers-color-scheme: dark)'),tierId=ref('beginner'),tier=computed(()=>tiers.find(t=>t.id===tierId.value));
  const zenDifficulty=ref('gentle'),zenPending=ref(false),zenNotice=ref(''),generationService=new PuzzleService({deadlineMs:5500}),verificationService=new PuzzleService({deadlineMs:6000});
  let generationEpoch=0,preparedZen=null,refreshQueue=Promise.resolve();
  const zenSize=ref(5),zoom=ref(1),panMode=ref(false),tutorialStep=ref(0),sheet=ref(null),toast=ref(''),sheetElement=ref(null),heading=ref(null);
  const puzzle=ref(tutorialPuzzle),session=ref(createSession(tutorialPuzzle)),selected=ref(null),replacing=ref(null),gameMessage=ref('Draw a rectangle around one number.');
  const sessions=ref([]),results=ref([]),corruptions=ref([]),clockMs=ref(0),importPreview=ref(null),importMode=ref('merge'),importError=ref(''),resetStep=ref(1),resetWord=ref('');
  const hintResult=ref(null),hintPending=ref(false),hintStrength=ref(null),hintMode=ref('hint'),highlightedClue=ref(null),gameBoard=ref(null);
  const puzzleService=new PuzzleService();let hintEpoch=0;
  const timer=new ActiveTimer(),dirty=new Map(),dirtySettings=new Map(),durableCompletions=new Set(),temporarySessions=new Set(),knownVersions=new Map();
  let repo=null,activeGame=false,hydrating=true,trigger=null,toastTimeout,tick,heartbeat,checkpoint,routeQueue=Promise.resolve(),displayedPath=location.hash.slice(1)||'/',pendingPath=null,allowUnsaved=false,token=0,inflight=0;
  const isZen=computed(()=>route.value.mode==='zen'),summary=computed(()=>summarize(results.value,sessions.value)),completedIds=computed(()=>summary.value.completedIds);
  const availableLevels=computed(()=>classicLevels.filter(level=>level.difficulty===tierId.value)),completedCount=computed(()=>availableLevels.value.filter(p=>completedIds.value.includes(p.id)).length);
  const levelNumber=computed(()=>classicLevels.findIndex(level=>level.id===puzzle.value.id)+1);
  const pageTitle=computed(()=>({classic:'CLASSIC',zen:'ZEN',settings:'SETTINGS',stats:'MY PROGRESS','how-to-play':'HOW TO PLAY',game:isZen.value?'ZEN':`LEVEL ${String(levelNumber.value||1).padStart(2,'0')}`})[route.value.name]||'SHIKAKU.');
  const covered=computed(()=>Math.round(session.value.rectangles.reduce((sum,r)=>sum+r.height*r.width,0)/(puzzle.value.rows*puzzle.value.cols)*100));
  const nextLevel=computed(()=>classicLevels[classicLevels.findIndex(p=>p.id===puzzle.value.id)+1]);
  const lesson=computed(()=>tutorialBeats[tutorialStep.value]),tutorialCanNext=computed(()=>tutorialStep.value===2?session.value.rectangles.some(r=>r.clueId==='t4-0'):tutorialStep.value===4?session.value.status==='COMPLETED':true);
  const resumable=computed(()=>sessions.value.filter(s=>s.status!=='COMPLETED').sort((a,b)=>b.updatedAt-a.updatedAt));
  const continueSession=computed(()=>resumable.value[0]),zenContinue=computed(()=>resumable.value.find(s=>s.mode==='zen'));
  const currentRecord=computed(()=>summary.value.records[puzzle.value.id]);
  const newBest=computed(()=>!isZen.value&&session.value.status==='COMPLETED'&&!results.value.some(r=>r.mode==='classic'&&r.puzzleId===session.value.puzzleId&&r.sessionId!==session.value.id&&r.elapsedActiveMs<=session.value.elapsedActiveMs));
  const saveLabel=computed(()=>conflict.value?'Another tab is editing':!available.value?'Temporary play · not saved':saving.value?'Saving…':storageMessage.value?'Not saved yet':'Saved on this device');
  const backupCounts=computed(()=>importPreview.value?{sessions:importPreview.value.sessions.length,results:importPreview.value.results.length,newSessions:importPreview.value.sessions.filter(s=>!sessions.value.some(old=>old.id===s.id)).length}:null);
  function settings(){return{theme:theme.value,reducedMotion:reducedMotion.value,sound:sound.value,highContrast:highContrast.value,selection:selection.value};}
  function applySettings(values){hydrating=true;const data=cleanSettings(values);for(const [key,target]of Object.entries({theme,reducedMotion,sound,highContrast,selection}))if(key in data)target.value=data[key];nextTick(()=>{hydrating=false;});}
  function applyTheme(){document.documentElement.dataset.theme=theme.value==='system'?(systemDark.matches?'dark':'light'):theme.value;document.querySelector('meta[name="theme-color"]').content=document.documentElement.dataset.theme==='dark'?'#152227':'#f7f7f2';}
  watch(theme,applyTheme,{immediate:true});watch(reducedMotion,value=>{document.documentElement.dataset.reducedMotion=String(value);},{immediate:true});watch(highContrast,value=>{document.documentElement.style.setProperty('--region-outline',value?'var(--ink)':'');});watch(zoom,value=>{if(value<=1)panMode.value=false;});
  for(const [key,target]of Object.entries({theme,reducedMotion,sound,highContrast,selection}))watch(target,value=>{if(ready.value&&!hydrating)savePreference(key,value);});
  function notify(message){toast.value=message;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>{toast.value='';},4200);}
  function upsert(value){sessions.value=[...sessions.value.filter(s=>s.id!==value.id),clone(value)];}
  function addResult(value){if(!results.value.some(r=>r.id===value.id))results.value=[...results.value,value];}
  function snapshot(){const value=clone(session.value);value.updatedAt=Math.max(Date.now(),value.startedAt||0,value.completedAt||0);value.elapsedActiveMs=session.value.mode==='classic'?timer.read():0;if(value.status==='COMPLETED')value.elapsedActiveMs=session.value.elapsedActiveMs;return value;}
  function fail(error){if(error instanceof ConflictError){setConflict(error.message);return;}storageMessage.value=available.value?'This move or preference is not saved yet. Retry or export a backup.':'Local saving is unavailable. You can play temporarily and export a backup.';}
  function updateSaved(){saving.value=inflight>0;if(!inflight&&!dirty.size&&!dirtySettings.size&&available.value)storageMessage.value='';}
  async function persist(value=snapshot()){
    upsert(value);if(value.status==='COMPLETED'&&durableCompletions.has(value.id)&&!repo?.held.has(value.id))return true;dirty.set(value.id,value);
    if(!repo||!available.value)return false;
    if(!repo.held.has(value.id)&&temporarySessions.has(value.id))return false;
    if(!repo.held.has(value.id)){setConflict('This tab no longer owns the saved session.');return false;}
    inflight++;saving.value=true;
    try{const revision=await repo.save(value);knownVersions.set(value.id,revision);if(dirty.get(value.id)===value)dirty.delete(value.id);const local=sessions.value.find(s=>s.id===value.id);if(local)local._storageRevision=revision;if(session.value.id===value.id)session.value._storageRevision=revision;if(value.status==='COMPLETED'){durableCompletions.add(value.id);await repo.release(value.id);if(session.value.id===value.id)owns.value=false;}return true;}
    catch(error){fail(error);return false;}finally{inflight--;updateSaved();}
  }
  async function savePreference(key,value){
    const mark={value};dirtySettings.set(key,mark);if(!repo||!available.value){fail(Error());return;}
    inflight++;saving.value=true;try{await repo.setting(key,value);if(dirtySettings.get(key)===mark)dirtySettings.delete(key);}catch(error){fail(error);}finally{inflight--;updateSaved();}
  }
  function ingest(raw,{preferences=false,invalidPuzzles=[]}={}){
    const valid=[],bad=invalidPuzzles.map(item=>({record:item.puzzle,error:item.reason})),invalidIds=new Set(invalidPuzzles.map(item=>item.puzzle.id));
    for(const record of raw.sessions){try{const definition=catalog.find(p=>p.id===record.puzzleId);if(!definition||invalidIds.has(record.puzzleId))throw Error('Missing or unverified puzzle definition.');valid.push(cleanSession(record,definition));}catch(error){bad.push({record,error:error.message});}}
    const records=[];for(const result of raw.results){try{records.push(cleanResult(result,valid));}catch(error){bad.push({record:result,error:error.message});}}
    for(const value of dirty.values()){const index=valid.findIndex(s=>s.id===value.id);if(index>=0)valid.splice(index,1);valid.push(clone(value));if(value.status==='COMPLETED'&&!records.some(r=>r.sessionId===value.id))records.push(resultFor(value));}
    if(activeGame&&!conflict.value&&!dirty.has(session.value.id)){const index=valid.findIndex(s=>s.id===session.value.id);if(index>=0)valid[index]=clone(session.value);}
    for(const record of records)if(!dirty.has(record.sessionId))durableCompletions.add(record.sessionId);
    sessions.value=valid;results.value=records;corruptions.value=bad;
    if(preferences)applySettings(Object.fromEntries(raw.settings.map(s=>[s.key,s.value])));
  }
  async function registerDefinitions(puzzles,{strict=false}={}){
    const unknown=[],invalid=[];
    for(const definition of puzzles){
      if(catalog.some(p=>p.id===definition?.id)){
        try{cleanPuzzle(definition,catalog);}catch(error){invalid.push({puzzle:definition,reason:error.message});}
      }else if(definition?.modeSource==='generated')unknown.push(definition);
      else invalid.push({puzzle:definition,reason:'Unsupported puzzle definition.'});
    }
    if(unknown.length){
      const verified=await verificationService.request('verify-generated',{puzzles:unknown,budget:{maxMs:4000,maxWork:6000000}});
      for(const definition of verified.accepted||[])if(!catalog.some(p=>p.id===definition.id))catalog.push(definition);
      for(const definition of unknown)if(!catalog.some(p=>p.id===definition.id))invalid.push({puzzle:definition,reason:'Generated puzzle could not be verified. Retry with worker support and keep a recovery backup.'});
    }
    if(strict&&invalid.length)throw Error(invalid[0].reason);
    return invalid;
  }
  function refresh(preferences=false){
    const pending=refreshQueue.catch(()=>{}).then(async()=>{if(!repo)return;const raw=await repo.snapshot();const invalidPuzzles=await registerDefinitions(raw.puzzles);ingest(raw,{preferences,invalidPuzzles});});
    refreshQueue=pending;return pending;
  }
  function puzzleSize(puzzleId){const definition=catalog.find(p=>p.id===puzzleId);return definition?`${definition.rows}×${definition.cols}`:'Saved puzzle';}
  function cancelGeneration({leave=false}={}){generationEpoch++;generationService.cancel();zenPending.value=false;preparedZen=null;zenNotice.value='';if(leave&&route.value.name==='game'&&loading.value)navigate('/zen');}
  async function generateZen(){
    const epoch=++generationEpoch;zenPending.value=true;zenNotice.value='Finding a puzzle with one solution…';
    const size=zenSize.value,difficulty=zenDifficulty.value,requestedPath=location.hash;
    try{
      const response=await generationService.request('generate',{parameters:{size,difficulty,seed:crypto.randomUUID(),exclude:catalog.filter(p=>p.modeSource!=='curated').map(boardFingerprint).slice(-2000)}});
      if(epoch!==generationEpoch||document.hidden||location.hash!==requestedPath)throw new CancelledError();
      if(response.status==='READY'){
        const definition=response.puzzle;
        // Worker output alone can enter the in-memory canonical registry.
        const previous=catalog.find(p=>p.id===definition.id);
        if(previous)cleanPuzzle(definition,catalog);else catalog.push(definition);
        zenNotice.value='';return definition;
      }
      const unused=zenFallbackLevels.filter(p=>!sessions.value.some(s=>s.puzzleId===p.id));
      const pool=unused.length?unused:zenFallbackLevels;
      const definition=pool[sessions.value.filter(s=>s.mode==='zen').length%pool.length];
      zenNotice.value=`Opening a ready-made ${definition.rows}×${definition.cols} puzzle${unused.length?'':" you’ve played before"}. ${size!==definition.rows?`The requested ${size}×${size} puzzle wasn’t available. `:''}It may differ from your chosen difficulty.`;
      return definition;
    }finally{if(epoch===generationEpoch)zenPending.value=false;}
  }
  async function startZen(){
    if(zenPending.value||loading.value)return;
    try{preparedZen=await generateZen();go('/play/zen/new');}catch(error){if(!(error instanceof CancelledError)){zenNotice.value='Could not open a puzzle. Please try again.';}}
  }
  async function initializeStorage(){
    try{repo=new Repository(await openDatabase());await repo.seed(catalog);available.value=true;await refresh(true);repo.onchange=async event=>{
      if(['imported','reset'].includes(event.type)){if(activeGame)setConflict('Local data changed in another tab. Reload the current save.');}
      else if(event.type==='saved'&&activeGame&&event.id===session.value.id&&owns.value)setConflict('A newer save exists in another tab.');
      try{await refresh(event.type==='settings');}catch(error){fail(error);}
    };return true;}catch(error){repo?.close();repo=null;available.value=false;fail(error);return false;}
  }
  function pauseClock(){if(!activeGame)return;const elapsed=timer.pause();clockMs.value=elapsed;if(session.value.status!=='COMPLETED'){session.value={...session.value,elapsedActiveMs:session.value.mode==='classic'?elapsed:0,status:'PAUSED'};upsert(session.value);}}
  function resumeClock(){if(activeGame&&session.value.status!=='COMPLETED'&&!conflict.value&&!document.hidden){session.value=setPaused(session.value,false);if(session.value.mode==='classic')timer.start();}}
  function setConflict(message){cancelHints(true);pauseClock();if(dirty.has(session.value.id))storageMessage.value='This board has unsaved changes from a conflicting tab. Export a backup or start a separate session.';conflict.value=true;owns.value=false;gameMessage.value=message;sheet.value='conflict';nextTick(()=>sheetElement.value?.querySelector('button')?.focus());}
  async function openSheet(name){if(name==='hint'){cancelHints(true);hintMode.value='hint';hintStrength.value=null;}trigger=document.activeElement;if(name==='reset'){resetStep.value=1;resetWord.value='';}if(activeGame&&session.value.status==='PLAYING'){pauseClock();persist();}sheet.value=name;await nextTick();sheetElement.value?.querySelector('button, input, [tabindex]')?.focus();}
  async function closeSheet(){if(busy.value||['conflict','leave-failed'].includes(sheet.value))return;if(sheet.value==='hint')cancelHints();sheet.value=null;resumeClock();if(activeGame)persist();await nextTick();if(trigger?.isConnected)trigger.focus();else heading.value?.focus();}
  function go(path){if(busy.value)return;navigate(path);}
  function sessionPath(value){return value.mode==='zen'?`/play/zen/${value.id}`:`/play/classic/${value.puzzleId}${value.separate?'/'+value.id:''}`;}
  function newSession(definition,mode,{separate=false}={}){const now=Date.now();return{...createSession(definition,'session-'+crypto.randomUUID()),mode,separate,contentVersion:definition.contentVersion,elapsedActiveMs:0,startedAt:now,updatedAt:now};}
  async function attach(proposed,{fresh=false,separate=false}={}){
    puzzle.value=catalog.find(p=>p.id===proposed.puzzleId);session.value=clone(proposed);conflict.value=false;owns.value=false;
    let chosen=proposed;
    if(repo&&available.value&&proposed.status!=='COMPLETED'){
      try{chosen=cleanSession(await repo.claim(proposed,{puzzle:puzzle.value,separate,skipIds:corruptions.value.map(item=>item.record?.id).filter(Boolean),validate:record=>cleanSession(record,puzzle.value)}),puzzle.value);knownVersions.set(chosen.id,chosen._storageRevision);owns.value=true;}catch(error){if(error instanceof ConflictError){session.value=proposed;timer.load(proposed.elapsedActiveMs);setConflict(error.message);return;}temporarySessions.add(proposed.id);fail(error);}
    }
    session.value=chosen;upsert(chosen);timer.load(chosen.elapsedActiveMs);clockMs.value=chosen.elapsedActiveMs;
    if(chosen.status==='COMPLETED')sheet.value='result';
    else if(fresh&&chosen.id===proposed.id){session.value=setPaused(chosen,false);if(session.value.mode==='classic'&&!document.hidden)timer.start();if(document.hidden){pauseClock();sheet.value='options';}await persist();}
    else{session.value=setPaused(chosen,true);sheet.value='options';await persist();}
  }
  async function loadGame(target){
    const requestedPath=location.hash;
    if(repo)try{await refresh();}catch(error){fail(error);}
    if(location.hash!==requestedPath)throw new CancelledError();
    let definition,existing,mode=target.mode;
    if(mode==='classic'){
      definition=classicLevels.find(p=>p.id===target.id);if(!definition)throw Error('That level is unavailable.');
      const levels=classicLevels.filter(p=>p.difficulty===definition.difficulty),index=levels.findIndex(p=>p.id===definition.id);
      if(index>0&&!completedIds.value.includes(levels[index-1].id)&&!completedIds.value.includes(definition.id)&&!target.attempt)throw Error('Finish the previous level to unlock this puzzle.');
      existing=target.attempt?sessions.value.find(s=>s.id===target.attempt&&s.puzzleId===definition.id&&s.mode===mode):sessions.value.filter(s=>s.puzzleId===definition.id&&s.mode===mode&&!s.separate).sort((a,b)=>b.updatedAt-a.updatedAt).find(s=>s.status!=='COMPLETED');
      if(target.attempt&&!existing)throw Error('That saved attempt is unavailable.');
      
    }else if(target.id==='new'||target.id.startsWith('ready-made')){definition=preparedZen||await generateZen();preparedZen=null;}
    else{existing=sessions.value.find(s=>s.id===target.id&&s.mode==='zen');if(!existing)throw Error('That Zen session could not be restored.');definition=catalog.find(p=>p.id===existing.puzzleId);zenNotice.value=definition?.modeSource==='zen-fallback'?`A ready-made ${definition.rows}×${definition.cols} puzzle${sessions.value.some(s=>s.id!==existing.id&&s.puzzleId===definition.id)?' you’ve played before':''}.`:'';}
    if(location.hash!==requestedPath||document.hidden&&target.mode==='zen'&&!existing)throw new CancelledError();
    activeGame=true;const proposed=existing||newSession(definition,mode);await attach(proposed,{fresh:!existing,separate:proposed.separate});
    if(mode==='zen'&&target.id!==session.value.id){target.id=session.value.id;history.replaceState(null,'',location.pathname+location.search+'#'+sessionPath(session.value));}
  }
  async function handleRoute(){
    cancelHints(true);
    const target=readRoute(),targetPath=location.hash.slice(1)||'/';loading.value=true;
    if(activeGame){pauseClock();const ok=conflict.value?false:await persist();if(!ok&&!allowUnsaved&&!conflict.value){pendingPath=targetPath;history.replaceState(null,'',location.pathname+location.search+'#'+displayedPath);loading.value=false;sheet.value='leave-failed';nextTick(()=>sheetElement.value?.querySelector('button')?.focus());return;}await repo?.release(session.value.id).catch(fail);}
    activeGame=false;owns.value=false;allowUnsaved=false;conflict.value=false;clearTimeout(toastTimeout);toast.value='';route.value=target;zoom.value=1;panMode.value=false;selected.value=null;replacing.value=null;sheet.value=null;gameMessage.value='Draw a rectangle around one number.';
    try{
      if(target.name==='game')await loadGame(target);
      else if(target.name==='how-to-play'){puzzle.value=tutorialPuzzle;session.value=createSession(tutorialPuzzle);tutorialStep.value=0;}
      else if(repo)await refresh();
    }catch(error){if(error instanceof CancelledError){if((location.hash.slice(1)||'/')===targetPath)navigate('/zen');loading.value=false;return;}activeGame=false;await repo?.release(session.value.id).catch(()=>{});notify(error.message);route.value={name:'home'};history.replaceState(null,'',location.pathname+location.search+'#/');}
    if(target.unknown){history.replaceState(null,'',location.pathname+location.search+'#/');notify('That page could not be found. Welcome home.');}
    displayedPath=location.hash.slice(1)||'/';loading.value=false;document.title=`${pageTitle.value} — SHIKAKU.`;
    await nextTick();window.scrollTo(0,0);if(sheet.value)sheetElement.value?.querySelector('button')?.focus();else heading.value?.focus();
  }
  function scheduleRoute(){if(zenPending.value)cancelGeneration();const target=readRoute();if(target.name!=='game'||target.mode!=='zen'||target.id!=='new')preparedZen=null;routeQueue=routeQueue.catch(()=>{}).then(handleRoute);}
  async function move(action,{fromHint=false}={}){
    if(loading.value||conflict.value||(sheet.value&&!fromHint)||(fromHint&&sheet.value!=='hint'))return false;
    if(!fromHint)cancelHints(true);
    const source=fromHint&&session.value.status==='PAUSED'?{...session.value,status:'PLAYING'}:session.value;
    const result=applyMove(puzzle.value,source,{...action,token:'move-'+crypto.randomUUID()+'-'+(++token)});gameMessage.value=result.message;if(!result.ok)return false;
    if(fromHint){result.session.hintsUsed++;if(!result.completed)result.session.status='PAUSED';}
    session.value=result.session;selected.value=null;replacing.value=null;
    if(route.value.name==='how-to-play'){if(result.completed)tutorialStep.value=5;return true;}
    session.value.elapsedActiveMs=session.value.mode==='classic'?timer.read():0;session.value.updatedAt=Math.max(Date.now(),session.value.startedAt);
    if(result.completed){session.value.elapsedActiveMs=session.value.mode==='classic'?timer.pause():0;clockMs.value=session.value.elapsedActiveMs;session.value.completedAt=Math.max(Date.now(),session.value.startedAt);session.value.updatedAt=session.value.completedAt;addResult(resultFor(session.value));upsert(session.value);sheet.value='result';nextTick(()=>sheetElement.value?.querySelector('button')?.focus());}
    await persist();return true;
  }
  function place(rectangle){move({type:replacing.value?'REPLACE':'PLACE',rectangle,clueId:replacing.value});}
  function selectRegion(id){selected.value=id;replacing.value=null;gameMessage.value='Rectangle selected. Change or remove it.';}
  function changeRegion(){replacing.value=selected.value;gameMessage.value='Choose two new corners for this number. The old rectangle stays until a valid replacement.';}
  function cancelSelection(){selected.value=null;replacing.value=null;}
  async function restart(){
    cancelHints(true);
    if(busy.value||conflict.value)return;
    if(route.value.name==='how-to-play'){session.value=createSession(tutorialPuzzle);tutorialStep.value=0;sheet.value=null;return;}
    pauseClock();
    if(session.value.status==='COMPLETED'){
      await repo?.release(session.value.id).catch(fail);const proposed=newSession(puzzle.value,session.value.mode,{separate:session.value.separate});sheet.value=null;await attach(proposed,{fresh:true,separate:proposed.separate});
      if(proposed.mode==='zen'||proposed.separate){route.value.id=proposed.mode==='zen'?session.value.id:route.value.id;history.replaceState(null,'',location.pathname+location.search+'#'+sessionPath(session.value));displayedPath=location.hash.slice(1);}
    }else{
      const oldSheet=sheet.value;sheet.value=null;session.value=setPaused(session.value,false);await move({type:'RESTART'});if(oldSheet)await closeSheet();else resumeClock();
    }
    zoom.value=1;panMode.value=false;selected.value=null;replacing.value=null;gameMessage.value='A fresh start. Draw a rectangle around one number.';
  }
  function requestRestart(){if(session.value.rectangles.length)openSheet('restart');else restart();}
  function chooseLevel(index){const level=availableLevels.value[index-1];if(!level)return;const previous=availableLevels.value[index-2];if(previous&&!completedIds.value.includes(previous.id)&&!completedIds.value.includes(level.id)){notify(`Finish Level ${String(index-1).padStart(2,'0')} to unlock.`);return;}go(`/play/classic/${level.id}`);}
  function getLevelClass(index){const p=availableLevels.value[index-1];return completedIds.value.includes(p?.id)?'completed':index===1||completedIds.value.includes(availableLevels.value[index-2]?.id)?'next':'locked';}
  function activeLevel(id){return sessions.value.some(s=>s.puzzleId===id&&s.mode==='classic'&&s.status!=='COMPLETED');}
  function selectTier(id){tierId.value=id;}
  function tierKey(event,index){const direction=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;if(!direction&&!['Home','End'].includes(event.key))return;event.preventDefault();const target=event.key==='Home'?0:event.key==='End'?tiers.length-1:(index+direction+tiers.length)%tiers.length;selectTier(tiers[target].id);nextTick(()=>document.getElementById('tier-'+tiers[target].id)?.focus());}
  function sheetKey(event){if(event.key==='Escape'&&!['reset','import','conflict','leave-failed'].includes(sheet.value)){event.preventDefault();closeSheet();}if(event.key!=='Tab')return;const items=[...sheetElement.value.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]')],first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  function cancelHints(clear=false){hintEpoch++;puzzleService.cancel();hintPending.value=false;if(clear){hintResult.value=null;highlightedClue.value=null;}}
  function unavailableHint(){return{status:'UNAVAILABLE',title:'A little more room to think',message:'Hint is unavailable for this position. You can try again or undo a move.'};}
  async function runAnalysis(strength='nudge',kind='hint'){
    if(hintPending.value||conflict.value||loading.value||sheet.value!=='hint'||session.value.status==='COMPLETED')return;
    const epoch=++hintEpoch,id=session.value.id,revision=session.value.revision,puzzleId=puzzle.value.id;
    hintMode.value=kind;hintStrength.value=strength;hintResult.value=null;highlightedClue.value=null;hintPending.value=true;
    try{
      const response=await puzzleService.request(kind,{puzzle:clone(puzzle.value),rectangles:clone(session.value.rectangles),strength});
      if(epoch!==hintEpoch||sheet.value!=='hint'||id!==session.value.id||revision!==session.value.revision||puzzleId!==puzzle.value.id||conflict.value||loading.value||document.hidden)return;
      hintResult.value=response?.message?response:unavailableHint();
      highlightedClue.value=response?.clueId||null;
      if(response.status==='READY'&&kind==='hint'){
        if(strength==='reveal'){
          const valid=validateRectangle(puzzle.value,session.value.rectangles,response.rectangle);
          if(!valid.ok||valid.rectangle.clueId!==response.clueId){hintResult.value=unavailableHint();highlightedClue.value=null;return;}
          const committed=await move({type:'PLACE',rectangle:response.rectangle},{fromHint:true});
          if(committed&&sheet.value==='hint'&&!conflict.value){gameMessage.value='A forced rectangle was revealed. You can undo it.';await closeSheet();}
          else if(!committed)hintResult.value=unavailableHint();
        }else{
          session.value={...session.value,hintsUsed:session.value.hintsUsed+1};
          if(activeGame)await persist();
        }
      }
    }catch(error){if(!(error instanceof CancelledError)&&epoch===hintEpoch)hintResult.value=unavailableHint();}
    finally{if(epoch===hintEpoch)hintPending.value=false;}
  }
  async function openBoardCheck(){await openSheet('hint');await runAnalysis('nudge','check');}
  async function showHintOnBoard(){const clue=highlightedClue.value;await closeSheet();await nextTick();if(clue)gameBoard.value?.focusClue(clue);}
  async function reviewHint(){const clue=hintResult.value?.clueId;if(clue){selected.value=clue;replacing.value=null;}await showHintOnBoard();}
  function nextPuzzle(){go(isZen.value?'/zen':nextLevel.value?`/play/classic/${nextLevel.value.id}`:'/classic');}
  function tutorialNext(){if(tutorialStep.value<5&&tutorialCanNext.value)tutorialStep.value++;else if(tutorialStep.value===5)go('/classic');}
  async function retrySave(){
    busy.value=true;try{if(!repo&&!await initializeStorage())return;
      for(const value of [...dirty.values()]){if(!repo.held.has(value.id)){const definition=catalog.find(p=>p.id===value.puzzleId);const claimed=await repo.claim(value,{puzzle:definition,separate:value.separate,validate:record=>cleanSession(record,catalog.find(p=>p.id===value.puzzleId))});if(claimed.id!==value.id || claimed._storageRevision-1 !== (knownVersions.get(value.id) ?? value._storageRevision ?? 0)){await repo.release(claimed.id);throw new ConflictError('A newer save exists. Reload it or start a separate attempt.');}knownVersions.set(value.id,claimed._storageRevision);temporarySessions.delete(value.id);}await persist(value);if(!activeGame||value.id!==session.value.id)await repo.release(value.id);}
      for(const [key,mark]of [...dirtySettings])await savePreference(key,mark.value);updateSaved();
    }catch(error){fail(error);}finally{busy.value=false;if(!dirty.size&&!dirtySettings.size&&sheet.value==='leave-failed'&&pendingPath){const path=pendingPath;pendingPath=null;sheet.value=null;navigate(path);}}
  }
  async function exportSave(){
    if(activeGame){if(session.value.status!=='COMPLETED'){session.value.elapsedActiveMs=session.value.mode==='classic'?timer.checkpoint():0;upsert(session.value);}await persist();}
    const used=catalog.filter(p=>sessions.value.some(s=>s.puzzleId===p.id));
    const data=makeBackup(used,sessions.value,results.value,settings());
    try{validateBackup(data,catalog);downloadJSON(data,'shikaku-save-'+new Date().toISOString().slice(0,10)+'.json');notify('Backup downloaded.');}catch(error){notify('Some local data needs recovery. Export the recovery file instead.');}
  }
  async function requestPersistence(){try{const granted=await navigator.storage?.persist?.();notify(granted?'Browser protection enabled. Clearing browser data can still remove saves.':'Browser protection was not granted. Keep an exported backup.');}catch{notify('Browser protection is unavailable. Keep an exported backup.');}}
  function exportRecovery(){downloadJSON({recoveryFormatVersion:1,exportedAt:Date.now(),records:corruptions.value},'shikaku-recovery.json');}
  async function selectImport(event){
    const file=event.target.files?.[0];event.target.value='';if(!file)return;importError.value='';
    try{if(file.size>5*1024*1024)throw Error('Backup must be smaller than 5 MB.');const input=JSON.parse(await file.text());if(!Array.isArray(input?.puzzles)||input.puzzles.length>1000)throw Error('Unsupported backup size.');busy.value=true;await registerDefinitions(input.puzzles,{strict:true});importPreview.value=validateBackup(input,catalog);importMode.value='merge';resetWord.value='';await openSheet('import');}
    catch(error){importError.value=error.message;notify('This backup cannot be imported. '+error.message);}finally{busy.value=false;}
  }
  async function applyImport(){
    if(!available.value||!repo||!importPreview.value)return;
    if(importMode.value==='replace'&&resetWord.value!=='REPLACE'){importError.value='Type REPLACE to confirm replacing local data.';return;}
    busy.value=true;try{await repo.importData(importPreview.value,importMode.value);dirty.clear();dirtySettings.clear();durableCompletions.clear();activeGame=false;await refresh(importMode.value==='replace');importPreview.value=null;sheet.value=null;storageMessage.value='';notify('Backup imported.');}
    catch(error){importError.value=error.message;}finally{busy.value=false;}
  }
  async function resetData(){
    if(resetStep.value===1){resetStep.value=2;await nextTick();sheetElement.value?.querySelector('input')?.focus();return;}
    if(resetWord.value!=='RESET'||!repo)return;
    busy.value=true;try{for(const id of [...repo.held.keys()])await repo.release(id);await repo.clear();catalog.splice(0,catalog.length,...classicLevels,...zenFallbackLevels);await repo.seed(catalog);dirty.clear();dirtySettings.clear();durableCompletions.clear();sessions.value=[];results.value=[];corruptions.value=[];activeGame=false;applySettings({theme:'system',reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,sound:false,highContrast:false,selection:'both'});sheet.value=null;storageMessage.value='';notify('Local progress reset.');}
    catch(error){notify(error.message);}finally{busy.value=false;}
  }
  async function reloadConflict(){busy.value=true;try{await repo?.release(session.value.id);dirty.delete(session.value.id);activeGame=false;conflict.value=false;await refresh();await loadGame(route.value);}catch(error){setConflict(error.message);}finally{busy.value=false;}}
  async function separateSession(){
    const oldId=session.value.id;busy.value=true;
    try{await repo?.release(oldId);const proposed={...newSession(puzzle.value,session.value.mode,{separate:true}),rectangles:clone(session.value.rectangles),undoStack:clone(session.value.undoStack),redoStack:clone(session.value.redoStack),elapsedActiveMs:session.value.elapsedActiveMs,hintsUsed:session.value.hintsUsed,revision:session.value.revision};dirty.delete(oldId);sheet.value=null;conflict.value=false;await attach(proposed,{fresh:true,separate:true});if(!conflict.value){history.replaceState(null,'',location.pathname+location.search+'#'+sessionPath(session.value));displayedPath=location.hash.slice(1);if(session.value.mode==='zen')route.value.id=session.value.id;else route.value.attempt=session.value.id;}}
    catch(error){setConflict(error.message);}finally{busy.value=false;}
  }
  function leaveTemporary(){allowUnsaved=true;sheet.value=null;navigate(pendingPath||'/');pendingPath=null;}
  function stayHere(){pendingPath=null;openSheet('options');}
  function onVisibility(){if(document.hidden){cancelHints(true);if(zenPending.value)cancelGeneration();}if(document.hidden&&activeGame&&session.value.status==='PLAYING'){pauseClock();persist();sheet.value='options';} }
  function onPageHide(){cancelHints(true);if(zenPending.value)cancelGeneration();if(activeGame){pauseClock();persist().finally(()=>repo?.release(session.value.id));}}
  onMounted(async()=>{await initializeStorage();hydrating=false;ready.value=true;window.addEventListener('hashchange',scheduleRoute);document.addEventListener('visibilitychange',onVisibility);window.addEventListener('pagehide',onPageHide);systemDark.addEventListener('change',applyTheme);routeQueue=handleRoute();await routeQueue;
    tick=setInterval(()=>{clockMs.value=timer.read();},250);
    checkpoint=setInterval(()=>{if(activeGame&&session.value.status==='PLAYING'&&!conflict.value){session.value.elapsedActiveMs=session.value.mode==='classic'?timer.checkpoint():0;persist();}},15000);
    heartbeat=setInterval(()=>{repo?.renew().catch(fail);},5000);
  });
  onBeforeUnmount(()=>{generationService.close();verificationService.close();puzzleService.close();clearInterval(tick);clearInterval(checkpoint);clearInterval(heartbeat);clearTimeout(toastTimeout);window.removeEventListener('hashchange',scheduleRoute);document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('pagehide',onPageHide);systemDark.removeEventListener('change',applyTheme);repo?.close();});
  return {zenSizes,zenDifficulties,zenDifficulty,zenPending,zenNotice,startZen,cancelGeneration,puzzleSize,route,ready,loading,available,saving,storageMessage,conflict,owns,busy,theme,reducedMotion,sound,highContrast,selection,tierId,tier,tiers,zenSize,zoom,panMode,tutorialStep,sheet,toast,sheetElement,heading,isZen,pageTitle,covered,gameMessage,completedCount,lesson,tutorialCanNext,go,notify,openSheet,closeSheet,chooseLevel,selectTier,tierKey,sheetKey,getLevelClass,puzzle,session,selected,replacing,availableLevels,nextLevel,completedIds,move,place,selectRegion,changeRegion,cancelSelection,restart,requestRestart,nextPuzzle,tutorialNext,sessions,results,summary,continueSession,zenContinue,currentRecord,newBest,clockMs,formatDuration,sessionPath,saveLabel,activeLevel,retrySave,exportSave,exportRecovery,corruptions,selectImport,importPreview,importMode,importError,backupCounts,resetStep,resetWord,applyImport,resetData,reloadConflict,separateSession,leaveTemporary,stayHere,classicLevels,requestPersistence,hintResult,hintPending,hintStrength,hintMode,highlightedClue,gameBoard,runAnalysis,cancelHints,openBoardCheck,showHintOnBoard,reviewHint};
}
