import { byId } from '../util.js';
import { BALLS } from '../config.js';
import { on } from '../events.js';
import { G } from '../game/state.js';
import { setAuto } from '../game/paddle.js';
import { togglePause } from '../game/run.js';
import { Snd } from '../fx/audio.js';

/* =========================================================
   HUD: drawn from G every frame, touching the DOM only when a value changes
   ========================================================= */
let el, nextCells=[], cache={};

export function initHud(){
  el = { s1:byId('s1'), s2:byId('s2'), lines:byId('lines'), level:byId('level'),
         balls:byId('balls'), next:byId('next'), mode:byId('mode') };
  for(let i=0;i<16;i++){ const d=document.createElement('i'); el.next.appendChild(d); nextCells.push(d); }
  on('start', ()=>{ cache={}; drawHud(); });

  /* ---- chrome buttons ---- */
  byId('bPause').onclick=()=>{ if(G.state==='playing'||G.state==='paused') togglePause(); };
  const bSound=byId('bSound');
  bSound.onclick=()=>Snd.toggle();
  on('mute', m=>{ bSound.style.color = m ? 'rgba(139,160,201,.4)' : 'var(--p2)'; });
  el.mode.onclick=()=>setAuto(!G.auto);
}

export function drawHud(){
  if(cache.s1!==G.s1){ el.s1.textContent=G.s1.toLocaleString(); cache.s1=G.s1; }
  if(cache.s2!==G.s2){ el.s2.textContent=G.s2.toLocaleString(); cache.s2=G.s2; }
  if(cache.lines!==G.lines){ el.lines.textContent=G.lines; cache.lines=G.lines; }
  if(cache.level!==G.level){ el.level.textContent=G.level; cache.level=G.level; }
  if(cache.auto!==G.auto){
    el.mode.innerHTML='paddle: <b>'+(G.auto?'auto':'you')+'</b>';
    document.body.classList.toggle('twop', !G.auto);
    cache.auto=G.auto;
  }
  if(cache.balls!==G.balls){ drawBalls(); cache.balls=G.balls; }
  if(cache.next!==G.next){ drawNext(); cache.next=G.next; }
}

function drawNext(){
  const p=G.next;
  for(let i=0;i<16;i++){ nextCells[i].style.background='transparent'; nextCells[i].style.boxShadow='none'; }
  if(!p) return;
  const off=Math.floor((4-p.size)/2);
  for(let r=0;r<p.size;r++) for(let c=0;c<p.size;c++){
    if(!p.m[r][c]) continue;
    const i=(r+off)*4+(c+off);
    if(i<0||i>=16) continue;
    const hex='#'+p.color.toString(16).padStart(6,'0');
    nextCells[i].style.background=hex;
    nextCells[i].style.boxShadow='0 0 6px '+hex;
  }
}

function drawBalls(){
  el.balls.innerHTML='';
  for(let i=0;i<BALLS;i++){
    const s=document.createElement('span');
    if(i>=G.balls) s.className='gone';
    el.balls.appendChild(s);
  }
}
