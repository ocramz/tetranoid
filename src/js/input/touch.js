import { G } from '../game/state.js';
import { tryRotate, movePiece, softDrop, hardDrop } from '../game/piece.js';
import { takePaddle, aimPaddle } from '../game/paddle.js';
import { togglePause } from '../game/run.js';
import { Snd } from '../fx/audio.js';
import { buzz } from '../fx/haptics.js';
import { on } from '../events.js';
import { layout, pointerToWorldX } from '../render/scene.js';
import { hold } from './controls.js';

export function initTouch(stage){
  initGestures(stage);
  initPad();
}

/* ---- field gestures: P1 pieces (touch) / P2 paddle ---- */
const g={id:null, mode:null, x0:0, y0:0, lx:0, ly:0, t0:0,
         sx:0, sy:0, st:0, moved:false, slammed:false};

function initGestures(stage){
  function paddleZoneHit(clientY){
    const rect=stage.getBoundingClientRect();
    return (clientY-rect.top) < layout.zoneY;
  }
  stage.addEventListener('pointerdown', e=>{
    if(e.target.closest('button')||e.target.closest('.veil')) return;
    Snd.ensure();
    if(G.state!=='playing' || g.id!==null) return;
    const mouse = (e.pointerType==='mouse');
    if(mouse){
      g.mode='paddle';
    } else {
      g.mode = (!G.auto && paddleZoneHit(e.clientY)) ? 'paddle' : 'piece';
    }
    g.id=e.pointerId; g.x0=g.lx=g.sx=e.clientX; g.y0=g.ly=g.sy=e.clientY;
    g.t0=g.st=performance.now(); g.moved=false; g.slammed=false;
    if(g.mode==='paddle' && !G.auto){
      aimPaddle(pointerToWorldX(e.clientX));
    }
    if(stage.setPointerCapture) try{ stage.setPointerCapture(e.pointerId); }catch(err){}
    e.preventDefault();
  }, {passive:false});

  stage.addEventListener('pointermove', e=>{
    if(g.id!==e.pointerId || G.state!=='playing') return;

    if(g.mode==='paddle'){
      if(G.auto){
        if(Math.abs(e.clientX-g.x0)+Math.abs(e.clientY-g.y0) < 14) return;
        takePaddle();
      }
      aimPaddle(pointerToWorldX(e.clientX));
      return;
    }

    /* piece gestures */
    const step = Math.max(14, layout.cellPx*0.72);
    const dx = e.clientX-g.lx;
    if(Math.abs(dx)>=step){
      const n=Math.trunc(dx/step), dir=n>0?1:-1;
      for(let i=0;i<Math.abs(n);i++) movePiece(dir);
      g.lx += n*step; g.ly = e.clientY; g.moved=true;
    }

    /* flick down = slam, measured over a short rolling window */
    const now = performance.now();
    const flickY = e.clientY-g.sy, flickX = Math.abs(e.clientX-g.sx);
    if(!g.slammed && flickY > step*2.6 && flickX < flickY*0.7 && now-g.st < 150){
      hardDrop(); g.slammed=true; g.moved=true; buzz(16);
      g.sx=e.clientX; g.sy=e.clientY; g.st=now;
      return;
    }
    if(now-g.st > 90){ g.sx=e.clientX; g.sy=e.clientY; g.st=now; }

    if(!g.slammed){
      const sstep=Math.max(13, layout.cellPx*0.55);
      const dy=e.clientY-g.ly;
      if(dy>=sstep){
        const n=Math.trunc(dy/sstep);
        softDrop(n);
        g.ly += n*sstep; g.moved=true;
      }
    }
  }, {passive:false});

  function endGesture(e){
    if(g.id!==e.pointerId) return;
    if(g.mode==='piece' && G.state==='playing' && !g.moved && !g.slammed){
      const age=performance.now()-g.t0;
      const dist=Math.hypot(e.clientX-g.x0, e.clientY-g.y0);
      if(age<280 && dist<15) tryRotate(1);
    }
    g.id=null; g.mode=null;
  }
  stage.addEventListener('pointerup', endGesture);
  stage.addEventListener('pointercancel', endGesture);
}

/* ---- thumb pad ---- */
function initPad(){
  document.querySelectorAll('#pad button[data-k]').forEach(btn=>{
    const k=btn.dataset.k;
    if(k==='pause'||k==='sound'){
      btn.addEventListener('click', ()=>{
        Snd.ensure();
        if(k==='pause'){ if(G.state==='playing'||G.state==='paused') togglePause(); }
        else Snd.toggle();
      });
      if(k==='sound') on('mute', m=>{ btn.style.opacity = m?'.45':'1'; btn.textContent = m?'MUTED':'SOUND'; });
      return;
    }
    const held={left:'l', right:'r', soft:'d'}[k];
    function press(down){
      if(!down){ if(held) hold(held,false); return; }
      Snd.ensure();
      if(G.state!=='playing') return;
      if(held) hold(held,true);
      else if(k==='rotL'){ tryRotate(-1); }
      else if(k==='rotR'){ tryRotate(1); }
      else if(k==='slam'){ hardDrop(); buzz(16); }
    }
    btn.addEventListener('pointerdown', e=>{
      e.preventDefault();
      if(btn.setPointerCapture) try{ btn.setPointerCapture(e.pointerId); }catch(err){}
      press(true);
    });
    ['pointerup','pointercancel','pointerleave'].forEach(t=>
      btn.addEventListener(t, ()=>press(false)));
    btn.addEventListener('contextmenu', e=>e.preventDefault());
  });
}
