import { emit } from '../events.js';

/* =========================================================
   PWA: register the service worker, and offer to install the app or to
   switch to a new version. Nothing here reloads the page mid-run: a new
   version waits until the player taps "Update" on the menu (or the app
   is closed and opened again). Changes are announced with a 'pwa' event.
   ========================================================= */
let waiting=null, installPrompt=null, wantReload=false;

export const canUpdate = () => !!waiting;
export const canInstall = () => !!installPrompt;

export function initPWA(){
  window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); installPrompt=e; emit('pwa'); });
  window.addEventListener('appinstalled', ()=>{ installPrompt=null; emit('pwa'); });
  if(!('serviceWorker' in navigator)) return;

  // Only the tab that asked for the update reloads; a first install (clients.claim)
  // or an update applied from another tab changes the controller without a reload.
  navigator.serviceWorker.addEventListener('controllerchange', ()=>{
    if(wantReload){ wantReload=false; location.reload(); }
  });
  const register = ()=> navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'}).then(reg=>{
    offer(reg.waiting);
    reg.addEventListener('updatefound', ()=>{
      const sw=reg.installing;
      sw.addEventListener('statechange', ()=>{ if(sw.state==='installed') offer(sw); });
    });
    // an installed app can stay open for days: look for a new version whenever it comes back
    document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) reg.update().catch(()=>{}); });
  }).catch(()=>{});
  if(document.readyState==='complete') register(); else window.addEventListener('load', register);
}

/* A new version is ready once it has installed while an older one controls the page. */
function offer(sw){
  if(!sw || !navigator.serviceWorker.controller) return;
  waiting=sw; emit('pwa');
  sw.addEventListener('statechange', ()=>{
    if(waiting===sw && (sw.state==='activated' || sw.state==='redundant')){ waiting=null; emit('pwa'); }
  });
}

export function applyUpdate(){
  if(!waiting) return;
  wantReload=true;
  waiting.postMessage('skip-waiting');
}

export function promptInstall(){
  const p=installPrompt; if(!p) return;
  installPrompt=null; emit('pwa');
  p.prompt();
}
