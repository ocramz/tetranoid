import { COLS, ROWS, DANGER_ROW, SPAWN_TOP, PIECES, LOCK_RESETS, LOCK_SCORE, SOFT_DROP_SCORE, HARD_DROP_SCORE,
         BLOCK_HP } from '../config.js';
import { emit } from '../events.js';
import { G, gameOver } from './state.js';
import { clearLines } from './board.js';

/* ---- pieces ---- */
export function refillBag(){
  const b=[0,1,2,3,4,5,6];
  for(let i=b.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=b[i]; b[i]=b[j]; b[j]=t; }
  G.bag=G.bag.concat(b);
}
export function pullPiece(){
  if(G.bag.length<2) refillBag();
  const def=PIECES[G.bag.shift()];
  const m=def.m.map(row=>row.slice());
  return {name:def.n, color:def.c, m, size:m.length,
          px:Math.floor((COLS-m.length)/2), py:SPAWN_TOP};
}
export function pieceCells(p){
  const out=[];
  for(let r=0;r<p.size;r++) for(let c=0;c<p.size;c++)
    if(p.m[r][c]) out.push([p.py-r, p.px+c, r, c]);
  return out;
}
export function collides(p, px, py, m){
  m=m||p.m; px=(px===undefined?p.px:px); py=(py===undefined?p.py:py);
  for(let r=0;r<m.length;r++) for(let c=0;c<m.length;c++){
    if(!m[r][c]) continue;
    const br=py-r, bc=px+c;
    if(bc<0||bc>=COLS||br<0) return true;
    if(br<ROWS && G.board[br][bc]) return true;
  }
  return false;
}
function rotate(m, dir){
  const n=m.length, o=[];
  for(let r=0;r<n;r++) o.push(new Array(n).fill(0));
  for(let r=0;r<n;r++) for(let c=0;c<n;c++){
    if(dir>0) o[r][c]=m[n-1-c][r];
    else      o[r][c]=m[c][n-1-r];
  }
  return o;
}
export function tryRotate(dir){
  const p=G.piece; if(!p) return;
  const m=rotate(p.m,dir);
  const kicks=[0,-1,1,-2,2];
  for(let i=0;i<kicks.length;i++){
    if(!collides(p, p.px+kicks[i], p.py, m)){
      p.m=m; p.px+=kicks[i];
      resetLock(); emit('rotate');
      return;
    }
  }
}
export function movePiece(dx){
  const p=G.piece; if(!p) return false;
  if(!collides(p, p.px+dx, p.py)){ p.px+=dx; resetLock(); return true; }
  return false;
}
function resetLock(){ if(G.grounded && G.lockResets<LOCK_RESETS){ G.lockT=0; G.lockResets++; } }

export function spawnPiece(){
  G.piece = G.next || pullPiece();
  G.next  = pullPiece();
  G.fallT=0; G.lockT=0; G.lockResets=0; G.grounded=false;
  if(collides(G.piece)){ G.piece=null; gameOver('stack'); }   // blocked: never shown
}
/** How far the piece can sink before it lands (the ghost shows it). */
export function dropDistance(p){
  let dy=0;
  while(!collides(p,p.px,p.py-dy-1) && dy<ROWS) dy++;
  return dy;
}
export function stepDown(soft){
  const p=G.piece; if(!p) return;
  if(!collides(p, p.px, p.py-1)){
    p.py--; G.grounded=false; G.lockT=0;
    if(soft) G.s1+=SOFT_DROP_SCORE;
  } else G.grounded=true;
}
/** Sink n rows now (held S, the pad, drag down), restarting the gravity timer. */
export function softDrop(n=1){
  for(let i=0;i<n;i++) stepDown(true);
  G.fallT=0;
}
export function hardDrop(){
  const p=G.piece; if(!p) return;
  let n=0;
  while(!collides(p,p.px,p.py-1)){ p.py--; n++; }
  G.s1+=n*HARD_DROP_SCORE;
  lockPiece();
}
export function lockPiece(){
  const p=G.piece; if(!p) return;
  const cells=pieceCells(p);
  if(!cells.length){ spawnPiece(); return; }
  let top=-1;
  cells.forEach(([br,bc])=>{
    if(br<0||br>=ROWS||bc<0||bc>=COLS) return;
    G.board[br][bc]={color:p.color, hp:BLOCK_HP, r0:br};   // r0: the row it locked in
    if(br>top) top=br;
  });
  G.piece=null;
  G.s1+=LOCK_SCORE;
  emit('lock');
  const cleared=clearLines();
  if(top>=DANGER_ROW && cleared===0){ gameOver('stack'); return; }
  spawnPiece();
}
