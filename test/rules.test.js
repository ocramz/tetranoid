// Unit tests for the pure rules in src/js/game (no browser needed).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { COLS, DANGER_ROW, PIECES, PADDLE_Y, PADDLE_HH, BALL_R, HALF_W, HALF_H,
         LINE_SCORES, LOCK_SCORE, HARD_DROP_SCORE, BLOCK_HP, CRACK_SCORE, SMASH_SCORE, CHIP_SCORE } from '../src/js/config.js';
import { on } from '../src/js/events.js';
import { G, newBoard, gameOver } from '../src/js/game/state.js';
import { pullPiece, collides, tryRotate, movePiece, hardDrop, lockPiece } from '../src/js/game/piece.js';
import { damageCell, updateBall } from '../src/js/game/ball.js';
import { predictX } from '../src/js/game/paddle.js';

beforeEach(() => {
  newBoard();
  Object.assign(G, { state: 'playing', piece: null, next: null, bag: [], s1: 0, s2: 0, lines: 0, level: 1,
    time: 0, balls: 3, grounded: false, lockT: 0, lockResets: 0, fallT: 0, auto: true, paddleX: 0 });
  Object.assign(G.ball, { x: 0, y: 0, vx: 0, vy: 0, speed: 11, alive: false });
});

/** A fresh piece by name, placed with its matrix's top-left cell at column px, row py. */
function piece(name, px, py) {
  const def = PIECES.find(d => d.n === name);
  return { name, color: def.c, m: def.m.map(r => r.slice()), size: def.m.length, px, py };
}
/** Record events of `type` for the duration of a test. */
function listen(t, type) {
  const seen = [];
  t.after(on(type, e => seen.push(e ?? true)));
  return seen;
}
const block = () => ({ color: 0x888888, hp: BLOCK_HP, r0: 0 });
const fillRow = (r, except = -1) => { for (let c = 0; c < COLS; c++) if (c !== except) G.board[r][c] = block(); };

test('pieces collide with the walls, the floor and locked blocks, not with open space', () => {
  const t = piece('T', 4, 5);                  // T: row 0 = .X., row 1 = XXX
  assert.equal(collides(t), false);
  assert.equal(collides(t, -1, 5), true);      // left column of the matrix row 1 is filled
  assert.equal(collides(t, COLS - 2, 5), true);
  assert.equal(collides(t, 4, 0), true);       // row 1 of the matrix would be at row -1
  G.board[4][5] = block();                     // under the T's stem
  assert.equal(collides(t), true);
});

test('four turns bring a piece back; a turn and its reverse cancel out', () => {
  for (const name of ['I', 'T', 'S', 'Z', 'J', 'L']) {
    const p = G.piece = piece(name, 4, 10), m0 = JSON.stringify(p.m);
    for (let i = 0; i < 4; i++) tryRotate(1);
    assert.equal(JSON.stringify(p.m), m0, name);
    tryRotate(1); tryRotate(-1);
    assert.equal(JSON.stringify(p.m), m0, name);
    assert.equal(p.px, 4, name);
  }
});

test('a blocked turn kicks sideways, trying 0, -1, +1, -2, +2 in that order', () => {
  // Turned in place, this T would overlap the block below its stem; -1 and +1 both fit.
  const t = G.piece = piece('T', 4, 10);
  G.board[8][5] = block();
  tryRotate(1);
  assert.equal(t.px, 3, 'the -1 kick wins over +1');

  // A vertical I hugging the left wall needs the +2 kick to lie flat.
  newBoard();
  const p = G.piece = piece('I', 4, 10);
  tryRotate(1);                                // now vertical, in matrix column 2
  while (movePiece(-1));                       // as far left as it goes
  assert.equal(p.px, -2);
  tryRotate(-1);                               // flat again: needs px >= 0, the +2 kick
  assert.equal(p.px, 0);
  assert.ok(p.m[1].every(Boolean) || p.m[2].every(Boolean));
});

test('clearing a line drops the rows above by reference and scores at the pre-clear level', t => {
  const cleared = listen(t, 'linesCleared');
  fillRow(0, 5);                               // row 0 full except column 5
  const above = G.board[1][0] = block();       // a block sitting on row 1
  G.lines = 3;                                 // one more line reaches level 2
  G.piece = piece('I', 3, 6);
  tryRotate(1);                                // vertical I in column 5, rows 6-3
  hardDrop();                                  // falls 3 rows to fill the gap
  assert.equal(G.lines, 4);
  assert.equal(G.board[0][0], above, 'row 1 moved down to row 0, same cell object');
  assert.equal(G.s1, 3 * HARD_DROP_SCORE + LOCK_SCORE + LINE_SCORES[1] * 1, 'the line scores at level 1');
  assert.equal(G.level, 2, 'the speed level catches up after scoring');
  assert.deepEqual(cleared, [{ n: 1 }]);
});

test('a block cracks, then smashes; the ball scores for player 2', t => {
  const cracks = listen(t, 'crack'), smashes = listen(t, 'smash');
  G.board[2][3] = block();
  damageCell(2, 3, true);
  assert.equal(G.board[2][3].hp, BLOCK_HP - 1);
  assert.equal(G.s2, CRACK_SCORE);
  damageCell(2, 3, true);
  assert.equal(G.board[2][3], null);
  assert.equal(G.s2, CRACK_SCORE + SMASH_SCORE);
  assert.equal(cracks.length, 1);
  assert.equal(smashes.length, 1);
});

test('the ball chips the falling piece; a piece chipped away entirely is replaced', t => {
  const chips = listen(t, 'chip');
  const p = G.piece = piece('O', 4, 10);       // cells at rows 10-9, columns 4-5
  damageCell(10, 4, true);
  assert.equal(p.m[0][0], 0);
  assert.equal(G.s2, CHIP_SCORE);
  for (const [r, c] of [[10, 5], [9, 4], [9, 5]]) damageCell(r, c, true);
  assert.equal(chips.length, 4);
  assert.notEqual(G.piece, p, 'a new piece took its place');
});

test('locking at the danger line ends the run once, blamed on the stack', t => {
  const overs = listen(t, 'over');
  G.piece = piece('O', 0, DANGER_ROW + 1);     // rests on a tower reaching the danger line
  for (let r = 0; r < DANGER_ROW; r++) G.board[r][0] = block();
  lockPiece();
  gameOver('balls');                           // already over: ignored
  assert.equal(G.state, 'over');
  assert.deepEqual(overs, [{ why: 'stack' }]);
});

test('losing the last ball ends the run, blamed on the balls', t => {
  const overs = listen(t, 'over'), lost = listen(t, 'ballLost');
  G.balls = 1;
  Object.assign(G.ball, { alive: true, x: HALF_W - 1, y: HALF_H + 0.65, vx: 0, vy: 10 }); // past the paddle
  G.paddleX = -HALF_W;                         // nowhere near
  updateBall(1 / 60);
  assert.equal(lost.length, 1);
  assert.equal(G.balls, 0);
  assert.deepEqual(overs, [{ why: 'balls' }]);
});

test('the paddle AI predicts where the ball meets it, bouncing off the side walls', () => {
  const b = G.ball, targetY = PADDLE_Y - PADDLE_HH - BALL_R, lim = HALF_W - BALL_R;
  Object.assign(b, { alive: true, x: 0, y: 0, vx: 10, vy: 10 });
  const straight = targetY;                    // would reach x = targetY without walls
  assert.ok(straight > lim, 'the path hits the right wall');
  assert.ok(Math.abs(predictX() - (2 * lim - straight)) < 1e-9);
  Object.assign(b, { vx: 1, vy: 10 });         // no wall in the way
  assert.ok(Math.abs(predictX() - targetY / 10) < 1e-9);
  b.vy = -10;                                  // moving away: drift towards the ball
  assert.equal(predictX(), b.x * 0.35);
  b.alive = false;
  assert.equal(predictX(), 0);
});

test('pieces come in bags: every 7 in a row is one of each', () => {
  const names = Array.from({ length: 28 }, () => pullPiece().name);
  for (let i = 0; i < names.length; i += 7)
    assert.deepEqual(names.slice(i, i + 7).sort(), ['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
});
