import THREE from './three.js';
import { isCoarse } from '../device.js';
import { clamp } from '../util.js';
import { COLS, ROWS, DANGER_ROW, BALL_R, PADDLE_Y, PADDLE_HH, PADDLE_HW, HALF_W, HALF_H, cy } from '../config.js';
import { boxGeo, ghostMat, initMaterials } from './materials.js';
import { initParticles } from './particles.js';

/* =========================================================
   Scene: the renderer, camera, lights and every mesh, built once
   (in this order: object ids break draw-order ties). view.js moves
   the dynamic ones each frame.
   ========================================================= */
export let renderer, scene, camera;
export let dangerLine, paddle, paddleGlow, ballMesh, ballLight, blockRoot, pieceRoot, ghostRoot;
export const trail = [], ghostPool = [];
export const camRig = {dist:30, shake:0};
/** Screen-space facts the touch gestures need, refreshed by resize(). */
export const layout = {cellPx:28, zoneY:200};
let stage, pzone;

export function initScene(stageEl, pzoneEl){
  stage = stageEl; pzone = pzoneEl;
  renderer = new THREE.WebGLRenderer({antialias:!isCoarse, alpha:false, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, isCoarse?1.75:2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  stage.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070a16);

  camera = new THREE.PerspectiveCamera(44, 1, 0.1, 200);

  scene.add(new THREE.HemisphereLight(0x7fa8ff, 0x0a0d1c, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 0.75); key.position.set(7,9,16); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff77c4, 0.35); rim.position.set(-9,-6,8); scene.add(rim);
  ballLight = new THREE.PointLight(0x66e9ff, 2.4, 13, 2); scene.add(ballLight);

  backdrop();
  frameBar(0.35, ROWS+0.7, -HALF_W-0.175, 0, 0x2a55b8);
  frameBar(0.35, ROWS+0.7,  HALF_W+0.175, 0, 0x2a55b8);
  frameBar(COLS+0.7, 0.35, 0, -HALF_H-0.175, 0xff2f92);

  dangerLine = new THREE.Mesh(
    new THREE.PlaneGeometry(COLS, 0.07),
    new THREE.MeshBasicMaterial({color:0xffc63d, transparent:true, opacity:0.35}));
  dangerLine.position.set(0, cy(DANGER_ROW)-0.5, -0.4);
  scene.add(dangerLine);

  const paddleMat = new THREE.MeshStandardMaterial({color:0x0d2b3a, emissive:0x32e3ff,
    emissiveIntensity:1.0, roughness:0.28, metalness:0.25});
  paddle = new THREE.Mesh(new THREE.BoxGeometry(PADDLE_HW*2, PADDLE_HH*2, 1.0), paddleMat);
  paddle.position.set(0, PADDLE_Y, 0);
  scene.add(paddle);
  paddleGlow = new THREE.PointLight(0x32e3ff, 1.1, 9, 2);
  paddleGlow.position.set(0, PADDLE_Y, 1.2); scene.add(paddleGlow);

  ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 22, 16),
    new THREE.MeshStandardMaterial({color:0xffffff, emissive:0xa8f0ff, emissiveIntensity:1.5, roughness:0.2}));
  scene.add(ballMesh);

  const TRAIL_N = isCoarse ? 6 : 9;
  for(let i=0;i<TRAIL_N;i++){
    const t=new THREE.Mesh(new THREE.SphereGeometry(BALL_R*0.82,10,8),
      new THREE.MeshBasicMaterial({color:0x7fe6ff, transparent:true, opacity:0.0}));
    t.userData.p=new THREE.Vector3(); scene.add(t); trail.push(t);
  }

  initMaterials();

  blockRoot = new THREE.Group(); scene.add(blockRoot);
  pieceRoot = new THREE.Group(); scene.add(pieceRoot);
  ghostRoot = new THREE.Group(); scene.add(ghostRoot);

  initParticles(scene);

  for(let i=0;i<16;i++){
    const m=new THREE.Mesh(boxGeo, ghostMat);
    m.scale.setScalar(0.94); m.visible=false;
    ghostRoot.add(m); ghostPool.push(m);
  }
}

function backdrop(){
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
}

function frameBar(w,h,x,y,color){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,1.3),
    new THREE.MeshStandardMaterial({color:0x121a33, emissive:color, emissiveIntensity:0.55,
      roughness:0.4, metalness:0.2}));
  m.position.set(x,y,0); scene.add(m); return m;
}

/** Fit the board to the stage and refresh the gesture layout. */
export function resize(){
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
  layout.cellPx = w/visW;
  const yw=cy(DANGER_ROW)-0.5;
  layout.zoneY = clamp((0.5 - yw/visH)*h, 70, h*0.55);
  pzone.style.height = Math.round(layout.zoneY)+'px';
}

/** Screen x → world x on the board plane. */
export function pointerToWorldX(clientX){
  const rect=renderer.domElement.getBoundingClientRect();
  const nx=((clientX-rect.left)/rect.width)*2-1;
  const vFov=camera.fov*Math.PI/180;
  const halfW=Math.tan(vFov/2)*camRig.dist*camera.aspect;
  return nx*halfW;
}

/** Shake to min(shake + amount, cap), which can also lower it. */
export function shake(amount, cap){ camRig.shake=Math.min(camRig.shake+amount,cap); }
export function setShake(v){ camRig.shake=v; }

/** Decay the shake and place the camera, jittered, looking slightly up the board. */
export function updateCamera(dt){
  camRig.shake=Math.max(0,camRig.shake-dt*2.2);
  const tilt=0.13;
  const sx=(Math.random()-0.5)*camRig.shake*0.8;
  const sy=(Math.random()-0.5)*camRig.shake*0.8;
  camera.position.set(sx, -Math.sin(tilt)*camRig.dist+sy, Math.cos(tilt)*camRig.dist);
  camera.lookAt(0,0,0);
}

export function render(){ renderer.render(scene,camera); }
