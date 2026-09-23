import { ROWS, COLS, BALL_R, PADDLE_Y, PADDLE_HH, PADDLE_HW, HALF_W, HALF_H, CRACK_SCORE, SMASH_SCORE, CHIP_SCORE,
         RESERVE_DELAY, BALL_SPEED, BALL_SPEED_PER_LEVEL, BALL_SPEED_LEVEL_CAP, BALL_SPEEDUP, BALL_SPEED_MAX,
         AI_ERROR } from '../config.js';
import { clamp, rnd } from '../util.js';
import { emit } from '../events.js';
import { G, gameOver } from './state.js';
import { pieceCells, spawnPiece } from './piece.js';

/* ---- destruction ---- */
export function damageCell(row,col,fromBall){
  if(row<0||row>=ROWS||col<0||col>=COLS) return;
  const cell=G.board[row][col];
  if(cell){
    cell.hp--;
    if(cell.hp<=0){
      G.board[row][col]=null;
      if(fromBall) G.s2+=SMASH_SCORE;
      emit('smash', {row, col, color:cell.color});
    } else {
      if(fromBall) G.s2+=CRACK_SCORE;
      emit('crack', {row, col, color:cell.color});
    }
    return;
  }
  const p=G.piece;
  if(p){
    const r=p.py-row, c=col-p.px;
    if(r>=0&&r<p.size&&c>=0&&c<p.size&&p.m[r][c]){
      p.m[r][c]=0;
      if(fromBall) G.s2+=CHIP_SCORE;
      emit('chip', {row, col, color:p.color});
      if(pieceCells(p).length===0){ G.piece=null; spawnPiece(); }
    }
  }
}
export function occupied(row,col){
  if(row<0||row>=ROWS||col<0||col>=COLS) return false;
  if(G.board[row][col]) return true;
  const p=G.piece;
  if(p){
    const r=p.py-row, c=col-p.px;
    if(r>=0&&r<p.size&&c>=0&&c<p.size&&p.m[r][c]) return true;
  }
  return false;
}

/* =========================================================
   Ball
   ========================================================= */
export function serveBall(){
  const b=G.ball;
  b.x=clamp(G.paddleX,-HALF_W+1,HALF_W-1);
  b.y=PADDLE_Y-1.1;
  b.speed=BALL_SPEED+Math.min(G.level*BALL_SPEED_PER_LEVEL,BALL_SPEED_LEVEL_CAP);
  const a=rnd(-0.5,0.5);
  b.vx=Math.sin(a)*b.speed;
  b.vy=-Math.cos(a)*b.speed;
  b.alive=true;
  G.aiErr=rnd(-AI_ERROR,AI_ERROR);
  emit('serve');
}
function loseBall(){
  const b=G.ball; b.alive=false;
  G.balls--;
  emit('ballLost', {x:b.x});
  if(G.balls<=0){ gameOver('balls'); return; }
  G.serveT=RESERVE_DELAY;
}
function hitAxis(axis){
  const b=G.ball, eps=1e-4;
  const c0=Math.floor(b.x-BALL_R+eps+HALF_W), c1=Math.floor(b.x+BALL_R-eps+HALF_W);
  const r0=Math.floor(b.y-BALL_R+eps+HALF_H), r1=Math.floor(b.y+BALL_R-eps+HALF_H);
  for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++){
    if(!occupied(r,c)) continue;
    if(axis==='x'){
      if(b.vx>0) b.x = (c-HALF_W) - BALL_R - 0.002;
      else       b.x = (c+1-HALF_W) + BALL_R + 0.002;
      b.vx=-b.vx;
    } else {
      if(b.vy>0) b.y = (r-HALF_H) - BALL_R - 0.002;
      else       b.y = (r+1-HALF_H) + BALL_R + 0.002;
      b.vy=-b.vy;
    }
    damageCell(r,c,true);
    return true;
  }
  return false;
}
export function updateBall(dt){
  const b=G.ball;
  if(!b.alive){
    if(G.serveT>0){ G.serveT-=dt; if(G.serveT<=0) serveBall(); }
    return;
  }
  const dist=Math.hypot(b.vx,b.vy)*dt;
  const steps=clamp(Math.ceil(dist/0.18),1,24);
  const sdt=dt/steps;
  for(let s=0;s<steps;s++){
    b.x+=b.vx*sdt; hitAxis('x');
    b.y+=b.vy*sdt; hitAxis('y');

    if(b.x-BALL_R < -HALF_W){ b.x=-HALF_W+BALL_R; b.vx=Math.abs(b.vx); emit('wall'); }
    else if(b.x+BALL_R > HALF_W){ b.x=HALF_W-BALL_R; b.vx=-Math.abs(b.vx); emit('wall'); }
    if(b.y-BALL_R < -HALF_H){ b.y=-HALF_H+BALL_R; b.vy=Math.abs(b.vy); emit('wall'); }

    if(b.vy>0 && b.y+BALL_R > PADDLE_Y-PADDLE_HH && b.y-BALL_R < PADDLE_Y+PADDLE_HH){
      if(Math.abs(b.x-G.paddleX) < PADDLE_HW+BALL_R*0.85){
        b.y = PADDLE_Y-PADDLE_HH-BALL_R-0.002;
        const off = clamp((b.x-G.paddleX)/PADDLE_HW,-1,1);
        b.speed = Math.min(b.speed+BALL_SPEEDUP, BALL_SPEED_MAX);
        const ang = off*0.95 + G.paddleVX*0.012;
        b.vx = Math.sin(ang)*b.speed;
        b.vy = -Math.abs(Math.cos(ang))*b.speed;
        emit('paddleHit', {auto:G.auto});
      }
    }
    if(b.y > HALF_H+0.7){ loseBall(); return; }
  }

  const sp=Math.hypot(b.vx,b.vy)||1;
  if(Math.abs(b.vy) < sp*0.22){
    b.vy = (b.vy>=0?1:-1)*sp*0.24;
    const k=sp/(Math.hypot(b.vx,b.vy)||1); b.vx*=k; b.vy*=k;
  }
  const rc=Math.floor(b.y+HALF_H), cc=Math.floor(b.x+HALF_W);
  if(occupied(rc,cc)) damageCell(rc,cc,true);
}
