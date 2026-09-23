import { on } from '../events.js';

/* keep the screen on while playing */
let wakeLock=null;

export function initWakeLock(){
  for(const t of ['start','resume']) on(t, ()=>keepAwake(true));
  for(const t of ['pause','over','menu']) on(t, ()=>keepAwake(false));
}

function keepAwake(awake){
  try{
    if(awake && 'wakeLock' in navigator && !wakeLock){
      navigator.wakeLock.request('screen').then(w=>{
        wakeLock=w; w.addEventListener('release',()=>{wakeLock=null;});
      }).catch(()=>{});
    } else if(!awake && wakeLock){ wakeLock.release().catch(()=>{}); wakeLock=null; }
  }catch(e){}
}
