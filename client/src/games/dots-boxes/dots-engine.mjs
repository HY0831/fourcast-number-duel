/** Dots & Boxes — shared deterministic, browser-safe rules. 1=Blue, 2=Coral. */
export const SIZES=[3,5,7];
export const validSize=n=>SIZES.includes(n);
export const edgeCount=n=>2*n*(n+1);
export const boxCount=n=>n*n;
export const other=p=>p===1?2:1;
function insist(ok,message){if(!ok)throw new Error(message);}
export function boxEdges(size,row,col) {
  insist(validSize(size)&&Number.isInteger(row)&&row>=0&&row<size&&Number.isInteger(col)&&col>=0&&col<size,'Invalid box.');
  const h=(r,c)=>r*size+c,v=(r,c)=>(size+1)*size+r*(size+1)+c;
  return [h(row,col),h(row+1,col),v(row,col),v(row,col+1)];
}
export function edgeInfo(size,index) {
  insist(validSize(size)&&Number.isInteger(index)&&index>=0&&index<edgeCount(size),'Invalid line.');
  const horizontal=(size+1)*size;
  return index<horizontal?{orientation:'horizontal',row:Math.floor(index/size),col:index%size}:
    {orientation:'vertical',row:Math.floor((index-horizontal)/(size+1)),col:(index-horizontal)%(size+1)};
}
export function freshGame(size=5,round=1,startingPlayer=1){
  insist(validSize(size),'Choose a 3×3, 5×5 or 7×7 board.');
  insist(Number.isInteger(round)&&round>0,'Invalid round.');
  insist(startingPlayer===1||startingPlayer===2,'Invalid player.');
  return {size,round,startingPlayer,phase:'playing',turn:startingPlayer,
    edges:Array(edgeCount(size)).fill(0),owners:Array(boxCount(size)).fill(0),
    scores:[0,0],moves:[],winner:null,draw:false,resignedBy:null,lastClaimed:[]};
}
export function playLine(state,index){
  insist(state?.phase==='playing','Round is already finished.');
  const {size,edges,owners,turn}=state;
  insist(validSize(size)&&Array.isArray(edges)&&edges.length===edgeCount(size)&&Array.isArray(owners)&&owners.length===boxCount(size),'Invalid board.');
  edgeInfo(size,index);
  insist(edges[index]===0,'This line has already been drawn.');
  const nextEdges=[...edges];nextEdges[index]=turn;
  const nextOwners=[...owners],claimed=[];
  for(let r=0;r<size;r++)for(let c=0;c<size;c++){
    const b=r*size+c;
    if(nextOwners[b]===0&&boxEdges(size,r,c).every(e=>nextEdges[e]!==0)){
      nextOwners[b]=turn;claimed.push(b);
    }
  }
  const scores=[nextOwners.filter(p=>p===1).length,nextOwners.filter(p=>p===2).length];
  const finished=scores[0]+scores[1]===boxCount(size);
  const winner=finished?(scores[0]===scores[1]?null:scores[0]>scores[1]?1:2):null;
  const move={index,player:turn,claimed};
  return {...state,edges:nextEdges,owners:nextOwners,scores,moves:[...state.moves,move],
    lastClaimed:claimed,turn:finished?turn:claimed.length?turn:other(turn),
    phase:finished?'finished':'playing',winner,draw:finished&&winner===null,resignedBy:null};
}
export function resignGame(state){
  insist(state?.phase==='playing','Only an active round can be resigned.');
  return {...state,phase:'finished',winner:other(state.turn),draw:false,resignedBy:state.turn,lastClaimed:[]};
}
export function rematchGame(state,size=state.size){
  insist(state?.phase==='finished','Finish the round first.');
  return freshGame(size,state.round+1,other(state.startingPlayer));
}
export function replayGame(size,moves,round=1,startingPlayer=1){
  insist(Array.isArray(moves)&&moves.length<=edgeCount(size),'Invalid history.');
  let state=freshGame(size,round,startingPlayer);
  for(const move of moves){
    insist(move&&move.player===state.turn,'Invalid move history.');
    const next=playLine(state,move.index);
    insist(JSON.stringify(next.moves.at(-1))===JSON.stringify(move),'Inconsistent move history.');
    state=next;
  }
  return state;
}
export function snapshotAt(state,count){
  insist(Number.isInteger(count)&&count>=0&&count<=state.moves.length,'Invalid replay position.');
  return replayGame(state.size,state.moves.slice(0,count),state.round,state.startingPlayer);
}
export function restoreGame(raw){
  try{
    insist(raw&&validSize(raw.size)&&Number.isInteger(raw.round)&&raw.round>0&&raw.round<1000000&&
      (raw.startingPlayer===1||raw.startingPlayer===2),'Invalid local save.');
    let replay=replayGame(raw.size,raw.moves,raw.round,raw.startingPlayer);
    if(raw.resignedBy!==null&&raw.resignedBy!==undefined){
      insist(raw.resignedBy===replay.turn,'Invalid resignation.');
      replay=resignGame(replay);
    }
    for(const key of ['edges','owners','scores','phase','turn','winner','draw','resignedBy']){
      insist(JSON.stringify(replay[key])===JSON.stringify(raw[key]),'Invalid stored board state.');
    }
    return replay;
  }catch{return null;}
}
