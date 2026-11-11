import {randomBytes, randomUUID} from 'node:crypto';
import {GameError, normalizeName, normalizeRoomCode, ROOM_TTL_MS} from './game-engine.mjs';

export const REVERSI_SIZE = 8;
export const REVERSI_CELLS = 64;
export const BLACK = 1;
export const WHITE = 2;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DIRECTIONS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const inBounds = (row,col) => row>=0&&row<REVERSI_SIZE&&col>=0&&col<REVERSI_SIZE;
const other = disc => disc===BLACK?WHITE:BLACK;

function requireBoard(board) {
  if(!Array.isArray(board)||board.length!==REVERSI_CELLS||board.some(v=>v!==0&&v!==BLACK&&v!==WHITE)) {
    throw new GameError('Invalid Reversi board.');
  }
}
function requireDisc(disc) {
  if(disc!==BLACK&&disc!==WHITE)throw new GameError('Invalid disc colour.');
}
function requirePosition(index) {
  if(!Number.isInteger(index)||index<0||index>=REVERSI_CELLS)throw new GameError('Choose a valid square.');
}
export function startingBoard() {
  const board=Array(REVERSI_CELLS).fill(0);
  board[3*8+3]=WHITE;
  board[3*8+4]=BLACK;
  board[4*8+3]=BLACK;
  board[4*8+4]=WHITE;
  return board;
}
function flipsUnchecked(board,index,disc) {
  if(board[index]!==0)return [];
  const row=Math.floor(index/8),col=index%8,opponent=other(disc),all=[];
  for(const [dr,dc] of DIRECTIONS) {
    let r=row+dr,c=col+dc;
    const line=[];
    while(inBounds(r,c)&&board[r*8+c]===opponent){
      line.push(r*8+c);r+=dr;c+=dc;
    }
    if(line.length&&inBounds(r,c)&&board[r*8+c]===disc)all.push(...line);
  }
  return all;
}
export function flipsForMove(board,index,disc) {
  requireBoard(board);requirePosition(index);requireDisc(disc);
  return flipsUnchecked(board,index,disc);
}
export function legalMoves(board,disc) {
  requireBoard(board);requireDisc(disc);
  const result=[];
  for(let i=0;i<64;i++)if(board[i]===0&&flipsUnchecked(board,i,disc).length)result.push(i);
  return result;
}
export function playDisc(board,index,disc) {
  requireBoard(board);requirePosition(index);requireDisc(disc);
  if(board[index]!==0)throw new GameError('That square is already occupied.');
  const flipped=flipsUnchecked(board,index,disc);
  if(!flipped.length)throw new GameError('Choose a highlighted square that flips an opponent disc.');
  const next=[...board];
  next[index]=disc;
  for(const i of flipped)next[i]=disc;
  return {board:next,flipped};
}
export function discCounts(board) {
  requireBoard(board);
  return {black:board.filter(v=>v===BLACK).length,white:board.filter(v=>v===WHITE).length,
    empty:board.filter(v=>v===0).length};
}
const playerDisc = (room,playerIndex)=>playerIndex===room.blackIndex?BLACK:WHITE;
const createPlayer = (name,isHost)=>({
  id:randomUUID(),token:randomBytes(32).toString('hex'),
  name:normalizeName(name),isHost,socketId:null,rematchReady:false,
});
function makeCode(rooms) {
  let code;
  do {code=Array.from(randomBytes(6),b=>ALPHABET[b%ALPHABET.length]).join('');}
  while(rooms.has(code));
  return code;
}

export function publicReversiRoom(room,viewerId){
  if(!room.players.some(p=>p.id===viewerId))throw new GameError('You do not belong to this Reversi room.');
  return {
    code:room.code,phase:room.phase,round:room.round,you:viewerId,
    board:[...room.board],scores:discCounts(room.board),
    blackPlayerId:room.players[room.blackIndex]?.id||null,
    turnPlayerId:room.phase==='playing'?room.players[room.turnIndex].id:null,
    legalMoves:room.phase==='playing'?legalMoves(room.board,playerDisc(room,room.turnIndex)):[],
    winnerId:room.winnerId,draw:room.draw,moveCount:room.moveCount,
    passedPlayerId:room.passedPlayerId,
    lastMove:room.lastMove?{...room.lastMove,flipped:[...room.lastMove.flipped]}:null,
    players:room.players.map((p,index)=>({
      id:p.id,name:p.name,isHost:p.isHost,online:Boolean(p.socketId),
      rematchReady:p.rematchReady,disc:playerDisc(room,index),
    })),
  };
}

export class ReversiStore {
  constructor(){this.rooms=new Map();}
  create(name){
    if(this.rooms.size>=1000){this.cleanup();if(this.rooms.size>=1000)throw new GameError('Reversi rooms are busy. Try again shortly.');}
    const host=createPlayer(name,true),code=makeCode(this.rooms);
    const room={code,phase:'lobby',round:1,players:[host],
      board:startingBoard(),blackIndex:0,turnIndex:0,
      winnerId:null,draw:false,moveCount:0,lastMove:null,passedPlayerId:null,updatedAt:Date.now()};
    this.rooms.set(code,room);
    return {room,player:host};
  }
  requireRoom(code){
    const room=this.rooms.get(normalizeRoomCode(code));
    if(!room)throw new GameError('Reversi room not found. Check your invite code.');
    if(Date.now()-room.updatedAt>ROOM_TTL_MS){
      this.rooms.delete(room.code);
      throw new GameError('This room has expired. Create a new Reversi room.');
    }
    return room;
  }
  join(code,name,token){
    const room=this.requireRoom(code);
    const returning=token&&room.players.find(p=>p.token===token);
    if(returning){room.updatedAt=Date.now();return {room,player:returning};}
    if(room.players.length>=2||room.phase!=='lobby')throw new GameError('This Reversi room is full or already started.');
    const guest=createPlayer(name,false);
    room.players.push(guest);room.phase='playing';room.turnIndex=room.blackIndex;
    room.updatedAt=Date.now();
    return {room,player:guest};
  }
  authorize(code,token){
    const room=this.requireRoom(code);
    const player=room.players.find(p=>p.token===token);
    if(!player)throw new GameError('You do not belong to this Reversi room.');
    return {room,player};
  }
  play(code,token,index){
    const {room,player}=this.authorize(code,token);
    if(room.phase!=='playing')throw new GameError('This round is not active.');
    if(room.players.length!==2||room.players.some(p=>!p.socketId))throw new GameError('Wait for both players to reconnect.');
    if(room.players[room.turnIndex].id!==player.id)throw new GameError('Wait for your turn.');
    const disc=playerDisc(room,room.turnIndex);
    const move=playDisc(room.board,index,disc);
    room.board=move.board;
    room.moveCount++;
    room.lastMove={index,by:player.id,disc,flipped:move.flipped};
    const nextIndex=1-room.turnIndex;
    const nextDisc=playerDisc(room,nextIndex);
    if(legalMoves(room.board,nextDisc).length){
      room.turnIndex=nextIndex;room.passedPlayerId=null;
    } else if(legalMoves(room.board,disc).length){
      // Reversi has no optional pass; a player with no legal move must pass.
      room.passedPlayerId=room.players[nextIndex].id;
    } else {
      // Both players have no legal moves (including a fully occupied board).
      const scores=discCounts(room.board);
      room.phase='finished';room.passedPlayerId=null;
      room.draw=scores.black===scores.white;
      room.winnerId=room.draw?null:room.players[scores.black>scores.white?room.blackIndex:1-room.blackIndex].id;
    }
    room.updatedAt=Date.now();
    return room;
  }
  requestRematch(code,token){
    const {room,player}=this.authorize(code,token);
    if(room.phase!=='finished')throw new GameError('Finish the round before requesting a rematch.');
    if(room.players.some(p=>!p.socketId))throw new GameError('Wait for both players to reconnect.');
    if(player.rematchReady)throw new GameError('You already requested a rematch.');
    player.rematchReady=true;
    if(room.players.length===2&&room.players.every(p=>p.rematchReady)){
      room.round++;
      room.board=startingBoard();
      room.blackIndex=(room.round-1)%2;
      room.turnIndex=room.blackIndex;
      room.phase='playing';room.winnerId=null;room.draw=false;
      room.moveCount=0;room.lastMove=null;room.passedPlayerId=null;
      for(const p of room.players)p.rematchReady=false;
    }
    room.updatedAt=Date.now();
    return room;
  }
  cleanup(){
    for(const [code,room] of this.rooms)if(Date.now()-room.updatedAt>ROOM_TTL_MS)this.rooms.delete(code);
  }
}
