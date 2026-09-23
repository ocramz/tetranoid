import { COLS, ROWS, DANGER_ROW, SPAWN_TOP, PIECES, cx, cy } from '../config.js';
import { emit } from '../events.js';
import { G, gameOver } from './state.js';
import { clearLines } from './board.js';
// TEMP until the view draws from state:
import THREE from '../render/three.js';
import { blockRoot, pieceRoot } from '../render/scene.js';
import { boxGeo, blockMat } from '../render/materials.js';

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
      resetLock(); syncPiece(); emit('rotate');
      return;
    }
  }
}
export function movePiece(dx){
  const p=G.piece; if(!p) return false;
  if(!collides(p, p.px+dx, p.py)){ p.px+=dx; resetLock(); syncPiece(); return true; }
  return false;
}
function resetLock(){ if(G.grounded && G.lockResets<8){ G.lockT=0; G.lockResets++; } }

export function spawnPiece(){
  G.piece = G.next || pullPiece();
  G.next  = pullPiece();
  G.fallT=0; G.lockT=0; G.lockResets=0; G.grounded=false;
  if(collides(G.piece)){ gameOver('stack'); return; }
  buildPieceMeshes();
  pieceRoot.position.set(cx(G.piece.px), cy(G.piece.py), 0);
}
export function buildPieceMeshes(){
  while(pieceRoot.children.length) pieceRoot.remove(pieceRoot.children[0]);
  const p=G.piece; if(!p) return;
  for(let r=0;r<p.size;r++) for(let c=0;c<p.size;c++){
    if(!p.m[r][c]) continue;
    const mesh=new THREE.Mesh(boxGeo, blockMat(p.color,false));
    mesh.position.set(c, -r, 0);
    mesh.userData.rc=r*10+c;
    pieceRoot.add(mesh);
  }
}
function syncPiece(){
  const p=G.piece; if(!p) return;
  const have={};
  pieceRoot.children.forEach(m=>{ have[m.userData.rc]=m; });
  let need=0;
  for(let r=0;r<p.size;r++) for(let c=0;c<p.size;c++) if(p.m[r][c]) need++;
  if(need!==pieceRoot.children.length){ buildPieceMeshes(); return; }
  let ok=true;
  for(let r=0;r<p.size && ok;r++) for(let c=0;c<p.size && ok;c++)
    if(p.m[r][c] && !have[r*10+c]) ok=false;
  if(!ok) buildPieceMeshes();
}
export function stepDown(soft){
  const p=G.piece; if(!p) return;
  if(!collides(p, p.px, p.py-1)){
    p.py--; G.grounded=false; G.lockT=0;
    if(soft) G.s1+=1;
  } else G.grounded=true;
}
export function hardDrop(){
  const p=G.piece; if(!p) return;
  let n=0;
  while(!collides(p,p.px,p.py-1)){ p.py--; n++; }
  G.s1+=n*2;
  pieceRoot.position.y=cy(p.py);
  lockPiece();
}
export function lockPiece(){
  const p=G.piece; if(!p) return;
  const cells=pieceCells(p);
  if(!cells.length){ spawnPiece(); return; }
  let top=-1;
  cells.forEach(([br,bc])=>{
    if(br<0||br>=ROWS||bc<0||bc>=COLS) return;
    const mesh=new THREE.Mesh(boxGeo, blockMat(p.color,false));
    mesh.position.set(cx(bc), cy(br), 0);
    blockRoot.add(mesh);
    G.board[br][bc]={color:p.color, hp:2, mesh};
    if(br>top) top=br;
  });
  while(pieceRoot.children.length) pieceRoot.remove(pieceRoot.children[0]);
  G.piece=null;
  G.s1+=12;
  emit('lock');
  const cleared=clearLines();
  if(top>=DANGER_ROW && cleared===0){ gameOver('stack'); return; }
  spawnPiece();
}
