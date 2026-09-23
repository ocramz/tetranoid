import { byId } from '../util.js';
import { on } from '../events.js';
import { G } from '../game/state.js';
import { setAuto } from '../game/paddle.js';
import { start, togglePause, toMenu } from '../game/run.js';
import { Snd } from '../fx/audio.js';
import { canInstall, canUpdate, promptInstall, applyUpdate } from '../platform/pwa.js';

/* =========================================================
   Screens: the veil over the field for the menu, pause and game over
   ========================================================= */
let veil;

export function initScreens(){
  veil = byId('veil');
  on('menu', showMenu);
  on('start', hide);
  on('pause', showPause);
  on('resume', hide);
  on('over', ({why})=>showOver(why));
  on('mute', m=>{ const b=byId('vsnd'); if(b) b.textContent='Sound: '+(m?'off':'on'); });
  on('pwa', showAppButtons);
}

function show(html){
  veil.innerHTML=html;
  veil.classList.remove('hide');
  document.body.classList.add('menu');
}
function hide(){ veil.classList.add('hide'); document.body.classList.remove('menu'); }

/* Starting a run always comes from a tap, click or key: unlock audio right there. */
function play(auto){ Snd.ensure(); start(auto); }

const MENU_HTML = `<h1 class="title">TETRANOID</h1>
<p class="tag">Pieces spawn mid-field and sink to the floor. A ball runs loose above them.
<em>Player 1</em> makes lines out of whatever survives. <em>Player 2</em> keeps the ball alive and
chews the stack apart. The run ends when the stack reaches the spawn line, or when the last ball
slips past the paddle.</p>
<div class="keys">
  <div class="keycol a"><h4>Player 1 — pieces</h4>
    <div class="tc">
      <p><span class="gl">↔</span>drag anywhere to slide</p>
      <p><span class="gl">⊙</span>tap to rotate</p>
      <p><span class="gl">↓</span>drag down to sink, flick to slam</p>
      <p><span class="gl">✛</span>or the pad: cross moves and drops, A and B turn</p>
    </div>
    <div class="kb">
      <p><kbd>A</kbd><kbd>D</kbd> move sideways</p>
      <p><kbd>W</kbd> rotate · <kbd>S</kbd> soft drop</p>
      <p><kbd>Shift</kbd> slam to the floor</p>
    </div>
  </div>
  <div class="keycol b"><h4>Player 2 — paddle</h4>
    <div class="tc">
      <p>Drag in the marked band at the top</p>
      <p>Three balls. Miss, and one is gone</p>
    </div>
    <div class="kb">
      <p><kbd>←</kbd><kbd>→</kbd> or mouse to slide</p>
      <p><kbd>P</kbd> hand the paddle back to the machine</p>
      <p>Three balls. Miss, and one is gone</p>
    </div>
  </div>
</div>
<div class="btns">
  <button class="go" id="btn1">Play solo, paddle on auto</button>
  <button class="go alt" id="btn2">Two players</button>
</div>
<div class="btns" id="appbtns"></div>`;

function showMenu(){
  show(MENU_HTML);
  byId('btn1').onclick=()=>play(true);
  byId('btn2').onclick=()=>play(false);
  showAppButtons();
}

/* Install / update offers live on the menu only, never over a run. */
function showAppButtons(){
  const box=byId('appbtns'); if(!box || veil.classList.contains('hide')) return;   // menu on screen only
  box.innerHTML=(canInstall() ? '<button class="go ghost" id="binstall">Install the app</button>' : '')
               +(canUpdate() ? '<button class="go ghost" id="bupdate">New version: update</button>' : '');
  if(canInstall()) byId('binstall').onclick=promptInstall;
  if(canUpdate()) byId('bupdate').onclick=applyUpdate;
}

function showPause(){
  show(`<p class="result">PAUSED</p>
<p class="tag">The ball is holding its breath.</p>
<div class="btns">
  <button class="go" id="vres">Resume</button>
  <button class="go ghost" id="vsnd">Sound: ${Snd.isMuted()?'off':'on'}</button>
  <button class="go ghost" id="vpad">Paddle: ${G.auto?'auto':'player 2'}</button>
  <button class="go alt" id="vquit">Quit to menu</button>
</div>`);
  byId('vres').onclick=togglePause;
  byId('vsnd').onclick=()=>Snd.toggle();
  byId('vpad').onclick=function(){ setAuto(!G.auto); this.textContent='Paddle: '+(G.auto?'auto':'player 2'); };
  byId('vquit').onclick=toMenu;
}

/* Built the moment the run ends, so it shows the scores at that instant. */
function showOver(why){
  const ballsOut = (why==='balls');
  const head = ballsOut ? 'BALL LOST' : 'FIELD BURIED';
  const sub  = ballsOut
    ? 'The last ball slipped past the paddle. Player 2 ended the run.'
    : 'The stack reached the spawn line. Player 1 ended the run.';
  show(`<p class="result" style="color:${ballsOut?'var(--p2)':'var(--p1)'}">${head}</p>
<p class="tag">${sub} You survived ${Math.floor(G.time)} seconds.</p>
<div class="scoreline">
  <div class="sl1">Player 1<b>${G.s1.toLocaleString()}</b>${G.lines} lines cleared</div>
  <div class="sl2">Player 2<b>${G.s2.toLocaleString()}</b>blocks broken</div>
</div>
<div class="btns">
  <button class="go" id="again">Play again</button>
  <button class="go alt" id="quit">Back to the start</button>
</div>`);
  byId('again').onclick=()=>play(G.auto);
  byId('quit').onclick=toMenu;
}
