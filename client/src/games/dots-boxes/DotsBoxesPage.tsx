import {useCallback,useEffect,useRef,useState,type KeyboardEvent,type ReactNode} from 'react'
import {io,type Socket} from 'socket.io-client'
import {ArrowLeft,ArrowRight,Check,CheckCircle2,Copy,Flag,Gamepad2,History,RotateCcw,Share2,ShieldCheck,Users,Wifi,WifiOff,X} from 'lucide-react'
import {safeLocalStorage} from '../../playgrove/safeStorage'
import {SIZES,edgeCount,edgeInfo,boxCount,playLine,freshGame,restoreGame,rematchGame,resignGame,snapshotAt,type GameState} from './dots-engine.mjs'
import './dots-boxes.css'

type Props={onBack:()=>void;onActivityChange:(active:boolean)=>void}
type Player={id:string;name:string;number:number;online:boolean;isHost:boolean;rematchReady:boolean}
type Room=GameState&{code:string;you:string;roomPhase:'active'|'lobby';players:Player[]}
type Ack={ok:boolean;error?:string;code?:string;token?:string;room?:Room}
type Session={code:string;token:string}
const PREFIX='playgrove:dots:'
const LOCAL=PREFIX+'local:v1',SESSION=PREFIX+'session:v1',NAME=PREFIX+'name:v1',MODE=PREFIX+'mode:v1'
const codeClean=(x:string)=>x.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)
const codeFromUrl=()=>codeClean(new URLSearchParams(window.location.search).get('room')||'')
function readLocal():{state:GameState;names:[string,string]}|null {
  try{
    const raw=JSON.parse(safeLocalStorage.getItem(LOCAL)||'null')
    const state=restoreGame(raw?.state),names=raw?.names
    return state&&Array.isArray(names)&&names.length===2&&names.every((n:unknown)=>typeof n==='string'&&n.trim().length>0&&n.length<=20)?{state,names:[names[0],names[1]]}:null
  }catch{return null}
}
function readOnline():Session|null{
  try{
    const raw=JSON.parse(safeLocalStorage.getItem(SESSION)||'null')
    const invite=codeFromUrl()
    return raw&&typeof raw.code==='string'&&/^[A-Z0-9]{6}$/.test(raw.code)&&typeof raw.token==='string'&&raw.token.length>=32&&(!invite||invite===raw.code)?raw:null
  }catch{return null}
}
const initialMode=(): 'local'|'online'=> {
  if(codeFromUrl())return 'online'
  try{return sessionStorage.getItem(MODE)==='local'?'local':'online'}catch{return 'online'}
}
const playerName=(names:[string,string],p:number)=>names[p-1]
const labelFor=(p:number)=>p===1?'Blue':'Coral'
const clip=async(text:string)=>{
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return}
  const input=document.createElement('textarea');input.value=text;input.style.position='fixed';input.style.opacity='0'
  document.body.appendChild(input);input.select();const ok=document.execCommand('copy');input.remove()
  if(!ok)throw Error('Copy is unavailable.')
}

function DotsBoard({state,names,enabled,onLine}:{state:GameState;names:[string,string];enabled:boolean;onLine:(i:number)=>void}){
  const [review,setReview]=useState<number|null>(null)
  useEffect(()=>setReview(null),[state.round])
  const historical=review===null?state:snapshotAt(state,review)
  const size=state.size,side=64+size*60,offset=32,unit=60
  const last=historical.moves.at(-1)
  const preview=review!==null
  const available=enabled&&state.phase==='playing'&&!preview
  const edges=Array.from({length:edgeCount(size)},(_,i)=>i)
  const tip=state.phase==='finished'?state.resignedBy?'Round ended by resignation.':'Every box has been claimed.':
    'Draw one line between two neighbouring dots. Complete a box to play again.'
  const action=(index:number)=>{if(available&&state.edges[index]===0)onLine(index)}
  return <div className="db-layout">
    <div className="db-paper">
      <div className="db-board-status" role="status" aria-live="polite">
        {preview?<><History size={20}/><span>Reviewing {review===0?'starting board':'move '+review}. Live play is paused here.</span></>:
          state.phase==='finished'?<><CheckCircle2 size={20}/><span>{state.draw?'Draw!':playerName(names,state.winner!)+' wins!'} {state.resignedBy?'Resignation.':'Final score '+state.scores.join('–')+'.'}</span></>:
          <><span className={'db-turn-icon db-player-'+state.turn}/><span>{playerName(names,state.turn)}'s turn · {labelFor(state.turn)}
            {state.lastClaimed.length>0?' · Box claimed — play again!':''}</span></>}
      </div>
      <div className="db-board-head"><strong>{size}×{size} BOXES</strong><span>{historical.moves.length} / {edgeCount(size)} lines</span></div>
      <svg className="db-board" viewBox={'0 0 '+side+' '+side} role="group"
        aria-label={size+' by '+size+' Dots and Boxes game board'}>
        {Array.from({length:boxCount(size)},(_,i)=>i).map(i=>{
          const r=Math.floor(i/size),c=i%size,owner=historical.owners[i]
          return <g key={'b'+i}>
            <rect x={offset+c*unit+5} y={offset+r*unit+5} width={unit-10} height={unit-10} rx={7}
              fill={owner===1?'#C9E4E6':owner===2?'#F1C9BC':'#F5F0E5'}
              className={last?.claimed.includes(i)?'db-box-new':''}/>
            {owner!==0&&<text x={offset+c*unit+unit/2} y={offset+r*unit+unit/2+6}
              textAnchor="middle" fontSize="18" fontWeight="800" fill={owner===1?'#28596A':'#A64A38'}>{owner===1?'B':'C'}</text>}
          </g>
        })}
        {edges.map(index=>{
          const {orientation,row,col}=edgeInfo(size,index)
          const x=offset+col*unit,y=offset+row*unit, horizontal=orientation==='horizontal'
          const x2=horizontal?x+unit:x,y2=horizontal?y:y+unit,owner=historical.edges[index]
          const isLast=last?.index===index
          const name=(horizontal?'Horizontal':'Vertical')+' line row '+(row+1)+' column '+(col+1)+
            (owner?' drawn by '+labelFor(owner):' available')
          return <g key={index} className={'db-edge '+(owner?'db-edge-owned':'db-edge-empty')+(isLast?' db-edge-new':'')}
            role="button" tabIndex={available&&owner===0?0:-1} aria-label={name}
            aria-disabled={!available||owner!==0}
            onClick={()=>action(index)}
            onKeyDown={(e:KeyboardEvent<SVGGElement>)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action(index)}}}>
            <line x1={x} y1={y} x2={x2} y2={y2}
              stroke={owner===1?'#317D93':owner===2?'#CD7359':'#BCB7AA'}
              strokeWidth={owner?7:2} strokeLinecap="round"/>
            {isLast&&<line x1={x} y1={y} x2={x2} y2={y2} stroke="#E9E48A" strokeWidth={2} strokeLinecap="round"/>}
            <line className="db-edge-hit" x1={x} y1={y} x2={x2} y2={y2}
              stroke="transparent" strokeWidth={20}/>
          </g>
        })}
        {Array.from({length:(size+1)*(size+1)},(_,i)=>{
          const x=offset+(i%(size+1))*unit,y=offset+Math.floor(i/(size+1))*unit
          return <circle key={'d'+i} cx={x} cy={y} r={5.3} fill="#392525" pointerEvents="none"/>
        })}
      </svg>
      <p className="db-tip">{preview?'You are viewing a previous position. Select Live board to continue.':tip}</p>
    </div>
    <aside className="db-side">
      <div className="db-panel db-score" aria-label="Player scores">
        <span className="db-eyebrow">SCOREBOARD</span><h2>Claim the boxes</h2>
        {([1,2] as const).map(p=><div key={p} className={'db-score-row '+(state.turn===p&&state.phase==='playing'?'db-is-turn':'')}>
          <span className={'db-player-dot db-player-'+p}/><strong>{playerName(names,p)}</strong>
          <span className="db-colour-label">{labelFor(p)}</span><b>{state.scores[p-1]}</b>
        </div>)}
        <div className="db-score-progress"><span style={{flex:state.scores[0]||0.0001}}/><span style={{flex:state.scores[1]||0.0001}}/></div>
        <p>{state.scores[0]+state.scores[1]} of {boxCount(size)} boxes captured</p>
      </div>
      <div className="db-panel db-history">
        <div className="db-history-heading"><History size={18}/><h2>Move history</h2></div>
        <div className="db-history-items" role="group" aria-label="Review Dots and Boxes moves">
          <button type="button" aria-pressed={review===0} onClick={()=>setReview(0)}>Starting board</button>
          {state.moves.map((m,i)=><button type="button" key={i} aria-pressed={review===i+1} onClick={()=>setReview(i+1)}>
            {i+1}. {playerName(names,m.player)} · {labelFor(m.player)} · {m.claimed.length?m.claimed.length+' box'+(m.claimed.length>1?'es':''):'Line'}
          </button>)}
        </div>
        <button type="button" className="db-live" disabled={!preview} onClick={()=>setReview(null)}>Live board <ArrowRight size={16}/></button>
      </div>
    </aside>
  </div>
}
function Setup({mode,onMode,children}:{mode:'online'|'local';onMode:(mode:'online'|'local')=>void;children:ReactNode}){
  return <main className="db-entry">
    <section className="db-intro">
      <span className="db-eyebrow">GAME #10 · STRATEGY FOR TWO</span>
      <h1>One more line.<br/><em>One more box.</em></h1>
      <p>Take turns connecting neighbouring dots. Close the fourth side of a box to claim it and earn another turn. Capture more boxes to win.</p>
      <div className="db-tags"><span><Users size={15}/> Two players</span><span><ShieldCheck size={15}/> No database</span></div>
      <div className="db-mode-picker" role="group" aria-label="Choose play mode">
        <button type="button" aria-pressed={mode==='online'} className={mode==='online'?'selected':''} onClick={()=>onMode('online')}><Wifi size={18}/> Online</button>
        <button type="button" aria-pressed={mode==='local'} className={mode==='local'?'selected':''} onClick={()=>onMode('local')}><Users size={18}/> Same device</button>
      </div>
      <div className="db-rules"><strong>The chain reaction</strong><p>A completed square grants another move. Plan carefully: one open line can hand your opponent an entire chain of boxes. The last free line always completes the final box.</p></div>
    </section>
    <section className="db-panel db-start">{children}</section>
  </main>
}
function LocalMode({onMode}:{onMode:(m:'online'|'local')=>void}){
  const [saved,setSaved]=useState(readLocal)
  const [started,setStarted]=useState(false)
  const [names,setNames]=useState<[string,string]>(saved?.names||['Player 1','Player 2'])
  const [size,setSize]=useState<3|5|7>((saved?.state.size as 3|5|7)||5)
  const [state,setState]=useState<GameState>(saved?.state||freshGame())
  const [notice,setNotice]=useState('')
  useEffect(()=>{if(started)safeLocalStorage.setItem(LOCAL,JSON.stringify({names,state}))},[started,names,state])
  const play=(edge:number)=>{try{setState(s=>playLine(s,edge));setNotice('')}catch(e){setNotice(e instanceof Error?e.message:'Invalid line.')}}
  const start=(resume:boolean)=>{
    if(resume&&saved){setState(saved.state);setNames(saved.names);setSize(saved.state.size)}
    else {setState(freshGame(size));setNames(names.map((n,i)=>n.trim().slice(0,20)||'Player '+(i+1)) as [string,string])}
    setStarted(true);setNotice('')
  }
  const resign=()=>{
    if(!window.confirm('Resign this round? Your opponent will be the winner.'))return
    setState(s=>resignGame(s))
  }
  return !started?<Setup mode="local" onMode={onMode}>
    <span className="db-eyebrow">LOCAL TWO-PLAYER</span><h2>Share one screen</h2>
    <p>No internet or room required after loading. Pass the phone to take turns.</p>
    {names.map((name,i)=><label key={i} className="db-label" htmlFor={'db-name-'+i}>Player {i+1}
      <input id={'db-name-'+i} maxLength={20} autoComplete="off" value={name} onChange={e=>setNames(v=>v.map((n,k)=>k===i?e.target.value:n) as [string,string])}/>
    </label>)}
    <SizePicker value={size} onChange={setSize}/>
    <button className="db-primary" type="button" onClick={()=>start(false)}>Start local game <ArrowRight size={16}/></button>
    {saved&&<button type="button" className="db-secondary" onClick={()=>start(true)}>Resume saved local game <RotateCcw size={17}/></button>}
  </Setup>:<main className="db-game">
    <div className="db-title"><div><span className="db-eyebrow">LOCAL TWO-PLAYER · ROUND {state.round}</span><h1>Dots & Boxes<span>.</span></h1></div>
      <button className="db-header-button" type="button" onClick={()=>{setSaved({state,names});setStarted(false)}}>Mode menu</button></div>
    <DotsBoard state={state} names={names} enabled onLine={play}/>
    {notice&&<div className="db-alert" role="alert">{notice}</div>}
    <div className="db-actions">
      {state.phase==='playing'?<><button type="button" onClick={resign}><Flag size={16}/> Resign round</button>
        <button type="button" onClick={()=>{
          if(window.confirm('Restart your local match? The current round will be erased.'))setState(freshGame(state.size,1))
        }}><RotateCcw size={16}/> Restart</button></>:
        <button type="button" className="db-primary" onClick={()=>setState(s=>rematchGame(s))}><RotateCcw size={16}/> Play rematch</button>}
    </div>
  </main>
}
function SizePicker({value,onChange}:{value:3|5|7;onChange:(n:3|5|7)=>void}){
  return <div className="db-size"><strong>Board size</strong><div role="group" aria-label="Board size">
    {SIZES.map(n=><button type="button" key={n} aria-pressed={n===value} className={n===value?'active':''}
      onClick={()=>onChange(n)}>{n}×{n}<span>{n===3?'Quick':n===5?'Classic':'Strategic'}</span></button>)}
  </div></div>
}
function OnlineMode({onActivityChange,onMode}:{onActivityChange:(active:boolean)=>void;onMode:(m:'online'|'local')=>void}){
  const [connected,setConnected]=useState(false)
  const [room,setRoom]=useState<Room|null>(null)
  const [name,setName]=useState(()=>safeLocalStorage.getItem(NAME)||'')
  const [tab,setTab]=useState<'create'|'join'>(()=>codeFromUrl()?'join':'create')
  const [joinCode,setJoinCode]=useState(codeFromUrl)
  const [size,setSize]=useState<3|5|7>(5)
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const [copied,setCopied]=useState(false)
  const sock=useRef<Socket|null>(null),session=useRef<Session|null>(readOnline())
  useEffect(()=>{
    const socket=io({reconnection:true,reconnectionDelay:500,timeout:10000})
    sock.current=socket
    socket.on('connect',()=>{
      const previous=session.current
      if(!previous){setConnected(true);return}
      socket.timeout(8000).emit('dots:resume',previous,(err:Error|null,ack:Ack)=>{
        if(!socket.connected)return
        setConnected(true)
        if(err){setError('Could not restore the saved room. Refresh to retry.');setRoom(null)}
        else if(ack?.ok&&ack.room){setRoom(ack.room);setError('')}
        else{safeLocalStorage.removeItem(SESSION);session.current=null;setRoom(null);setError(ack?.error||'Room no longer available. Create a new one.')}
      })
    })
    socket.on('disconnect',()=>setConnected(false))
    socket.on('connect_error',()=>setError('Cannot connect to Playgrove. Check your network.'))
    socket.on('dots:update',(next:Room)=>{setRoom(next);setError('')})
    return ()=>{socket.disconnect();sock.current=null}
  },[])
  useEffect(()=>{
    onActivityChange(Boolean(room&&(room.roomPhase==='lobby'||room.phase==='playing')))
    return ()=>onActivityChange(false)
  },[onActivityChange,room?.roomPhase,room?.phase])
  const request=useCallback((event:string,payload:unknown):Promise<Ack>=>{
    const socket=sock.current
    if(!socket?.connected)return Promise.reject(Error('No server connection.'))
    return new Promise((resolve,reject)=>socket.timeout(9000).emit(event,payload,(err:Error|null,ack:Ack)=>{
      if(err)return reject(Error('Connection timed out. Try again.'))
      if(!ack?.ok)return reject(Error(ack?.error||'Unable to finish action.'))
      resolve(ack)
    }))
  },[])
  const act=async(event:string,payload:unknown,onSuccess?:(x:Ack)=>void)=>{
    if(busy)return
    setBusy(true);setError('')
    try{const ack=await request(event,payload);onSuccess?.(ack)}
    catch(e){setError(e instanceof Error?e.message:'Something went wrong.')}
    finally{setBusy(false)}
  }
  const createJoin=()=>{
    const nickname=name.trim()
    if(nickname.length<2||nickname.length>20){setError('Nickname must contain 2–20 characters.');return}
    if(tab==='join'&&joinCode.length!==6){setError('Enter the six-character invite code.');return}
    void act(tab==='create'?'dots:create':'dots:join',
      tab==='create'?{name:nickname,size}:{name:nickname,code:joinCode},ack=>{
        if(!ack.code||!ack.token||!ack.room)return
        const next={code:ack.code,token:ack.token}
        safeLocalStorage.setItem(SESSION,JSON.stringify(next));safeLocalStorage.setItem(NAME,nickname)
        session.current=next;setRoom(ack.room)
        window.history.replaceState(null,'','/games/dots-boxes')
      })
  }
  const leave=async()=>{
    if(room?.roomPhase==='active'&&room.phase==='playing'&&!window.confirm('Leave this Dots & Boxes room? Your friend must wait if you disconnect.'))return
    try{await request('dots:leave',{})}catch{/* Preserve ability to leave locally. */}
    safeLocalStorage.removeItem(SESSION);session.current=null;setRoom(null);setError('');setCopied(false)
  }
  const copy=async()=>{
    if(!room)return
    try{await clip(window.location.origin+'/games/dots-boxes?room='+encodeURIComponent(room.code));setCopied(true)}
    catch{setError('Copy failed. Share the six-character code manually.')}
  }
  const share=async()=>{
    if(!room)return
    const url=window.location.origin+'/games/dots-boxes?room='+encodeURIComponent(room.code)
    if(navigator.share){try{await navigator.share({title:'Dots & Boxes · Playgrove',url,text:'Join my game: '+room.code})}catch{}}
    else await copy()
  }
  const names:[string,string]=[room?.players[0]?.name||'Player 1',room?.players[1]?.name||'Player 2']
  const bothOnline=Boolean(room?.players.length===2&&room.players.every(p=>p.online))
  const me=room?.players.find(p=>p.id===room.you)
  const myNumber=me?.number
  const canPlay=Boolean(room?.phase==='playing'&&room.roomPhase==='active'&&connected&&bothOnline&&room.turn===myNumber&&!busy)
  return !room?<Setup mode="online" onMode={onMode}>
    <div className="db-tabs" role="group" aria-label="Online room action">
      <button type="button" className={tab==='create'?'active':''} aria-pressed={tab==='create'} onClick={()=>setTab('create')}>Create room</button>
      <button type="button" className={tab==='join'?'active':''} aria-pressed={tab==='join'} onClick={()=>setTab('join')}>Join room</button>
    </div>
    <span className="db-eyebrow">ONLINE TWO-PLAYER</span><h2>{tab==='create'?'Start a game':'Join your friend'}</h2>
    <label className="db-label" htmlFor="db-online-name">YOUR NICKNAME
      <input id="db-online-name" maxLength={20} value={name} onChange={e=>setName(e.target.value)}
        onKeyDown={e=>{if(e.key==='Enter')createJoin()}} placeholder="e.g. Alex"/></label>
    {tab==='create'?<SizePicker value={size} onChange={setSize}/>:<label className="db-label" htmlFor="db-code">6-CHARACTER ROOM CODE
      <input id="db-code" maxLength={6} autoCapitalize="characters" value={joinCode} placeholder="ABC123"
        onKeyDown={e=>{if(e.key==='Enter')createJoin()}} onChange={e=>setJoinCode(codeClean(e.target.value))}/></label>}
    <button type="button" className="db-primary" disabled={busy||!connected} onClick={createJoin}>{busy?'Connecting…':tab==='create'?'Create Dots & Boxes room':'Join Dots & Boxes room'} <ArrowRight size={16}/></button>
    <p className="db-setup-info">Private rooms use the existing free Playgrove server. If it sleeps or restarts, start a new room.</p>
    {error&&<div className="db-alert" role="alert">{error}</div>}
  </Setup>:<main className="db-game">
    <div className="db-title"><div><span className="db-eyebrow">ROOM {room.code} · ROUND {room.round}</span>
      <h1>{room.roomPhase==='lobby'?'Invite your friend.':'Dots & Boxes'}<span>.</span></h1></div>
      <button className="db-header-button" onClick={()=>void leave()} type="button"><X size={16}/> Exit room</button></div>
    {room.roomPhase==='lobby'?<section className="db-panel db-waiting">
      <Users size={38}/><h2>Waiting for player two</h2>
      <p>Share your invite link or give your friend this private code. Your {room.size}×{room.size} board starts once they join.</p>
      <div className="db-invite" aria-label={'Room code '+room.code}>{room.code.split('').map((c,i)=><span key={i}>{c}</span>)}</div>
      <div className="db-actions"><button type="button" className="db-primary" onClick={()=>void copy()}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?'Copied':'Copy invite link'}</button>
        <button type="button" onClick={()=>void share()}><Share2 size={16}/> Share</button></div>
    </section>:<>
      <div className={'db-connection '+(!connected||!bothOnline?'db-disconnected':'')} role="status">
        {!connected||!bothOnline?<><WifiOff size={17}/> Waiting for both players to reconnect</>:
          room.phase==='finished'?<><CheckCircle2 size={17}/> Round complete</>:
          canPlay?<><CheckCircle2 size={17}/> Your turn — draw a line!</>:
          <><Wifi size={17}/> {names[room.turn-1]} is playing</>}
      </div>
      <DotsBoard state={room} names={names} enabled={canPlay} onLine={index=>void act('dots:line',{index})}/>
      {room.phase==='finished'?<div className="db-actions">
        <button type="button" className="db-primary" disabled={busy||!bothOnline||!connected||Boolean(me?.rematchReady)}
          onClick={()=>void act('dots:rematch',{})}><RotateCcw size={16}/>
          {me?.rematchReady?'Waiting for opponent…':'Request rematch'}</button>
        {room.players.find(p=>p.id!==room.you)?.rematchReady&&<span>Your friend is ready!</span>}
      </div>:<div className="db-actions"><button type="button" disabled={busy||!connected} onClick={()=>{
        if(window.confirm('Resign this round? Your opponent will win.'))void act('dots:resign',{})
      }}><Flag size={16}/> Resign round</button></div>}
    </>}
    {error&&<div className="db-alert" role="alert">{error}<button type="button" aria-label="Dismiss error" onClick={()=>setError('')}><X size={15}/></button></div>}
  </main>
}
export default function DotsBoxesPage({onBack,onActivityChange}:Props){
  const [mode,setMode]=useState<'local'|'online'>(initialMode)
  const switchMode=(next:'online'|'local')=>{
    setMode(next)
    try{sessionStorage.setItem(MODE,next)}catch{/* Still works without session storage. */}
  }
  useEffect(()=>{if(mode==='local')onActivityChange(false)},[mode,onActivityChange])
  return <div className="db-shell"><div className="db-frame">
    <header className="db-top"><button className="db-header-button" type="button" onClick={onBack}><ArrowLeft size={17}/> All games</button>
      <span className="db-brand"><Gamepad2 size={20}/> playgrove<span>.</span></span>
      <span className="db-game-label">DOTS & BOXES</span></header>
    {mode==='online'?<OnlineMode onMode={switchMode} onActivityChange={onActivityChange}/>:
      <LocalMode onMode={switchMode}/>}
    <footer className="db-footer">playgrove<span>.</span> · Ten games, one happy corner.</footer>
  </div></div>
}
