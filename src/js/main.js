import { isCoarse } from './device.js';
import { byId } from './util.js';
import { G, newBoard } from './game/state.js';
import { toMenu, togglePause, step } from './game/run.js';
import { initScene, resize, updateCamera, render } from './render/scene.js';
import { initView, updateView, updateInPlay } from './render/view.js';
import { updateParts } from './render/particles.js';
import { initFeedback } from './fx/feedback.js';
import { initHud, drawHud } from './ui/hud.js';
import { initScreens } from './ui/screens.js';
import { initControls, updateControls, paddleDir } from './input/controls.js';
import { initKeyboard } from './input/keyboard.js';
import { initTouch } from './input/touch.js';
import { initWakeLock } from './platform/wakelock.js';

/* =========================================================
   Boot: build the scene, wire every module to the rules, start the loop
   ========================================================= */
if(isCoarse) document.body.classList.add('touch');

const stage = byId('stage');
initScene(stage, byId('pzone'));
initFeedback();
initView();
initHud();
initScreens();
initControls();
initWakeLock();
initKeyboard();
initTouch(stage);

/* pause when the app goes to the background (or, on desktop, loses focus) */
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden && G.state==='playing') togglePause();
});
window.addEventListener('blur', ()=>{ if(!isCoarse && G.state==='playing') togglePause(); });

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
    updateControls(dt);
    step(dt, paddleDir());
    updateInPlay();
  }
  updateParts(dt);
  updateView(dt, tick);
  updateCamera(dt);
  drawHud();
  render();
}

newBoard();
drawHud();
toMenu();
requestAnimationFrame(frame);
