/* =========================================================
   Blip synth
   ========================================================= */
let ctx=null, muted=false;
function ensure(){
  if(!ctx){ try{ ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; } }
  if(ctx.state==='suspended') ctx.resume();
  return ctx;
}
function tone(f0,f1,dur,type,vol){
  if(muted) return; const c=ensure(); if(!c) return;
  const t=c.currentTime, o=c.createOscillator(), g=c.createGain();
  o.type=type||'square';
  o.frequency.setValueAtTime(f0,t);
  if(f1&&f1!==f0) o.frequency.exponentialRampToValueAtTime(Math.max(30,f1),t+dur);
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(vol||0.07,t+0.008);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+dur+0.03);
}

export const Snd = {
  ensure, tone,
  toggle(){ muted=!muted; if(!muted) ensure(); return muted; },
  isMuted(){ return muted; },
  wall(){ tone(520,480,0.05,'square',0.035); },
  paddle(){ tone(300,620,0.09,'square',0.07); },
  crack(){ tone(900,600,0.05,'triangle',0.05); },
  smash(){ tone(240,70,0.16,'sawtooth',0.07); },
  lock(){ tone(180,140,0.07,'square',0.05); },
  line(n){ [0,1,2,3].slice(0,n).forEach(i=>setTimeout(()=>tone(440*Math.pow(1.26,i),0,0.11,'square',0.07), i*70)); },
  lost(){ tone(400,80,0.45,'sawtooth',0.08); },
  over(){ [0,1,2].forEach(i=>setTimeout(()=>tone(300/(i+1),0,0.3,'square',0.08), i*160)); }
};
