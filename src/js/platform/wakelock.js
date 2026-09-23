/* keep the screen on while playing */
let wakeLock=null;
export function keepAwake(on){
  try{
    if(on && 'wakeLock' in navigator && !wakeLock){
      navigator.wakeLock.request('screen').then(w=>{
        wakeLock=w; w.addEventListener('release',()=>{wakeLock=null;});
      }).catch(()=>{});
    } else if(!on && wakeLock){ wakeLock.release().catch(()=>{}); wakeLock=null; }
  }catch(e){}
}
