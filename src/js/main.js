import THREE from './render/three.js';
import { isCoarse } from './device.js';
import { clamp, rnd, byId } from './util.js';
import { COLS, ROWS, DANGER_ROW, SPAWN_TOP, BALL_R, PADDLE_Y, PADDLE_HH, PADDLE_HW, HALF_W, HALF_H,
         cx, cy, PIECES } from './config.js';
import { Snd } from './fx/audio.js';
import { buzz } from './fx/haptics.js';
import { boxGeo, ghostMat, blockMat, initMaterials } from './render/materials.js';
import { initParticles, updateParts, clearParticles } from './render/particles.js';
import { keepAwake } from './platform/wakelock.js';
import { emit } from './events.js';
import { initFeedback } from './fx/feedback.js';

if(isCoarse) document.body.classList.add('touch');

/* =========================================================
   Scene
   ========================================================= */
const stage = byId('stage');
const pzone = byId('pzone');
const renderer = new THREE.WebGLRenderer({antialias:!isCoarse, alpha:false, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, isCoarse?1.75:2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a16);

const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 200);
const camRig = {dist:30, shake:0};

scene.add(new THREE.HemisphereLight(0x7fa8ff, 0x0a0d1c, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 0.75); key.position.set(7,9,16); scene.add(key);
const rim = new THREE.DirectionalLight(0xff77c4, 0.35); rim.position.set(-9,-6,8); scene.add(rim);
const ballLight = new THREE.PointLight(0x66e9ff, 2.4, 13, 2); scene.add(ballLight);

(function backdrop(){
  const s=64, cv=document.createElement('canvas'); cv.width=cv.height=s;
  const g=cv.getContext('2d');
  g.strokeStyle='rgba(120,168,255,0.20)'; g.lineWidth=2;
  g.strokeRect(1,1,s-2,s-2);
  const tex=new THREE.CanvasTexture(cv);
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(COLS,ROWS);
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(COLS,ROWS),
    new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:0.65}));
  panel.position.z=-0.62; scene.add(panel);
  const bg=new THREE.Mesh(new THREE.PlaneGeometry(COLS,ROWS),
    new THREE.MeshBasicMaterial({color:0x0b1226}));
  bg.position.z=-0.7; scene.add(bg);
})();

function frameBar(w,h,x,y,color){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,1.3),
    new THREE.MeshStandardMaterial({color:0x121a33, emissive:color, emissiveIntensity:0.55,
      roughness:0.4, metalness:0.2}));
  m.position.set(x,y,0); scene.add(m); return m;
}
frameBar(0.35, ROWS+0.7, -HALF_W-0.175, 0, 0x2a55b8);
frameBar(0.35, ROWS+0.7,  HALF_W+0.175, 0, 0x2a55b8);
frameBar(COLS+0.7, 0.35, 0, -HALF_H-0.175, 0xff2f92);

const dangerLine = new THREE.Mesh(
  new THREE.PlaneGeometry(COLS, 0.07),
  new THREE.MeshBasicMaterial({color:0xffc63d, transparent:true, opacity:0.35}));
dangerLine.position.set(0, cy(DANGER_ROW)-0.5, -0.4);
scene.add(dangerLine);

const paddleMat = new THREE.MeshStandardMaterial({color:0x0d2b3a, emissive:0x32e3ff,
  emissiveIntensity:1.0, roughness:0.28, metalness:0.25});
const paddle = new THREE.Mesh(new THREE.BoxGeometry(PADDLE_HW*2, PADDLE_HH*2, 1.0), paddleMat);
paddle.position.set(0, PADDLE_Y, 0);
scene.add(paddle);
const paddleGlow = new THREE.PointLight(0x32e3ff, 1.1, 9, 2);
paddleGlow.position.set(0, PADDLE_Y, 1.2); scene.add(paddleGlow);

const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 22, 16),
  new THREE.MeshStandardMaterial({color:0xffffff, emissive:0xa8f0ff, emissiveIntensity:1.5, roughness:0.2}));
scene.add(ballMesh);

const TRAIL_N = isCoarse ? 6 : 9;
const trail=[];
for(let i=0;i<TRAIL_N;i++){
  const t=new THREE.Mesh(new THREE.SphereGeometry(BALL_R*0.82,10,8),
    new THREE.MeshBasicMaterial({color:0x7fe6ff, transparent:true, opacity:0.0}));
  t.userData.p=new THREE.Vector3(); scene.add(t); trail.push(t);
}

initMaterials();

const blockRoot = new THREE.Group(); scene.add(blockRoot);
const pieceRoot = new THREE.Group(); scene.add(pieceRoot);
const ghostRoot = new THREE.Group(); scene.add(ghostRoot);

initParticles(scene);
initFeedback(camRig);

/* =========================================================
   State
   ========================================================= */
const G = {
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
const UI = {cellPx:28, zoneY:200};

function newBoard(){
  G.board=[];
  for(let r=0;r<ROWS;r++) G.board.push(new Array(COLS).fill(null));
}
function clearMeshes(){
  while(blockRoot.children.length) blockRoot.remove(blockRoot.children[0]);
  while(pieceRoot.children.length) pieceRoot.remove(pieceRoot.children[0]);
  ghostRoot.children.forEach(m=>{ m.visible=false; });
}

/* ---- pieces ---- */
function refillBag(){
  const b=[0,1,2,3,4,5,6];
  for(let i=b.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=b[i]; b[i]=b[j]; b[j]=t; }
  G.bag=G.bag.concat(b);
}
function pullPiece(){
  if(G.bag.length<2) refillBag();
  const def=PIECES[G.bag.shift()];
  const m=def.m.map(row=>row.slice());
  return {name:def.n, color:def.c, m, size:m.length,
          px:Math.floor((COLS-m.length)/2), py:SPAWN_TOP};
}
function pieceCells(p){
  const out=[];
  for(let r=0;r<p.size;r++) for(let c=0;c<p.size;c++)
    if(p.m[r][c]) out.push([p.py-r, p.px+c, r, c]);
  return out;
}
function collides(p, px, py, m){
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
function tryRotate(dir){
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
function movePiece(dx){
  const p=G.piece; if(!p) return false;
  if(!collides(p, p.px+dx, p.py)){ p.px+=dx; resetLock(); syncPiece(); return true; }
  return false;
}
function resetLock(){ if(G.grounded && G.lockResets<8){ G.lockT=0; G.lockResets++; } }

function spawnPiece(){
  G.piece = G.next || pullPiece();
  G.next  = pullPiece();
  G.fallT=0; G.lockT=0; G.lockResets=0; G.grounded=false;
  drawNext();
  if(collides(G.piece)){ gameOver('stack'); return; }
  buildPieceMeshes();
  pieceRoot.position.set(cx(G.piece.px), cy(G.piece.py), 0);
}
function buildPieceMeshes(){
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
function stepDown(soft){
  const p=G.piece; if(!p) return;
  if(!collides(p, p.px, p.py-1)){
    p.py--; G.grounded=false; G.lockT=0;
    if(soft) G.s1+=1;
  } else G.grounded=true;
}
function hardDrop(){
  const p=G.piece; if(!p) return;
  let n=0;
  while(!collides(p,p.px,p.py-1)){ p.py--; n++; }
  G.s1+=n*2;
  pieceRoot.position.y=cy(p.py);
  lockPiece();
}
function lockPiece(){
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
function retune(){
  const lv = 1 + Math.floor(G.lines/4) + Math.floor(G.time/50);
  G.level = lv;
  G.fallEvery = Math.max(0.15, (isCoarse?0.34:0.30)*Math.pow(0.90, lv-1));
}
function clearLines(){
  let cleared=0;
  for(let r=0;r<ROWS;r++){
    let full=true;
    for(let c=0;c<COLS;c++) if(!G.board[r][c]){ full=false; break; }
    if(!full) continue;
    cleared++;
    const colors=[];
    for(let c=0;c<COLS;c++){
      const cell=G.board[r][c];
      colors.push(cell.color);
      blockRoot.remove(cell.mesh);
      G.board[r][c]=null;
    }
    emit('rowCleared', {row:r, colors});
    for(let rr=r;rr<ROWS-1;rr++) G.board[rr]=G.board[rr+1];
    G.board[ROWS-1]=new Array(COLS).fill(null);
    r--;
  }
  if(cleared){
    const table=[0,100,300,500,800];
    G.s1 += table[Math.min(cleared,4)]*G.level;
    G.lines+=cleared;
    retune();
    emit('linesCleared', {n:cleared});
  }
  return cleared;
}

/* ---- destruction ---- */
function damageCell(row,col,fromBall){
  if(row<0||row>=ROWS||col<0||col>=COLS) return;
  const cell=G.board[row][col];
  if(cell){
    cell.hp--;
    if(cell.hp<=0){
      blockRoot.remove(cell.mesh);
      G.board[row][col]=null;
      if(fromBall) G.s2+=40;
      emit('smash', {row, col, color:cell.color});
    } else {
      cell.mesh.material=blockMat(cell.color,true);
      cell.mesh.scale.setScalar(0.82);
      if(fromBall) G.s2+=10;
      emit('crack', {row, col, color:cell.color});
    }
    return;
  }
  const p=G.piece;
  if(p){
    const r=p.py-row, c=col-p.px;
    if(r>=0&&r<p.size&&c>=0&&c<p.size&&p.m[r][c]){
      p.m[r][c]=0;
      if(fromBall) G.s2+=55;
      emit('chip', {row, col, color:p.color});
      buildPieceMeshes();
      if(pieceCells(p).length===0){ G.piece=null; spawnPiece(); }
    }
  }
}
function occupied(row,col){
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
function serveBall(){
  const b=G.ball;
  b.x=clamp(G.paddleX,-HALF_W+1,HALF_W-1);
  b.y=PADDLE_Y-1.1;
  b.speed=10.8+Math.min(G.level*0.35,3);
  const a=rnd(-0.5,0.5);
  b.vx=Math.sin(a)*b.speed;
  b.vy=-Math.cos(a)*b.speed;
  b.alive=true;
  G.aiErr=rnd(-0.7,0.7);
  for(let i=0;i<trail.length;i++) trail[i].userData.p.set(b.x,b.y,0);
}
function loseBall(){
  const b=G.ball; b.alive=false;
  G.balls--;
  emit('ballLost', {x:b.x});
  drawBalls();
  if(G.balls<=0){ gameOver('balls'); return; }
  G.serveT=1.1;
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
function updateBall(dt){
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
        b.speed = Math.min(b.speed+0.22, 20);
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

/* =========================================================
   Paddle
   ========================================================= */
function predictX(){
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
function updatePaddle(dt, keys){
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
  paddle.position.x=G.paddleX;
  paddleGlow.position.x=G.paddleX;
}

/* =========================================================
   Ghost
   ========================================================= */
const ghostPool=[];
for(let i=0;i<16;i++){
  const m=new THREE.Mesh(boxGeo, ghostMat);
  m.scale.setScalar(0.94); m.visible=false;
  ghostRoot.add(m); ghostPool.push(m);
}
function updateGhost(){
  let used=0;
  const p=G.piece;
  if(p){
    let dy=0;
    while(!collides(p,p.px,p.py-dy-1) && dy<ROWS) dy++;
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

/* =========================================================
   HUD
   ========================================================= */
const el = {
  s1:byId('s1'), s2:byId('s2'), lines:byId('lines'), level:byId('level'),
  balls:byId('balls'), next:byId('next'), mode:byId('mode'), veil:byId('veil')
};
const nextCells=[];
for(let i=0;i<16;i++){ const d=document.createElement('i'); el.next.appendChild(d); nextCells.push(d); }
function drawNext(){
  const p=G.next;
  for(let i=0;i<16;i++){ nextCells[i].style.background='transparent'; nextCells[i].style.boxShadow='none'; }
  if(!p) return;
  const off=Math.floor((4-p.size)/2);
  for(let r=0;r<p.size;r++) for(let c=0;c<p.size;c++){
    if(!p.m[r][c]) continue;
    const i=(r+off)*4+(c+off);
    if(i<0||i>=16) continue;
    const hex='#'+p.color.toString(16).padStart(6,'0');
    nextCells[i].style.background=hex;
    nextCells[i].style.boxShadow='0 0 6px '+hex;
  }
}
function drawBalls(){
  el.balls.innerHTML='';
  for(let i=0;i<3;i++){
    const s=document.createElement('span');
    if(i>=G.balls) s.className='gone';
    el.balls.appendChild(s);
  }
}
let hudCache={};
function drawHUD(){
  if(hudCache.s1!==G.s1){ el.s1.textContent=G.s1.toLocaleString(); hudCache.s1=G.s1; }
  if(hudCache.s2!==G.s2){ el.s2.textContent=G.s2.toLocaleString(); hudCache.s2=G.s2; }
  if(hudCache.lines!==G.lines){ el.lines.textContent=G.lines; hudCache.lines=G.lines; }
  if(hudCache.level!==G.level){ el.level.textContent=G.level; hudCache.level=G.level; }
  if(hudCache.auto!==G.auto){
    el.mode.innerHTML='paddle: <b>'+(G.auto?'auto':'you')+'</b>';
    hudCache.auto=G.auto;
  }
}
function showVeil(html){
  el.veil.innerHTML=html;
  el.veil.classList.remove('hide');
  document.body.classList.add('menu');
}
function hideVeil(){ el.veil.classList.add('hide'); document.body.classList.remove('menu'); }

/* =========================================================
   Menus
   ========================================================= */
const MENU_HTML =
  '<h1 class="title">TETRANOID</h1>'+
  '<p class="tag">Pieces spawn mid-field and sink to the floor. A ball runs loose above them. '+
  '<em>Player 1</em> makes lines out of whatever survives. <em>Player 2</em> keeps the ball alive and '+
  'chews the stack apart. The run ends when the stack reaches the spawn line, or when the last ball '+
  'slips past the paddle.</p>'+
  '<div class="keys">'+
    '<div class="keycol a"><h4>Player 1 — pieces</h4>'+
      '<div class="tc">'+
        '<p><span class="gl">↔</span>drag anywhere to slide</p>'+
        '<p><span class="gl">⊙</span>tap to rotate</p>'+
        '<p><span class="gl">↓</span>drag down to sink, flick to slam</p>'+
        '<p><span class="gl">✛</span>or the pad: cross moves and drops, A and B turn</p>'+
      '</div>'+
      '<div class="kb">'+
        '<p><kbd>A</kbd><kbd>D</kbd> move sideways</p>'+
        '<p><kbd>W</kbd> rotate · <kbd>S</kbd> soft drop</p>'+
        '<p><kbd>Shift</kbd> slam to the floor</p>'+
      '</div>'+
    '</div>'+
    '<div class="keycol b"><h4>Player 2 — paddle</h4>'+
      '<div class="tc">'+
        '<p>Drag in the marked band at the top</p>'+
        '<p>Three balls. Miss, and one is gone</p>'+
      '</div>'+
      '<div class="kb">'+
        '<p><kbd>←</kbd><kbd>→</kbd> or mouse to slide</p>'+
        '<p><kbd>P</kbd> hand the paddle back to the machine</p>'+
        '<p>Three balls. Miss, and one is gone</p>'+
      '</div>'+
    '</div>'+
  '</div>'+
  '<div class="btns">'+
    '<button class="go" id="btn1">Play solo, paddle on auto</button>'+
    '<button class="go alt" id="btn2">Two players</button>'+
  '</div>';

function showMenu(){
  G.state='menu';
  resetKeys();
  G.piece=null; G.ball.alive=false;
  clearMeshes(); newBoard();
  clearParticles();
  keepAwake(false);
  showVeil(MENU_HTML);
  byId('btn1').onclick=()=>startGame(true);
  byId('btn2').onclick=()=>startGame(false);
}

function startGame(auto){
  Snd.ensure();
  G.state='playing';
  G.lines=0; G.level=1; G.s1=0; G.s2=0; G.balls=3;
  G.fallEvery=isCoarse?0.34:0.30; G.time=0; G.bag=[]; G.next=null; G.piece=null;
  G.paddleX=0; G.paddleTarget=0; G.serveT=0.9; G.ball.alive=false;
  hudCache={};
  setAuto(auto);
  resetKeys();
  newBoard(); clearMeshes();
  clearParticles();
  refillBag();
  G.next=pullPiece();
  spawnPiece();
  drawBalls(); drawNext(); drawHUD();
  hideVeil();
  keepAwake(true);
}
function gameOver(why){
  if(G.state==='over') return;
  G.state='over';
  resetKeys();
  emit('over', {why});
  keepAwake(false);
  const ballsOut = (why==='balls');
  const head = ballsOut ? 'BALL LOST' : 'FIELD BURIED';
  const sub  = ballsOut
    ? 'The last ball slipped past the paddle. Player 2 ended the run.'
    : 'The stack reached the spawn line. Player 1 ended the run.';
  showVeil(
    '<p class="result" style="color:'+(ballsOut?'var(--p2)':'var(--p1)')+'">'+head+'</p>'+
    '<p class="tag">'+sub+' You survived '+Math.floor(G.time)+' seconds.</p>'+
    '<div class="scoreline">'+
      '<div class="sl1">Player 1<b>'+G.s1.toLocaleString()+'</b>'+G.lines+' lines cleared</div>'+
      '<div class="sl2">Player 2<b>'+G.s2.toLocaleString()+'</b>blocks broken</div>'+
    '</div>'+
    '<div class="btns">'+
      '<button class="go" id="again">Play again</button>'+
      '<button class="go alt" id="quit">Back to the start</button>'+
    '</div>');
  byId('again').onclick=()=>startGame(G.auto);
  byId('quit').onclick=showMenu;
}
function togglePause(){
  if(G.state==='playing'){
    G.state='paused';
    resetKeys();
    keepAwake(false);
    showVeil(
      '<p class="result">PAUSED</p>'+
      '<p class="tag">The ball is holding its breath.</p>'+
      '<div class="btns">'+
        '<button class="go" id="vres">Resume</button>'+
        '<button class="go ghost" id="vsnd">Sound: '+(Snd.isMuted()?'off':'on')+'</button>'+
        '<button class="go ghost" id="vpad">Paddle: '+(G.auto?'auto':'player 2')+'</button>'+
        '<button class="go alt" id="vquit">Quit to menu</button>'+
      '</div>');
    byId('vres').onclick=togglePause;
    byId('vsnd').onclick=function(){ const m=Snd.toggle(); this.textContent='Sound: '+(m?'off':'on'); };
    byId('vpad').onclick=function(){ setAuto(!G.auto); this.textContent='Paddle: '+(G.auto?'auto':'player 2'); };
    byId('vquit').onclick=showMenu;
  } else if(G.state==='paused'){
    G.state='playing'; hideVeil(); keepAwake(true);
  }
}
function setAuto(v){
  G.auto=v;
  if(!v) G.paddleTarget=G.paddleX;
  document.body.classList.toggle('twop', !v);
  hudCache.auto=null; drawHUD();
}

/* =========================================================
   Input
   ========================================================= */
const keys={l:false,r:false,d:false,pl:false,pr:false};
function resetKeys(){ keys.l=keys.r=keys.d=keys.pl=keys.pr=false; }
function takePaddle(){ if(G.auto) setAuto(false); }
let repL=0, repR=0, repD=0;

function onKey(e,down){
  if(down) Snd.ensure();
  switch(e.code){
    case 'KeyA': case 'Numpad4': keys.l=down; if(down&&G.state==='playing'){ movePiece(-1); repL=0.17; } e.preventDefault(); break;
    case 'KeyD': case 'Numpad6': keys.r=down; if(down&&G.state==='playing'){ movePiece(1); repR=0.17; } e.preventDefault(); break;
    case 'KeyS': keys.d=down; if(down) repD=0; e.preventDefault(); break;
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
        if(G.state==='menu') startGame(true);
        else if(G.state==='playing'||G.state==='paused') togglePause();
      }
      break;
  }
}
window.addEventListener('keydown', e=>onKey(e,true));
window.addEventListener('keyup',   e=>onKey(e,false));
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden && G.state==='playing') togglePause();
});
window.addEventListener('blur', ()=>{ if(!isCoarse && G.state==='playing') togglePause(); });

/* ---- screen coordinates ---- */
function pointerToWorldX(clientX){
  const rect=renderer.domElement.getBoundingClientRect();
  const nx=((clientX-rect.left)/rect.width)*2-1;
  const vFov=camera.fov*Math.PI/180;
  const halfW=Math.tan(vFov/2)*camRig.dist*camera.aspect;
  return nx*halfW;
}

/* ---- field gestures: P1 pieces (touch) / P2 paddle ---- */
const g={id:null, mode:null, x0:0, y0:0, lx:0, ly:0, t0:0,
         sx:0, sy:0, st:0, moved:false, slammed:false};

function paddleZoneHit(clientY){
  const rect=stage.getBoundingClientRect();
  return (clientY-rect.top) < UI.zoneY;
}
stage.addEventListener('pointerdown', e=>{
  if(e.target.closest('button')||e.target.closest('.veil')) return;
  Snd.ensure();
  if(G.state!=='playing' || g.id!==null) return;
  const mouse = (e.pointerType==='mouse');
  if(mouse){
    g.mode='paddle';
  } else {
    g.mode = (!G.auto && paddleZoneHit(e.clientY)) ? 'paddle' : 'piece';
  }
  g.id=e.pointerId; g.x0=g.lx=g.sx=e.clientX; g.y0=g.ly=g.sy=e.clientY;
  g.t0=g.st=performance.now(); g.moved=false; g.slammed=false;
  if(g.mode==='paddle' && !G.auto){
    G.paddleTarget=clamp(pointerToWorldX(e.clientX),-(HALF_W-PADDLE_HW),HALF_W-PADDLE_HW);
  }
  if(stage.setPointerCapture) try{ stage.setPointerCapture(e.pointerId); }catch(err){}
  e.preventDefault();
}, {passive:false});

stage.addEventListener('pointermove', e=>{
  if(g.id!==e.pointerId || G.state!=='playing') return;

  if(g.mode==='paddle'){
    if(G.auto){
      if(Math.abs(e.clientX-g.x0)+Math.abs(e.clientY-g.y0) < 14) return;
      takePaddle();
    }
    G.paddleTarget=clamp(pointerToWorldX(e.clientX),-(HALF_W-PADDLE_HW),HALF_W-PADDLE_HW);
    return;
  }

  /* piece gestures */
  const step = Math.max(14, UI.cellPx*0.72);
  const dx = e.clientX-g.lx;
  if(Math.abs(dx)>=step){
    const n=Math.trunc(dx/step), dir=n>0?1:-1;
    for(let i=0;i<Math.abs(n);i++) movePiece(dir);
    g.lx += n*step; g.ly = e.clientY; g.moved=true;
  }

  /* flick down = slam, measured over a short rolling window */
  const now = performance.now();
  const flickY = e.clientY-g.sy, flickX = Math.abs(e.clientX-g.sx);
  if(!g.slammed && flickY > step*2.6 && flickX < flickY*0.7 && now-g.st < 150){
    hardDrop(); g.slammed=true; g.moved=true; buzz(16);
    g.sx=e.clientX; g.sy=e.clientY; g.st=now;
    return;
  }
  if(now-g.st > 90){ g.sx=e.clientX; g.sy=e.clientY; g.st=now; }

  if(!g.slammed){
    const sstep=Math.max(13, UI.cellPx*0.55);
    const dy=e.clientY-g.ly;
    if(dy>=sstep){
      const n=Math.trunc(dy/sstep);
      for(let i=0;i<n;i++) stepDown(true);
      G.fallT=0; g.ly += n*sstep; g.moved=true;
    }
  }
}, {passive:false});

function endGesture(e){
  if(g.id!==e.pointerId) return;
  if(g.mode==='piece' && G.state==='playing' && !g.moved && !g.slammed){
    const age=performance.now()-g.t0;
    const dist=Math.hypot(e.clientX-g.x0, e.clientY-g.y0);
    if(age<280 && dist<15) tryRotate(1);
  }
  g.id=null; g.mode=null;
}
stage.addEventListener('pointerup', endGesture);
stage.addEventListener('pointercancel', endGesture);

/* ---- thumb pad ---- */
document.querySelectorAll('#pad button[data-k]').forEach(btn=>{
  const k=btn.dataset.k;
  if(k==='pause'||k==='sound'){
    btn.addEventListener('click', ()=>{
      Snd.ensure();
      if(k==='pause'){ if(G.state==='playing'||G.state==='paused') togglePause(); }
      else { const m=Snd.toggle(); btn.style.opacity = m?'.45':'1'; btn.textContent = m?'MUTED':'SOUND'; }
    });
    return;
  }
  function press(on){
    if(!on){
      if(k==='left') keys.l=false;
      if(k==='right') keys.r=false;
      if(k==='soft') keys.d=false;
      return;
    }
    Snd.ensure();
    if(G.state!=='playing') return;
    if(k==='left'){ keys.l=true; movePiece(-1); repL=0.17; }
    else if(k==='right'){ keys.r=true; movePiece(1); repR=0.17; }
    else if(k==='soft'){ keys.d=true; repD=0; }
    else if(k==='rotL'){ tryRotate(-1); }
    else if(k==='rotR'){ tryRotate(1); }
    else if(k==='slam'){ hardDrop(); buzz(16); }
  }
  btn.addEventListener('pointerdown', e=>{
    e.preventDefault();
    if(btn.setPointerCapture) try{ btn.setPointerCapture(e.pointerId); }catch(err){}
    press(true);
  });
  ['pointerup','pointercancel','pointerleave'].forEach(t=>
    btn.addEventListener(t, ()=>press(false)));
  btn.addEventListener('contextmenu', e=>e.preventDefault());
});

/* ---- chrome buttons ---- */
byId('bPause').onclick=()=>{ if(G.state==='playing'||G.state==='paused') togglePause(); };
byId('bSound').onclick=function(){
  const m=Snd.toggle();
  this.style.color = m ? 'rgba(139,160,201,.4)' : 'var(--p2)';
};
el.mode.onclick=()=>setAuto(!G.auto);

/* =========================================================
   Resize
   ========================================================= */
function resize(){
  const w=Math.max(1, stage.clientWidth), h=Math.max(1, stage.clientHeight);
  renderer.setSize(w,h,false);
  camera.aspect=w/h;
  const fitH=ROWS+1.5, fitW=COLS+1.5;
  const vFov=camera.fov*Math.PI/180;
  const dH=(fitH/2)/Math.tan(vFov/2);
  const hFov=2*Math.atan(Math.tan(vFov/2)*camera.aspect);
  const dW=(fitW/2)/Math.tan(hFov/2);
  camRig.dist=Math.max(dH,dW)*1.03;
  camera.updateProjectionMatrix();

  const visH=2*Math.tan(vFov/2)*camRig.dist;
  const visW=visH*camera.aspect;
  UI.cellPx = w/visW;
  const yw=cy(DANGER_ROW)-0.5;
  UI.zoneY = clamp((0.5 - yw/visH)*h, 70, h*0.55);
  pzone.style.height = Math.round(UI.zoneY)+'px';
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', ()=>setTimeout(resize,250));
if(window.visualViewport) visualViewport.addEventListener('resize', resize);
if(window.ResizeObserver) new ResizeObserver(resize).observe(stage);
resize();

/* =========================================================
   Loop
   ========================================================= */
let last=performance.now(), tick=0;
function frame(now){
  requestAnimationFrame(frame);
  let dt=(now-last)/1000; last=now;
  dt=Math.max(0,Math.min(dt,0.033));
  tick+=dt;

  if(G.state==='playing'){
    G.time+=dt; retune();
    if(keys.l){ repL-=dt; if(repL<=0){ movePiece(-1); repL=0.055; } }
    if(keys.r){ repR-=dt; if(repR<=0){ movePiece(1); repR=0.055; } }
    if(keys.d){ repD-=dt; if(repD<=0){ stepDown(true); repD=0.045; G.fallT=0; } }

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
    updatePaddle(dt, keys);
    updateGhost();
  }

  updateParts(dt);

  if(G.piece){
    const tx=cx(G.piece.px), ty=cy(G.piece.py);
    const k=1-Math.exp(-26*dt);
    pieceRoot.position.x+=(tx-pieceRoot.position.x)*k;
    pieceRoot.position.y+=(ty-pieceRoot.position.y)*k;
  }
  for(let r=0;r<ROWS;r++){
    const row=G.board[r]; if(!row) continue;
    for(let c=0;c<COLS;c++){
      const cell=row[c]; if(!cell) continue;
      const ty=cy(r);
      if(Math.abs(cell.mesh.position.y-ty)>0.002)
        cell.mesh.position.y+=(ty-cell.mesh.position.y)*Math.min(1,dt*16);
    }
  }

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

  camRig.shake=Math.max(0,camRig.shake-dt*2.2);
  const tilt=0.13;
  const sx=(Math.random()-0.5)*camRig.shake*0.8;
  const sy=(Math.random()-0.5)*camRig.shake*0.8;
  camera.position.set(sx, -Math.sin(tilt)*camRig.dist+sy, Math.cos(tilt)*camRig.dist);
  camera.lookAt(0,0,0);

  drawHUD();
  renderer.render(scene,camera);
}

newBoard();
drawBalls();
drawHUD();
showMenu();
requestAnimationFrame(frame);
