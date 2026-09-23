import { COLS, ROWS } from '../config.js';
import { emit } from '../events.js';
import { G, retune } from './state.js';
import { blockRoot } from '../render/scene.js'; // TEMP until the view draws from state

/** Remove full rows (the rows above drop by reference) and score them; returns how many. */
export function clearLines(){
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
