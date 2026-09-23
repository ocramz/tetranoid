import { on } from '../events.js';
import { cx, cy, PADDLE_Y } from '../config.js';
import { Snd } from './audio.js';
import { buzz } from './haptics.js';
import { burst } from '../render/particles.js';

/* What each game event sounds, feels and looks like: the "juice", tunable in one place.
   shake(amount, cap) sets the camera shake to min(shake + amount, cap), which can also
   lower it; ball loss and game over set it outright. */
export function initFeedback(camRig){
  const shake = (amount, cap) => { camRig.shake = Math.min(camRig.shake + amount, cap); };

  on('rotate',       () => { Snd.tone(660,880,0.04,'triangle',0.04); buzz(6); });
  on('lock',         () => { Snd.lock(); buzz(8); shake(0.10, 0.5); });
  on('rowCleared',   ({row, colors}) => colors.forEach((color, col) => burst(cx(col), cy(row), color, 7, 1.25)));
  on('linesCleared', ({n}) => { shake(0.22*n, 0.9); Snd.line(n); buzz(n>=4 ? [0,25,35,25,35,25] : 22); });
  on('crack',        ({row, col, color}) => { burst(cx(col), cy(row), color, 3, 0.6); Snd.crack(); shake(0.06, 0.5); });
  on('smash',        ({row, col, color}) => { burst(cx(col), cy(row), color, 9, 1); Snd.smash(); shake(0.16, 0.7); });
  on('chip',         ({row, col, color}) => { burst(cx(col), cy(row), color, 9, 1); Snd.smash(); shake(0.18, 0.7); });
  on('wall',         () => Snd.wall());
  on('paddleHit',    ({auto}) => { Snd.paddle(); if(!auto) buzz(10); shake(0.1, 0.45); });
  on('ballLost',     ({x}) => { Snd.lost(); buzz(45); burst(x, PADDLE_Y+0.6, 0x32e3ff, 16, 1.4); camRig.shake = 0.8; });
  on('over',         () => { Snd.over(); buzz([0,60,70,120]); camRig.shake = 1.0; });
}
