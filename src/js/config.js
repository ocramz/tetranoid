import { isCoarse } from './device.js';

/* =========================================================
   Board geometry
   World units: one cell = 1, origin at the centre of the board, row 0 at the bottom.
   ========================================================= */
export const COLS = 12;
export const ROWS = 21;
export const DANGER_ROW = 13;
export const SPAWN_TOP  = 13;
export const BALL_R = 0.34;
export const PADDLE_Y = ROWS/2 - 1.0;
export const PADDLE_HH = 0.25;
export const PADDLE_HW = isCoarse ? 1.6 : 1.45;
export const HALF_W = COLS/2, HALF_H = ROWS/2;

/** Cell column / row → world x / y of the cell centre. */
export const cx = c => c - HALF_W + 0.5;
export const cy = r => r - HALF_H + 0.5;

export const PIECES = [
  {n:'I', c:0x2fe0ff, m:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]]},
  {n:'O', c:0xffd83d, m:[[1,1],[1,1]]},
  {n:'T', c:0xc46cff, m:[[0,1,0],[1,1,1],[0,0,0]]},
  {n:'S', c:0x52f08c, m:[[0,1,1],[1,1,0],[0,0,0]]},
  {n:'Z', c:0xff5468, m:[[1,1,0],[0,1,1],[0,0,0]]},
  {n:'J', c:0x4d88ff, m:[[1,0,0],[1,1,1],[0,0,0]]},
  {n:'L', c:0xffa02e, m:[[0,0,1],[1,1,1],[0,0,0]]}
];
