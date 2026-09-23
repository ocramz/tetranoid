import THREE from './three.js';
import { COLS, ROWS, DANGER_ROW, BLOCK_HP, cx, cy } from '../config.js';
import { clamp } from '../util.js';
import { on } from '../events.js';
import { G } from '../game/state.js';
import { dropDistance } from '../game/piece.js';
import { boxGeo, blockMat } from './materials.js';
import { clearParticles } from './particles.js';
import { blockRoot, pieceRoot, ghostPool, paddle, paddleGlow, ballMesh, ballLight, trail, dangerLine } from './scene.js';

/* =========================================================
   View: makes the meshes match G. The rules never touch three.js.
   ========================================================= */
const blocks = new Map();          // board cell object → {mesh, hp, seen}
let stamp = 0;
let shownPiece = null, shownShape = -1;

export function initView(){
  on('serve', ()=>{ for(let i=0;i<trail.length;i++) trail[i].userData.p.set(G.ball.x,G.ball.y,0); });
  for(const t of ['menu','start']) on(t, ()=>{ hideGhost(); clearParticles(); });
}

/** Every frame, after the rules have run. */
export function updateView(dt, tick){
  syncBlocks(dt);
  syncPiece(dt);

  const b=G.ball;
  ballMesh.visible=b.alive;
  if(b.alive){
    ballMesh.position.set(b.x,b.y,0);
    ballMesh.rotation.x+=dt*4; ballMesh.rotation.y+=dt*3;
    ballLight.position.set(b.x,b.y,1.4);
    ballLight.intensity=2.4;
    for(let i=trail.length-1;i>0;i--) trail[i].userData.p.copy(trail[i-1].userData.p);
    trail[0].userData.p.set(b.x,b.y,0);
    for(let i=0;i<trail.length;i++){
      trail[i].position.copy(trail[i].userData.p);
      trail[i].material.opacity=0.30*(1-i/trail.length);
      trail[i].scale.setScalar(1-i/(trail.length*1.3));
    }
  } else {
    ballLight.intensity=0;
    trail.forEach(t=>t.material.opacity=0);
  }

  let high=0;
  for(let r=ROWS-1;r>=0;r--){
    let any=false;
    for(let c=0;c<COLS;c++) if(G.board[r] && G.board[r][c]){ any=true; break; }
    if(any){ high=r; break; }
  }
  const near=clamp((high-(DANGER_ROW-5))/5,0,1);
  dangerLine.material.opacity=0.18+near*(0.35+0.3*Math.sin(tick*7));
  dangerLine.material.color.setHex(near>0.6?0xff4d4d:0xffc63d);
}

/* Locked blocks: one mesh per cell object. A new mesh starts at the row its cell
   locked in (r0), so cells that dropped in the same move slide down with the rest. */
function syncBlocks(dt){
  stamp++;
  for(let r=0;r<ROWS;r++){
    const row=G.board[r]; if(!row) continue;
    for(let c=0;c<COLS;c++){
      const cell=row[c]; if(!cell) continue;
      let v=blocks.get(cell);
      if(!v){
        const mesh=new THREE.Mesh(boxGeo, blockMat(cell.color,false));
        mesh.position.set(cx(c), cy(cell.r0), 0);
        blockRoot.add(mesh);
        v={mesh, hp:BLOCK_HP, seen:0}; blocks.set(cell, v);
      }
      if(v.hp!==cell.hp){            // hit but still standing: cracked look (at 0 hp the cell is gone)
        v.hp=cell.hp;
        v.mesh.material=blockMat(cell.color,true);
        v.mesh.scale.setScalar(0.82);
      }
      v.seen=stamp;
      const ty=cy(r);
      if(Math.abs(v.mesh.position.y-ty)>0.002)
        v.mesh.position.y+=(ty-v.mesh.position.y)*Math.min(1,dt*16);
    }
  }
  for(const [cell,v] of blocks) if(v.seen!==stamp){ blockRoot.remove(v.mesh); blocks.delete(cell); }
}

/* The falling piece: rebuilt when it changes shape (turned, or chipped by the ball),
   snapped into place when a new one spawns, otherwise eased towards its cell. */
function syncPiece(dt){
  const p=G.piece, shape=p?shapeOf(p):-1;
  if(p!==shownPiece || shape!==shownShape){
    while(pieceRoot.children.length) pieceRoot.remove(pieceRoot.children[0]);
    if(p){
      for(let r=0;r<p.size;r++) for(let c=0;c<p.size;c++){
        if(!p.m[r][c]) continue;
        const mesh=new THREE.Mesh(boxGeo, blockMat(p.color,false));
        mesh.position.set(c, -r, 0);
        pieceRoot.add(mesh);
      }
      if(p!==shownPiece) pieceRoot.position.set(cx(p.px), cy(p.py), 0);
    }
    shownPiece=p; shownShape=shape;
  }
  if(p){
    const tx=cx(p.px), ty=cy(p.py);
    const k=1-Math.exp(-26*dt);
    pieceRoot.position.x+=(tx-pieceRoot.position.x)*k;
    pieceRoot.position.y+=(ty-pieceRoot.position.y)*k;
  }
}
const shapeOf = p => { let s=0; for(const row of p.m) for(const v of row) s=s*2+(v?1:0); return s; };

/** Only while a run is in play, as in the original: the paddle mesh follows the
    paddle, and the ghost shows where the piece would land. */
export function updateInPlay(){
  paddle.position.x=G.paddleX;
  paddleGlow.position.x=G.paddleX;
  let used=0;
  const p=G.piece;
  if(p){
    const dy=dropDistance(p);
    if(dy>0){
      for(let r=0;r<p.size;r++) for(let c=0;c<p.size;c++){
        if(!p.m[r][c] || used>=ghostPool.length) continue;
        const m=ghostPool[used++];
        m.position.set(cx(p.px+c), cy(p.py-r-dy), -0.05);
        m.visible=true;
      }
    }
  }
  for(let i=used;i<ghostPool.length;i++) ghostPool[i].visible=false;
}

function hideGhost(){ ghostPool.forEach(m=>{ m.visible=false; }); }
