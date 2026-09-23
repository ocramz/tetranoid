import { DAS, ARR, SOFT_REPEAT } from '../config.js';
import { on } from '../events.js';
import { G } from '../game/state.js';
import { movePiece, softDrop } from '../game/piece.js';

/* =========================================================
   Held controls, shared by the keyboard and the thumb pad.
   Sideways: one step on press, then after DAS every ARR seconds.
   Soft drop: a row straight away, then every SOFT_REPEAT seconds.
   ========================================================= */
export const keys={l:false,r:false,d:false,pl:false,pr:false};
let repL=0, repR=0, repD=0;

export function resetKeys(){ keys.l=keys.r=keys.d=keys.pl=keys.pr=false; }

/** Press or release a piece control: 'l' left, 'r' right, 'd' soft drop. */
export function hold(k, down){
  keys[k]=down;
  if(!down) return;
  if(k==='d'){ repD=0; return; }
  if(G.state!=='playing') return;
  if(k==='l'){ movePiece(-1); repL=DAS; }
  else if(k==='r'){ movePiece(1); repR=DAS; }
}

/** Player 2's arrow keys as -1 / 0 / +1. */
export function paddleDir(){
  let dir=0;
  if(keys.pl) dir-=1;
  if(keys.pr) dir+=1;
  return dir;
}

/** Auto-repeat for whatever is held; call each frame while playing. */
export function updateControls(dt){
  if(keys.l){ repL-=dt; if(repL<=0){ movePiece(-1); repL=ARR; } }
  if(keys.r){ repR-=dt; if(repR<=0){ movePiece(1); repR=ARR; } }
  if(keys.d){ repD-=dt; if(repD<=0){ softDrop(); repD=SOFT_REPEAT; } }
}

/** Held keys are let go whenever play stops or restarts (but not on resume). */
export function initControls(){
  for(const t of ['menu','start','pause','over']) on(t, resetKeys);
}
