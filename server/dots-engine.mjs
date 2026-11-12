import {randomBytes,randomUUID} from 'node:crypto';
import {GameError,normalizeName,normalizeRoomCode,ROOM_TTL_MS} from './game-engine.mjs';
import {freshGame,playLine,resignGame,rematchGame,validSize} from '../client/src/games/dots-boxes/dots-engine.mjs';

const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode=rooms=>{let code;do{code=Array.from(randomBytes(6),n=>ALPHABET[n%ALPHABET.length]).join('');}while(rooms.has(code));return code;};
const player=(name,isHost)=>({id:randomUUID(),token:randomBytes(32).toString('hex'),
  name:normalizeName(name),socketId:null,rematchReady:false,isHost});
export function publicDotsRoom(room,viewerId){
  if(!room.players.some(p=>p.id===viewerId))throw new GameError('You do not belong to this Dots & Boxes room.');
  const s=room.game;
  return {code:room.code,you:viewerId,roomPhase:room.players.length===2?'active':'lobby',
    phase:s.phase,size:s.size,round:s.round,startingPlayer:s.startingPlayer,turn:s.turn,
    edges:[...s.edges],owners:[...s.owners],scores:[...s.scores],moves:s.moves.map(m=>({...m,claimed:[...m.claimed]})),
    lastClaimed:[...s.lastClaimed],winner:s.winner,draw:s.draw,resignedBy:s.resignedBy,
    players:room.players.map((p,i)=>({id:p.id,name:p.name,number:i+1,isHost:p.isHost,
      online:Boolean(p.socketId),rematchReady:p.rematchReady}))};
}
export class DotsStore {
  constructor(){this.rooms=new Map();}
  create(name,size=5){
    if(!validSize(size))throw new GameError('Choose a 3×3, 5×5 or 7×7 board.');
    if(this.rooms.size>=1000){this.cleanup();if(this.rooms.size>=1000)throw new GameError('Too many active Dots & Boxes rooms.');}
    const host=player(name,true),room={code:makeCode(this.rooms),players:[host],game:freshGame(size),updatedAt:Date.now()};
    this.rooms.set(room.code,room);return {room,player:host};
  }
  requireRoom(code){
    const room=this.rooms.get(normalizeRoomCode(code));
    if(!room)throw new GameError('Dots & Boxes room not found. Check your code.');
    if(Date.now()-room.updatedAt>ROOM_TTL_MS){this.rooms.delete(room.code);throw new GameError('This room expired. Create another room.');}
    return room;
  }
  join(code,name,token){
    const room=this.requireRoom(code);
    const returning=token&&room.players.find(p=>p.token===token);
    if(returning){room.updatedAt=Date.now();return {room,player:returning};}
    if(room.players.length!==1||room.game.moves.length)throw new GameError('This room is full or already started.');
    const guest=player(name,false);room.players.push(guest);room.updatedAt=Date.now();return {room,player:guest};
  }
  authorize(code,token){
    const room=this.requireRoom(code);
    const player=room.players.find(p=>p.token===token);
    if(!player)throw new GameError('You do not belong to this Dots & Boxes room.');
    return {room,player};
  }
  play(code,token,index){
    const {room,player}=this.authorize(code,token);
    if(room.players.length!==2||room.players.some(p=>!p.socketId))throw new GameError('Wait for both players to connect.');
    if(room.game.phase!=='playing')throw new GameError('The round is finished.');
    if(room.players[room.game.turn-1].id!==player.id)throw new GameError('Wait for your turn.');
    try{room.game=playLine(room.game,index);}catch(e){throw new GameError(e instanceof Error?e.message:'Invalid line.');}
    room.updatedAt=Date.now();return room;
  }
  resign(code,token){
    const {room,player}=this.authorize(code,token);
    if(room.players.length!==2)throw new GameError('Wait for another player to join.');
    if(room.game.phase!=='playing')throw new GameError('The round is finished.');
    // Resigning is not limited to the active player. The opponent wins regardless of turn.
    room.game={...room.game,phase:'finished',winner:room.players[0].id===player.id?2:1,
      draw:false,resignedBy:room.players[0].id===player.id?1:2,lastClaimed:[]};
    room.updatedAt=Date.now();return room;
  }
  rematch(code,token){
    const {room,player}=this.authorize(code,token);
    if(room.game.phase!=='finished')throw new GameError('Finish the round before requesting a rematch.');
    if(room.players.length!==2||room.players.some(p=>!p.socketId))throw new GameError('Both players must be online.');
    if(player.rematchReady)throw new GameError('Already requested a rematch.');
    player.rematchReady=true;
    if(room.players.every(p=>p.rematchReady)){
      room.game=rematchGame(room.game);
      room.players.forEach(p=>{p.rematchReady=false;});
    }
    room.updatedAt=Date.now();return room;
  }
  cleanup(){for(const [code,room] of this.rooms)if(Date.now()-room.updatedAt>ROOM_TTL_MS)this.rooms.delete(code);}
}
