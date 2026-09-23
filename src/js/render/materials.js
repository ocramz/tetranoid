import THREE from './three.js';

// Shared by the blocks, the falling piece, its ghost and the particles: never dispose these.
export let boxGeo = null, ghostMat = null;
const matCache = new Map();

/** Create the shared geometry and ghost material (called in scene-building order). */
export function initMaterials(){
  boxGeo = new THREE.BoxGeometry(0.92,0.92,0.92);
  ghostMat = new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.12});
}

export function blockMat(color, cracked){
  const k = color+'|'+(cracked?1:0);
  if(matCache.has(k)) return matCache.get(k);
  const c = new THREE.Color(color);
  if(cracked) c.multiplyScalar(0.42);
  const m = new THREE.MeshStandardMaterial({
    color:c, emissive:new THREE.Color(color).multiplyScalar(cracked?0.16:0.45),
    roughness:cracked?0.75:0.32, metalness:0.15});
  matCache.set(k,m); return m;
}
