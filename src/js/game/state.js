import { COLS, ROWS, PADDLE_Y, FALL_BASE } from '../config.js';
import { emit } from '../events.js';

/* =========================================================
   State: the whole game as plain data
   ========================================================= */
export const G = {
  state:'menu',
  board:[], piece:null, bag:[], next:null,
  fallT:0, fallEvery:0.34, time:0,
  lockT:0, lockResets:0, grounded:false,
  lines:0, level:1, s1:0, s2:0, balls:3,
  ball:{x:0,y:PADDLE_Y-1.5,vx:0,vy:0,speed:11,alive:false},
  serveT:0,
  paddleX:0, paddleVX:0, paddleTarget:0, aiErr:0,
  auto:true
};

export function newBoard(){
  G.board=[];
  for(let r=0;r<ROWS;r++) G.board.push(new Array(COLS).fill(null));
}

/** The speed level follows lines cleared and time survived. */
export function retune(){
  const lv = 1 + Math.floor(G.lines/4) + Math.floor(G.time/50);
  G.level = lv;
  G.fallEvery = Math.max(0.15, FALL_BASE*Math.pow(0.90, lv-1));
}

/** End the run, once: 'stack' (the stack reached the spawn line) or 'balls' (last ball lost). */
export function gameOver(why){
  if(G.state==='over') return;
  G.state='over';
  emit('over', {why});
}
