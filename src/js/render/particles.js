import THREE from './three.js';
import { isCoarse } from '../device.js';
import { rnd } from '../util.js';
import { blockMat } from './materials.js';

/* A fixed pool of little cubes, recycled round-robin by burst(). */
const PART_N = isCoarse ? 150 : 260;
const parts=[];
let partIdx=0;

export function initParticles(scene){
  const partGeo = new THREE.BoxGeometry(0.2,0.2,0.2);
  for(let i=0;i<PART_N;i++){
    const m=new THREE.Mesh(partGeo, blockMat(0xffffff,false));
    m.visible=false; scene.add(m);
    parts.push({mesh:m, life:0, max:1, vx:0, vy:0, vz:0, rx:0, ry:0});
  }
}

export function burst(x,y,color,count,power){
  for(let i=0;i<count;i++){
    const p=parts[partIdx=(partIdx+1)%parts.length];
    p.mesh.material = blockMat(color,false);
    p.mesh.position.set(x+rnd(-0.3,0.3), y+rnd(-0.3,0.3), rnd(-0.2,0.4));
    p.mesh.rotation.set(rnd(0,3),rnd(0,3),0);
    p.mesh.visible=true;
    const a=rnd(0,Math.PI*2), s=rnd(2,7)*(power||1);
    p.vx=Math.cos(a)*s; p.vy=Math.sin(a)*s+2; p.vz=rnd(1,5);
    p.rx=rnd(-9,9); p.ry=rnd(-9,9);
    p.max=p.life=rnd(0.35,0.7);
  }
}

export function updateParts(dt){
  for(let i=0;i<parts.length;i++){
    const p=parts[i]; if(p.life<=0) continue;
    p.life-=dt;
    if(p.life<=0){ p.mesh.visible=false; continue; }
    p.vy-=26*dt; p.vz-=10*dt;
    p.mesh.position.x+=p.vx*dt; p.mesh.position.y+=p.vy*dt; p.mesh.position.z+=p.vz*dt;
    p.mesh.rotation.x+=p.rx*dt; p.mesh.rotation.y+=p.ry*dt;
    p.mesh.scale.setScalar(Math.max(0.001,p.life/p.max));
  }
}

/** Hide every particle (menu / new game); the round-robin index is left as is. */
export function clearParticles(){ parts.forEach(p=>{p.life=0;p.mesh.visible=false;}); }
