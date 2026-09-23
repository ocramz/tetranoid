// Touch-first (coarse pointer) devices get a wider paddle, gentler gravity and a cheaper renderer.
// Reads only, so it is safe to import in Node, where it reports false.
export const isCoarse = typeof window !== 'undefined' && (
  (window.matchMedia && matchMedia('(pointer:coarse)').matches)
  || ('ontouchstart' in window) || navigator.maxTouchPoints > 0);
