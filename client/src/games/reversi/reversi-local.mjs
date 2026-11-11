/** Pure same-device Reversi state machine. Nothing is sent to the server. */
import {BLACK,WHITE,startingBoard,playDisc,legalMoves,discCounts} from './reversi-rules.mjs';

const opponent=disc=>disc===BLACK?WHITE:BLACK;
export function freshLocal(round=1,names=['Player 1','Player 2']){
  return {round,blackSeat:(round-1)%2,names:names.map(v=>typeof v==='string'?v.trim().slice(0,20)||'Player':'Player'),
    phase:'playing',board:startingBoard(),turn:BLACK,moves:[],passed:null,
    winner:null,draw:false,resignedBy:null};
}
export function playLocal(s,index){
  if(s.phase!=='playing')throw new Error('The game has finished.');
  const result=playDisc(s.board,index,s.turn);
  const next=opponent(s.turn),nextLegal=legalMoves(result.board,next),sameLegal=legalMoves(result.board,s.turn);
  const done=nextLegal.length===0&&sameLegal.length===0;
  const counts=discCounts(result.board);
  const winner=done?(counts.black===counts.white?null:counts.black>counts.white?BLACK:WHITE):null;
  return {...s,board:result.board,turn:nextLegal.length?next:s.turn,
    phase:done?'finished':'playing',winner,draw:done&&winner===null,passed:!done&&!nextLegal.length?next:null,
    moves:[...s.moves,{index,disc:s.turn,flipped:result.flipped,board:[...result.board]}]};
}
export function resignLocal(s){
  if(s.phase!=='playing')throw new Error('The game has finished.');
  return {...s,phase:'finished',winner:opponent(s.turn),draw:false,resignedBy:s.turn,passed:null};
}
export function rematchLocal(s){
  if(s.phase!=='finished')throw new Error('Finish the round first.');
  return freshLocal(s.round+1,s.names);
}
export function localPlayerName(s,disc){
  const index=disc===BLACK?s.blackSeat:1-s.blackSeat;
  return s.names[index];
}
export function inspectLocal(s){
  const scores=discCounts(s.board);
  return {scores,legal:s.phase==='playing'?legalMoves(s.board,s.turn):[],lastMove:s.moves.at(-1)||null};
}
export function restoreLocal(input){
  const fallback=freshLocal();
  if(!input||typeof input!=='object'||!Number.isInteger(input.round)||input.round<1||input.round>100000||
    !Array.isArray(input.names)||input.names.length!==2||input.names.some(n=>typeof n!=='string'||!n.trim()||n.length>20)||
    input.blackSeat!==(input.round-1)%2||!Array.isArray(input.moves)||input.moves.length>60)return fallback;
  try{
    let state=freshLocal(input.round,input.names);
    for(const row of input.moves){
      if(!row||!Number.isInteger(row.index)||row.index<0||row.index>=64||row.disc!==state.turn)throw Error('Invalid move');
      const next=playLocal(state,row.index);
      if(JSON.stringify(next.board)!==JSON.stringify(row.board)||JSON.stringify(next.moves.at(-1).flipped)!==JSON.stringify(row.flipped))throw Error('Tampered history');
      state=next;
    }
    if(input.phase==='finished'&&input.resignedBy!==null){
      if(state.phase!=='playing'||input.resignedBy!==state.turn)throw Error('Invalid resignation');
      state=resignLocal(state);
    }
    if(JSON.stringify(state.board)!==JSON.stringify(input.board)||state.phase!==input.phase||
      state.turn!==input.turn||state.winner!==input.winner||state.draw!==input.draw||
      state.passed!==input.passed||state.resignedBy!==input.resignedBy)throw Error('Inconsistent save');
    return state;
  }catch{return fallback;}
}
