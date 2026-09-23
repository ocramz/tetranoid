import { isCoarse } from './device.js';
import { clamp, byId } from './util.js';
import { PADDLE_HW, HALF_W, FALL_BASE } from './config.js';
import { on } from './events.js';
import { Snd } from './fx/audio.js';
import { buzz } from './fx/haptics.js';
import { initFeedback } from './fx/feedback.js';
import { initScene, resize, pointerToWorldX, updateCamera, render, layout } from './render/scene.js';
import { initView, updateView, updateInPlay, hideGhost } from './render/view.js';
import { updateParts, clearParticles } from './render/particles.js';
import { keepAwake } from './platform/wakelock.js';
import { G, newBoard, retune } from './game/state.js';
import { refillBag, pullPiece, tryRotate, movePiece, spawnPiece, stepDown, hardDrop, lockPiece } from './game/piece.js';
import { updateBall } from './game/ball.js';
import { updatePaddle, setAuto } from './game/paddle.js';

if(isCoarse) document.body.classList.add('touch');

const stage = byId('stage');
initScene(stage, byId('pzone'));
initFeedback();
initView();


/* =========================================================
   HUD
   ========================================================= */
const el = {
  s1:byId('s1'), s2:byId('s2'), lines:byId('lines'), level:byId('level'),
  balls:byId('balls'), next:byId('next'), mode:byId('mode'), veil:byId('veil')
};
const nextCells=[];
for(let i=0;i<16;i++){ const d=document.createElement('i'); el.next.appendChild(d); nextCells.push(d); }
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
  for(let i=0;i<3;i++){
    const s=document.createElement('span');
    if(i>=G.balls) s.className='gone';
    el.balls.appendChild(s);
  }
}
let hudCache={};
function drawHUD(){
  if(hudCache.s1!==G.s1){ el.s1.textContent=G.s1.toLocaleString(); hudCache.s1=G.s1; }
  if(hudCache.s2!==G.s2){ el.s2.textContent=G.s2.toLocaleString(); hudCache.s2=G.s2; }
  if(hudCache.lines!==G.lines){ el.lines.textContent=G.lines; hudCache.lines=G.lines; }
  if(hudCache.level!==G.level){ el.level.textContent=G.level; hudCache.level=G.level; }
  if(hudCache.auto!==G.auto){
    el.mode.innerHTML='paddle: <b>'+(G.auto?'auto':'you')+'</b>';
    document.body.classList.toggle('twop', !G.auto);
    hudCache.auto=G.auto;
  }
  if(hudCache.balls!==G.balls){ drawBalls(); hudCache.balls=G.balls; }
  if(hudCache.next!==G.next){ drawNext(); hudCache.next=G.next; }
}
function showVeil(html){
  el.veil.innerHTML=html;
  el.veil.classList.remove('hide');
  document.body.classList.add('menu');
}
function hideVeil(){ el.veil.classList.add('hide'); document.body.classList.remove('menu'); }

/* =========================================================
   Menus
   ========================================================= */
const MENU_HTML =
  '<h1 class="title">TETRANOID</h1>'+
  '<p class="tag">Pieces spawn mid-field and sink to the floor. A ball runs loose above them. '+
  '<em>Player 1</em> makes lines out of whatever survives. <em>Player 2</em> keeps the ball alive and '+
  'chews the stack apart. The run ends when the stack reaches the spawn line, or when the last ball '+
  'slips past the paddle.</p>'+
  '<div class="keys">'+
    '<div class="keycol a"><h4>Player 1 — pieces</h4>'+
      '<div class="tc">'+
        '<p><span class="gl">↔</span>drag anywhere to slide</p>'+
        '<p><span class="gl">⊙</span>tap to rotate</p>'+
        '<p><span class="gl">↓</span>drag down to sink, flick to slam</p>'+
        '<p><span class="gl">✛</span>or the pad: cross moves and drops, A and B turn</p>'+
      '</div>'+
      '<div class="kb">'+
        '<p><kbd>A</kbd><kbd>D</kbd> move sideways</p>'+
        '<p><kbd>W</kbd> rotate · <kbd>S</kbd> soft drop</p>'+
        '<p><kbd>Shift</kbd> slam to the floor</p>'+
      '</div>'+
    '</div>'+
    '<div class="keycol b"><h4>Player 2 — paddle</h4>'+
      '<div class="tc">'+
        '<p>Drag in the marked band at the top</p>'+
        '<p>Three balls. Miss, and one is gone</p>'+
      '</div>'+
      '<div class="kb">'+
        '<p><kbd>←</kbd><kbd>→</kbd> or mouse to slide</p>'+
        '<p><kbd>P</kbd> hand the paddle back to the machine</p>'+
        '<p>Three balls. Miss, and one is gone</p>'+
      '</div>'+
    '</div>'+
  '</div>'+
  '<div class="btns">'+
    '<button class="go" id="btn1">Play solo, paddle on auto</button>'+
    '<button class="go alt" id="btn2">Two players</button>'+
  '</div>';

function showMenu(){
  G.state='menu';
  resetKeys();
  G.piece=null; G.ball.alive=false;
  hideGhost(); newBoard();
  clearParticles();
  keepAwake(false);
  showVeil(MENU_HTML);
  byId('btn1').onclick=()=>startGame(true);
  byId('btn2').onclick=()=>startGame(false);
}

function startGame(auto){
  Snd.ensure();
  G.state='playing';
  G.lines=0; G.level=1; G.s1=0; G.s2=0; G.balls=3;
  G.fallEvery=FALL_BASE; G.time=0; G.bag=[]; G.next=null; G.piece=null;
  G.paddleX=0; G.paddleTarget=0; G.serveT=0.9; G.ball.alive=false;
  hudCache={};
  setAuto(auto);
  resetKeys();
  newBoard(); hideGhost();
  clearParticles();
  refillBag();
  G.next=pullPiece();
  spawnPiece();
  drawHUD();
  hideVeil();
  keepAwake(true);
}
/* the rules end the run (state.gameOver); this shows it */
on('over', ({why})=>{
  resetKeys();
  keepAwake(false);
  const ballsOut = (why==='balls');
  const head = ballsOut ? 'BALL LOST' : 'FIELD BURIED';
  const sub  = ballsOut
    ? 'The last ball slipped past the paddle. Player 2 ended the run.'
    : 'The stack reached the spawn line. Player 1 ended the run.';
  showVeil(
    '<p class="result" style="color:'+(ballsOut?'var(--p2)':'var(--p1)')+'">'+head+'</p>'+
    '<p class="tag">'+sub+' You survived '+Math.floor(G.time)+' seconds.</p>'+
    '<div class="scoreline">'+
      '<div class="sl1">Player 1<b>'+G.s1.toLocaleString()+'</b>'+G.lines+' lines cleared</div>'+
      '<div class="sl2">Player 2<b>'+G.s2.toLocaleString()+'</b>blocks broken</div>'+
    '</div>'+
    '<div class="btns">'+
      '<button class="go" id="again">Play again</button>'+
      '<button class="go alt" id="quit">Back to the start</button>'+
    '</div>');
  byId('again').onclick=()=>startGame(G.auto);
  byId('quit').onclick=showMenu;
});
function togglePause(){
  if(G.state==='playing'){
    G.state='paused';
    resetKeys();
    keepAwake(false);
    showVeil(
      '<p class="result">PAUSED</p>'+
      '<p class="tag">The ball is holding its breath.</p>'+
      '<div class="btns">'+
        '<button class="go" id="vres">Resume</button>'+
        '<button class="go ghost" id="vsnd">Sound: '+(Snd.isMuted()?'off':'on')+'</button>'+
        '<button class="go ghost" id="vpad">Paddle: '+(G.auto?'auto':'player 2')+'</button>'+
        '<button class="go alt" id="vquit">Quit to menu</button>'+
      '</div>');
    byId('vres').onclick=togglePause;
    byId('vsnd').onclick=function(){ const m=Snd.toggle(); this.textContent='Sound: '+(m?'off':'on'); };
    byId('vpad').onclick=function(){ setAuto(!G.auto); this.textContent='Paddle: '+(G.auto?'auto':'player 2'); };
    byId('vquit').onclick=showMenu;
  } else if(G.state==='paused'){
    G.state='playing'; hideVeil(); keepAwake(true);
  }
}

/* =========================================================
   Input
   ========================================================= */
const keys={l:false,r:false,d:false,pl:false,pr:false};
function resetKeys(){ keys.l=keys.r=keys.d=keys.pl=keys.pr=false; }
function takePaddle(){ if(G.auto) setAuto(false); }
let repL=0, repR=0, repD=0;

function onKey(e,down){
  if(down) Snd.ensure();
  switch(e.code){
    case 'KeyA': case 'Numpad4': keys.l=down; if(down&&G.state==='playing'){ movePiece(-1); repL=0.17; } e.preventDefault(); break;
    case 'KeyD': case 'Numpad6': keys.r=down; if(down&&G.state==='playing'){ movePiece(1); repR=0.17; } e.preventDefault(); break;
    case 'KeyS': keys.d=down; if(down) repD=0; e.preventDefault(); break;
    case 'KeyW': case 'KeyE': if(down&&G.state==='playing') tryRotate(1); e.preventDefault(); break;
    case 'KeyQ': if(down&&G.state==='playing') tryRotate(-1); e.preventDefault(); break;
    case 'ShiftLeft': case 'ShiftRight': if(down&&G.state==='playing') hardDrop(); e.preventDefault(); break;
    case 'ArrowLeft': keys.pl=down; if(down) takePaddle(); e.preventDefault(); break;
    case 'ArrowRight': keys.pr=down; if(down) takePaddle(); e.preventDefault(); break;
    case 'KeyP': if(down) setAuto(!G.auto); break;
    case 'KeyM': if(down) Snd.toggle(); break;
    case 'Escape': if(down) togglePause(); break;
    case 'Space':
      e.preventDefault();
      if(down){
        if(G.state==='menu') startGame(true);
        else if(G.state==='playing'||G.state==='paused') togglePause();
      }
      break;
  }
}
window.addEventListener('keydown', e=>onKey(e,true));
window.addEventListener('keyup',   e=>onKey(e,false));
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden && G.state==='playing') togglePause();
});
window.addEventListener('blur', ()=>{ if(!isCoarse && G.state==='playing') togglePause(); });

/* ---- field gestures: P1 pieces (touch) / P2 paddle ---- */
const g={id:null, mode:null, x0:0, y0:0, lx:0, ly:0, t0:0,
         sx:0, sy:0, st:0, moved:false, slammed:false};

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
    G.paddleTarget=clamp(pointerToWorldX(e.clientX),-(HALF_W-PADDLE_HW),HALF_W-PADDLE_HW);
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
    G.paddleTarget=clamp(pointerToWorldX(e.clientX),-(HALF_W-PADDLE_HW),HALF_W-PADDLE_HW);
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
      for(let i=0;i<n;i++) stepDown(true);
      G.fallT=0; g.ly += n*sstep; g.moved=true;
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

/* ---- thumb pad ---- */
document.querySelectorAll('#pad button[data-k]').forEach(btn=>{
  const k=btn.dataset.k;
  if(k==='pause'||k==='sound'){
    btn.addEventListener('click', ()=>{
      Snd.ensure();
      if(k==='pause'){ if(G.state==='playing'||G.state==='paused') togglePause(); }
      else { const m=Snd.toggle(); btn.style.opacity = m?'.45':'1'; btn.textContent = m?'MUTED':'SOUND'; }
    });
    return;
  }
  function press(on){
    if(!on){
      if(k==='left') keys.l=false;
      if(k==='right') keys.r=false;
      if(k==='soft') keys.d=false;
      return;
    }
    Snd.ensure();
    if(G.state!=='playing') return;
    if(k==='left'){ keys.l=true; movePiece(-1); repL=0.17; }
    else if(k==='right'){ keys.r=true; movePiece(1); repR=0.17; }
    else if(k==='soft'){ keys.d=true; repD=0; }
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

/* ---- chrome buttons ---- */
byId('bPause').onclick=()=>{ if(G.state==='playing'||G.state==='paused') togglePause(); };
byId('bSound').onclick=function(){
  const m=Snd.toggle();
  this.style.color = m ? 'rgba(139,160,201,.4)' : 'var(--p2)';
};
el.mode.onclick=()=>setAuto(!G.auto);

/* =========================================================
   Resize
   ========================================================= */
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', ()=>setTimeout(resize,250));
if(window.visualViewport) visualViewport.addEventListener('resize', resize);
if(window.ResizeObserver) new ResizeObserver(resize).observe(stage);
resize();

/* =========================================================
   Loop
   ========================================================= */
let last=performance.now(), tick=0;
function frame(now){
  requestAnimationFrame(frame);
  let dt=(now-last)/1000; last=now;
  dt=Math.max(0,Math.min(dt,0.033));
  tick+=dt;

  if(G.state==='playing'){
    G.time+=dt; retune();
    if(keys.l){ repL-=dt; if(repL<=0){ movePiece(-1); repL=0.055; } }
    if(keys.r){ repR-=dt; if(repR<=0){ movePiece(1); repR=0.055; } }
    if(keys.d){ repD-=dt; if(repD<=0){ stepDown(true); repD=0.045; G.fallT=0; } }

    if(G.piece){
      G.fallT+=dt;
      if(G.fallT>=G.fallEvery){ G.fallT=0; stepDown(false); }
      if(G.grounded){
        G.lockT+=dt;
        if(G.lockT>=0.40) lockPiece();
      }
    } else if(G.state==='playing'){
      spawnPiece();
    }

    updateBall(dt);
    updatePaddle(dt, keys);
    updateInPlay();
  }

  updateParts(dt);

  updateView(dt, tick);
  updateCamera(dt);

  drawHUD();
  render();
}

newBoard();
drawHUD();
showMenu();
requestAnimationFrame(frame);
