import { BALL_R, PADDLE_Y, PADDLE_HH, PADDLE_HW, HALF_W } from '../config.js';
import { clamp } from '../util.js';
import { G } from './state.js';

/* =========================================================
   Paddle
   ========================================================= */
/** Where the ball will cross the paddle line, bouncing off the side walls. */
export function predictX(){
  const b=G.ball;
  if(!b.alive) return 0;
  if(b.vy<=0) return b.x*0.35;
  const targetY = PADDLE_Y-PADDLE_HH-BALL_R;
  const t=(targetY-b.y)/b.vy;
  if(t<0) return b.x;
  const x=b.x+b.vx*t;
  const lim=HALF_W-BALL_R, span=2*lim;
  let u=((x+lim)%(2*span)+2*span)%(2*span);
  if(u>span) u=2*span-u;
  return u-lim;
}
export function updatePaddle(dt, keys){
  const limit=HALF_W-PADDLE_HW;
  const prev=G.paddleX;
  if(G.auto){
    const want=clamp(predictX()+G.aiErr, -limit, limit);
    const d=want-G.paddleX;
    const v=clamp(d*9, -13.5, 13.5);
    G.paddleX=clamp(G.paddleX+v*dt, -limit, limit);
  } else {
    let dir=0;
    if(keys.pl) dir-=1;
    if(keys.pr) dir+=1;
    if(dir!==0) G.paddleTarget=clamp(G.paddleTarget+dir*17*dt,-limit,limit);
    G.paddleTarget=clamp(G.paddleTarget,-limit,limit);
    G.paddleX += (G.paddleTarget-G.paddleX)*Math.min(1,dt*22);
  }
  G.paddleVX=(G.paddleX-prev)/Math.max(dt,0.0001);
}
/** Hand the paddle to the machine (true) or to player 2 (false). */
export function setAuto(v){
  G.auto=v;
  if(!v) G.paddleTarget=G.paddleX;
}
