/** Pure Hashi/Bridges engine. No server, third-party dependency, or RNG. */
export const MAX_HINTS = 3;
const HISTORY_LIMIT = 80;
const validInt = (n,lo,hi) => Number.isInteger(n) && n>=lo && n<=hi;
export function buildEdges(islands) {
  const edges=[];
  for(let a=0;a<islands.length;a++)for(let b=a+1;b<islands.length;b++){
    const p=islands[a],q=islands[b];
    if(p.x!==q.x&&p.y!==q.y)continue;
    if(islands.some((r,k)=>k!==a&&k!==b&&
      (p.x===q.x&&r.x===p.x&&r.y>Math.min(p.y,q.y)&&r.y<Math.max(p.y,q.y)||
       p.y===q.y&&r.y===p.y&&r.x>Math.min(p.x,q.x)&&r.x<Math.max(p.x,q.x))))continue;
    edges.push({a,b,horizontal:p.y===q.y});
  }
  return edges;
}
export function edgesCross(puzzle,i,j){
  const e=puzzle.edges[i],f=puzzle.edges[j];
  if(e.horizontal===f.horizontal)return false;
  const h=e.horizontal?e:f,v=e.horizontal?f:e;
  const h1=puzzle.islands[h.a],h2=puzzle.islands[h.b],v1=puzzle.islands[v.a],v2=puzzle.islands[v.b];
  return v1.x>Math.min(h1.x,h2.x)&&v1.x<Math.max(h1.x,h2.x)&&
    h1.y>Math.min(v1.y,v2.y)&&h1.y<Math.max(v1.y,v2.y);
}
export function bridgeTotals(puzzle,bridges) {
  const totals=Array(puzzle.islands.length).fill(0);
  puzzle.edges.forEach(({a,b},i)=>{totals[a]+=bridges[i];totals[b]+=bridges[i];});
  return totals;
}
function connected(puzzle,bridges,potential=false) {
  if(puzzle.islands.length===0)return false;
  const seen=new Set([0]),queue=[0];
  while(queue.length){
    const a=queue.pop();
    puzzle.edges.forEach((e,i)=>{
      if(!bridges[i]&&!potential)return;
      if(potential && bridges[i]===-1)return;
      if(e.a!==a&&e.b!==a)return;
      const b=e.a===a?e.b:e.a;
      if(!seen.has(b)){seen.add(b);queue.push(b);}
    });
  }
  return seen.size===puzzle.islands.length;
}
export function isSolved(puzzle,bridges){
  if(!Array.isArray(bridges)||bridges.length!==puzzle.edges.length||
    bridges.some(n=>!validInt(n,0,2)))return false;
  if(puzzle.edges.some((e,i)=>bridges[i]&&puzzle.edges.some((_,j)=>j!==i&&bridges[j]&&edgesCross(puzzle,i,j))))return false;
  const totals=bridgeTotals(puzzle,bridges);
  return totals.every((n,i)=>n===puzzle.islands[i].n)&&connected(puzzle,bridges);
}
export function inspectBoard(puzzle,bridges) {
  const totals=bridgeTotals(puzzle,bridges);
  const matched=totals.filter((n,i)=>n===puzzle.islands[i].n).length;
  const overfull=totals.map((n,i)=>n>puzzle.islands[i].n?i:-1).filter(i=>i>=0);
  // A component with all its islands satisfied cannot be connected to anything else.
  const seen=new Set(),isolated=[];
  for(let i=0;i<puzzle.islands.length;i++){
    if(seen.has(i))continue;
    const group=[i],queue=[i];seen.add(i);
    while(queue.length){
      const a=queue.pop();
      puzzle.edges.forEach(({a:u,b:v},e)=>{
        if(bridges[e]===0)return;
        const b=u===a?v:v===a?u:-1;
        if(b>=0&&!seen.has(b)){seen.add(b);queue.push(b);group.push(b);}
      });
    }
    if(group.length<puzzle.islands.length&&group.every(k=>totals[k]===puzzle.islands[k].n))isolated.push(group);
  }
  return {totals,matched,overfull,isolated};
}
export function freshSession(puzzle) {
  return {id:puzzle.id,bridges:Array(puzzle.edges.length).fill(0),marks:Array(puzzle.edges.length).fill(false),
    seconds:0,hints:0,completed:false,history:[],future:[]};
}
function validState(s,p){
  return s&&Array.isArray(s.bridges)&&s.bridges.length===p.edges.length&&s.bridges.every(n=>validInt(n,0,2))&&
    Array.isArray(s.marks)&&s.marks.length===p.edges.length&&s.marks.every(n=>typeof n==='boolean')&&
    s.marks.every((mark,i)=>!mark||s.bridges[i]===0)&&
    !p.edges.some((_,i)=>s.bridges[i]&&p.edges.some((_,j)=>j<i&&s.bridges[j]&&edgesCross(p,i,j)));
}
function record(s) {return {bridges:[...s.bridges],marks:[...s.marks],hints:s.hints};}
export function restoreSession(raw,p) {
  const base=freshSession(p);
  if(!raw||raw.id!==p.id||!validState(raw,p))return base;
  const safeHist=a=>Array.isArray(a)?a.slice(-HISTORY_LIMIT).filter(x=>validState(x,p)&&validInt(x.hints,0,MAX_HINTS)).map(record):[];
  const bridges=[...raw.bridges],marks=[...raw.marks];
  return {...base,bridges,marks,seconds:validInt(raw.seconds,0,315360000)?raw.seconds:0,
    hints:validInt(raw.hints,0,MAX_HINTS)?raw.hints:0,completed:isSolved(p,bridges),
    history:safeHist(raw.history),future:safeHist(raw.future)};
}
function edit(s,p,bridges,marks,hints=s.hints) {
  return {...s,bridges,marks,hints,completed:isSolved(p,bridges),
    history:[...s.history.slice(-(HISTORY_LIMIT-1)),record(s)],future:[]};
}
export function canSetBridge(p,bridges,i,n) {
  return validInt(i,0,p.edges.length-1)&&validInt(n,0,2)&&
    (n===0||!p.edges.some((_,j)=>j!==i&&bridges[j]>0&&edgesCross(p,i,j)));
}
export function setBridge(s,p,i,n) {
  if(s.completed||!canSetBridge(p,s.bridges,i,n)||s.bridges[i]===n)return s;
  const bridges=[...s.bridges],marks=[...s.marks];bridges[i]=n;if(n)marks[i]=false;
  return edit(s,p,bridges,marks);
}
export function cycleBridge(s,p,i,reverse=false){
  if(!validInt(i,0,p.edges.length-1))return s;
  return setBridge(s,p,i,(s.bridges[i]+(reverse?2:1))%3);
}
export function toggleNoBridge(s,p,i){
  if(s.completed||!validInt(i,0,p.edges.length-1)||s.bridges[i]!==0)return s;
  const marks=[...s.marks];marks[i]=!marks[i];return edit(s,p,[...s.bridges],marks);
}
export function undo(s,p){
  if(!s.history.length)return s;
  const last=s.history.at(-1);
  return {...s,...record(last),completed:isSolved(p,last.bridges),
    history:s.history.slice(0,-1),future:[...s.future.slice(-(HISTORY_LIMIT-1)),record(s)]};
}
export function redo(s,p){
  if(!s.future.length)return s;
  const next=s.future.at(-1);
  return {...s,...record(next),completed:isSolved(p,next.bridges),
    history:[...s.history.slice(-(HISTORY_LIMIT-1)),record(s)],future:s.future.slice(0,-1)};
}
export function giveHint(s,p) {
  if(s.completed||s.hints>=MAX_HINTS)return {session:s,detail:''};
  // First clear wrong extra links; otherwise reveal one step in the unique solution.
  let i=s.bridges.findIndex((n,k)=>n>p.solution[k]);
  if(i<0)i=s.bridges.findIndex((n,k)=>n<p.solution[k]&&canSetBridge(p,s.bridges,k,p.solution[k]));
  if(i<0)return {session:s,detail:'No available hint. Check the existing bridges.'};
  const target=p.solution[i],edge=p.edges[i],bridges=[...s.bridges],marks=[...s.marks];
  bridges[i]=target;marks[i]=false;
  const next=edit(s,p,bridges,marks,s.hints+1);
  return {session:next,detail:'Hint: '+(target===0?'remove the bridge':target===1?'use one bridge':'use two bridges')+
    ' between islands '+(edge.a+1)+' and '+(edge.b+1)+'.'};
}
/** Exact solution counting by interval propagation + crossing and connectivity constraints.
 * Stops at limit; used by CI to independently verify the curated library. */
export function solvePuzzle(p,limit=2) {
  const n=p.islands.length,m=p.edges.length,adj=Array.from({length:n},()=>[]),conf=Array.from({length:m},()=>[]);
  p.edges.forEach(({a,b},i)=>{adj[a].push(i);adj[b].push(i);});
  for(let i=0;i<m;i++)for(let j=0;j<i;j++)if(edgesCross(p,i,j)){conf[i].push(j);conf[j].push(i);}
  const solutions=[];
  function search(lo,hi) {
    if(solutions.length>=limit)return;
    lo=[...lo];hi=[...hi];
    let changed=true;
    while(changed) {
      changed=false;
      for(let v=0;v<n;v++){
        const es=adj[v],floor=es.reduce((a,e)=>a+lo[e],0),ceil=es.reduce((a,e)=>a+hi[e],0),target=p.islands[v].n;
        if(target<floor||target>ceil)return;
        for(const e of es){
          const a=Math.max(lo[e],target-(ceil-hi[e])),b=Math.min(hi[e],target-(floor-lo[e]));
          if(a>b)return;
          if(a!==lo[e]||b!==hi[e]){lo[e]=a;hi[e]=b;changed=true;}
        }
      }
      for(let e=0;e<m;e++)if(lo[e]>0)for(const j of conf[e]){
        if(lo[j]>0)return;
        if(hi[j]>0){hi[j]=0;changed=true;}
      }
    }
    // Optimistically joining every not-yet-forbidden edge must connect all islands.
    const seen=new Set([0]),queue=[0];
    while(queue.length){
      const a=queue.pop();
      for(const e of adj[a]){
        if(hi[e]===0)continue;
        const b=p.edges[e].a===a?p.edges[e].b:p.edges[e].a;
        if(!seen.has(b)){seen.add(b);queue.push(b);}
      }
    }
    if(seen.size!==n)return;
    const open=[];
    for(let e=0;e<m;e++)if(lo[e]!==hi[e])open.push(e);
    if(!open.length){if(isSolved(p,lo))solutions.push(lo);return;}
    const edge=open.sort((a,b)=>{
      const score=e=>adj[p.edges[e].a].filter(j=>lo[j]!==hi[j]).length+
          adj[p.edges[e].b].filter(j=>lo[j]!==hi[j]).length;
      return score(a)-score(b)||conf[b].length-conf[a].length||a-b;
    })[0];
    for(let val=hi[edge];val>=lo[edge];val--){
      const l=[...lo],h=[...hi];l[edge]=val;h[edge]=val;search(l,h);
      if(solutions.length>=limit)return;
    }
  }
  search(Array(m).fill(0),Array(m).fill(2));
  return solutions;
}
export function validatePuzzle(p) {
  if(!p||!/^[EMH]\d{2}$/.test(p.id)||typeof p.title!=='string'||p.title.length<3||
    !validInt(p.size,5,15)||!Array.isArray(p.islands)||p.islands.length<6||
    !Array.isArray(p.edges)||!Array.isArray(p.solution)||p.solution.length!==p.edges.length||
    p.islands.some(i=>!validInt(i.x,0,p.size-1)||!validInt(i.y,0,p.size-1)||!validInt(i.n,1,8))||
    new Set(p.islands.map(i=>i.x+','+i.y)).size!==p.islands.length||
    JSON.stringify(p.edges)!==JSON.stringify(buildEdges(p.islands)))return false;
  return isSolved(p,p.solution);
}
