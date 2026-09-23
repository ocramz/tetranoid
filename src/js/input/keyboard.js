import { G } from '../game/state.js';
import { tryRotate, hardDrop } from '../game/piece.js';
import { setAuto, takePaddle } from '../game/paddle.js';
import { start, togglePause } from '../game/run.js';
import { Snd } from '../fx/audio.js';
import { keys, hold } from './controls.js';

/* =========================================================
   Keyboard: P1 A/D/W/Q/E/S/Shift, P2 arrows, P paddle, M sound,
   Esc pause, Space start/pause
   ========================================================= */
function onKey(e,down){
  if(down) Snd.ensure();
  switch(e.code){
    case 'KeyA': case 'Numpad4': hold('l', down); e.preventDefault(); break;
    case 'KeyD': case 'Numpad6': hold('r', down); e.preventDefault(); break;
    case 'KeyS': hold('d', down); e.preventDefault(); break;
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
        if(G.state==='menu') start(true);
        else if(G.state==='playing'||G.state==='paused') togglePause();
      }
      break;
  }
}

export function initKeyboard(){
  window.addEventListener('keydown', e=>onKey(e,true));
  window.addEventListener('keyup',   e=>onKey(e,false));
}
