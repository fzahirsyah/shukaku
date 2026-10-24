// Bump the release version whenever a precached application resource changes.
// A replacement activates naturally after all old game tabs close; no skipWaiting.
const VERSION='release-2026-10-24-5';
const ROOT=new URL('./',self.location.href);
const PREFIX='shikaku-shell-'+encodeURIComponent(ROOT.pathname)+'-';
const CACHE=PREFIX+VERSION;
const ASSETS=[
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/base.css",
  "css/desktop.css",
  "css/mobile.css",
  "css/motion.css",
  "css/tokens.css",
  "js/app.js",
  "js/components/icon.js",
  "js/components/keyboard-guide.js",
  "js/components/puzzle-board.js",
  "js/data/classic-levels.js",
  "js/data/fixtures.js",
  "js/data/zen-fallback-levels.js",
  "js/engine/difficulty.js",
  "js/engine/generator.js",
  "js/engine/hint-engine.js",
  "js/engine/moves.js",
  "js/engine/seeded-random.js",
  "js/engine/solver.js",
  "js/engine/validator.js",
  "js/router.js",
  "js/state/definition-verifier.js",
  "js/state/offline.js",
  "js/state/puzzle-service.js",
  "js/state/timer.js",
  "js/state/use-game.js",
  "js/storage/backup.js",
  "js/storage/indexeddb.js",
  "js/storage/schema.js",
  "js/workers/puzzle-worker.js",
  "assets/favicon.svg",
  "assets/app-icon.svg",
  "assets/icon-32.png",
  "assets/icon-180.png",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/icon-maskable-512.png",
  "assets/sakura-branch.svg",
  "vendor/vue.global.prod.js"
].map(path=>new URL(path,ROOT).href);
const APP_ENTRIES=new Set([ROOT.href,new URL('index.html',ROOT).href]);
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    try{
      const cache=await caches.open(CACHE);
      // addAll fails the installation if any required resource is unavailable.
      // The previous active release and its cache are left intact.
      await cache.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'})));
    }catch(error){await caches.delete(CACHE);throw error;}
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==ROOT.origin)return;
  url.search='';url.hash='';
  const entry=APP_ENTRIES.has(url.href),asset=ASSETS.includes(url.href);
  if(!entry&&!asset)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE),key=entry?new URL('index.html',ROOT).href:url.href;
    if(entry){
      const present=await Promise.all(ASSETS.map(asset=>cache.match(asset))),missing=ASSETS.filter((asset,index)=>!present[index]);
      if(missing.length){
        try{await cache.addAll(missing.map(asset=>new Request(asset,{cache:'reload'})));}
        catch{return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SHIKAKU — Reconnect</title><main style="font:18px/1.6 system-ui;max-width:32rem;margin:15vh auto;padding:24px"><h1>Reconnect to open your puzzle.</h1><p>Some offline files are missing. Your saved puzzles are still on this device. Reconnect, then reload this page.</p><a href="'+ROOT.pathname+'">Try again</a></main></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});}
      }
    }
    const cached=await cache.match(key);
    if(cached)return cached;
    // A missing cached module is an error, never an HTML response with JS MIME.
    const response=await fetch(request);
    if(response.ok)await cache.put(key,response.clone());
    return response;
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type!=='CACHE_STATUS'||!event.ports[0])return;
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE),present=await Promise.all(ASSETS.map(url=>cache.match(url)));
    event.ports[0].postMessage({type:'CACHE_STATUS',ready:present.every(Boolean),version:VERSION});
  })());
});
