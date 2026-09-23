import { FALL_BASE } from '../config.js';
import { emit } from '../events.js';
import { G, newBoard, retune } from './state.js';
import { refillBag, pullPiece, spawnPiece, stepDown, lockPiece } from './piece.js';
import { updateBall } from './ball.js';
import { updatePaddle, setAuto } from './paddle.js';

/* =========================================================
   Run: menu → playing ⇄ paused → over → playing | menu
   Each change emits 'menu', 'start', 'pause' or 'resume' ('over' comes from
   state.gameOver); screens, input, wake lock and effects listen.
   ========================================================= */
export function toMenu(){
  G.state='menu';
  G.piece=null; G.ball.alive=false;
  newBoard();
  emit('menu');
}

/** A new run; auto = the machine plays the paddle. */
export function start(auto){
  G.state='playing';
  G.lines=0; G.level=1; G.s1=0; G.s2=0; G.balls=3;
  G.fallEvery=FALL_BASE; G.time=0; G.bag=[]; G.next=null; G.piece=null;
  G.paddleX=0; G.paddleTarget=0; G.serveT=0.9; G.ball.alive=false;
  setAuto(auto);
  newBoard();
  refillBag();
  G.next=pullPiece();
  spawnPiece();
  emit('start');
}

export function togglePause(){
  if(G.state==='playing'){ G.state='paused'; emit('pause'); }
  else if(G.state==='paused'){ G.state='playing'; emit('resume'); }
}

/** One frame of play: time and speed, gravity and lock delay, the ball, the paddle.
    Keeps going to the end of the frame even if the run ends part-way, as before. */
export function step(dt, paddleDir){
  G.time+=dt; retune();
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
  updatePaddle(dt, paddleDir);
}
