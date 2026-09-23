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

/* =========================================================
   Tuning: the knobs for how the game plays
   ========================================================= */
// speed level = 1 + lines/LINES_PER_LEVEL + seconds/SECONDS_PER_LEVEL (whole numbers);
// gravity: FALL_BASE seconds per row at level 1 (longer on touch), × FALL_DECAY per level
export const LINES_PER_LEVEL = 4, SECONDS_PER_LEVEL = 50;
export const FALL_BASE = isCoarse ? 0.34 : 0.30, FALL_DECAY = 0.90, FALL_MIN = 0.15;
// a landed piece locks after LOCK_DELAY s; moving or turning it restarts that, LOCK_RESETS times
export const LOCK_DELAY = 0.40, LOCK_RESETS = 8;
// held controls: the first repeat after DAS s, then every ARR s; soft drop every SOFT_REPEAT s
export const DAS = 0.17, ARR = 0.055, SOFT_REPEAT = 0.045;

// player 1 scores lines (× level, for 1-4 at once), locks, and rows dropped
export const LINE_SCORES = [0,100,300,500,800];
export const LOCK_SCORE = 12, SOFT_DROP_SCORE = 1, HARD_DROP_SCORE = 2;
// player 2 scores what the ball breaks: blocks take BLOCK_HP hits (crack, then smash)
export const BLOCK_HP = 2, CRACK_SCORE = 10, SMASH_SCORE = 40, CHIP_SCORE = 55;

// the ball: seconds before a serve, speed at serve (+ per level, capped), speed-up per paddle hit
export const BALLS = 3, FIRST_SERVE = 0.9, RESERVE_DELAY = 1.1;
export const BALL_SPEED = 10.8, BALL_SPEED_PER_LEVEL = 0.35, BALL_SPEED_LEVEL_CAP = 3;
export const BALL_SPEEDUP = 0.22, BALL_SPEED_MAX = 20;
// the paddle: the machine chases its prediction (off by up to ±AI_ERROR per serve);
// player 2's arrow keys slide it at PADDLE_SPEED
export const AI_GAIN = 9, AI_MAX_SPEED = 13.5, AI_ERROR = 0.7, PADDLE_SPEED = 17;

export const PIECES = [
  {n:'I', c:0x2fe0ff, m:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]]},
  {n:'O', c:0xffd83d, m:[[1,1],[1,1]]},
  {n:'T', c:0xc46cff, m:[[0,1,0],[1,1,1],[0,0,0]]},
  {n:'S', c:0x52f08c, m:[[0,1,1],[1,1,0],[0,0,0]]},
  {n:'Z', c:0xff5468, m:[[1,1,0],[0,1,1],[0,0,0]]},
  {n:'J', c:0x4d88ff, m:[[1,0,0],[1,1,1],[0,0,0]]},
  {n:'L', c:0xffa02e, m:[[0,0,1],[1,1,1],[0,0,0]]}
];
