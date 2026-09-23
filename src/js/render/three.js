// The only module that knows where three.js comes from: the vendored r128 UMD build,
// loaded by a classic deferred <script> in index.html before the module graph runs.
// To move to an ES-module build (r152+), replace this file with:
//   import * as THREE from '../../vendor/three.module.min.js'; export default THREE;
const THREE = globalThis.THREE;
if (!THREE) throw new Error('three.js did not load (vendor/three.min.js)');
export default THREE;
