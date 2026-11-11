import {useCallback,useEffect,useRef,useState} from 'react'
import {io,type Socket} from 'socket.io-client'
import {ArrowLeft,ArrowRight,Check,CircleDot,Copy,Flag,Gamepad2,History,RotateCcw,Share2,ShieldCheck,Sparkles,Trophy,Users,Wifi,WifiOff,X} from 'lucide-react'
import {safeLocalStorage} from '../../playgrove/safeStorage'
import LocalReversiPage from './LocalReversiPage'
import {startingBoard} from './reversi-rules.mjs'
import './reversi.css'

type Phase='lobby'|'playing'|'finished'
type Disc=0|1|2
type Player={id:string;name:string;isHost:boolean;online:boolean;rematchReady:boolean;disc:1|2}
type Room={
  code:string;phase:Phase;round:number;you:string;
  board:Disc[];scores:{black:number;white:number;empty:number};
  blackPlayerId:string|null;turnPlayerId:string|null;legalMoves:number[];
  winnerId:string|null;draw:boolean;moveCount:number;passedPlayerId:string|null;
  lastMove:{index:number;by:string;disc:1|2;flipped:number[]}|null;players:Player[];
  history:{index:number;by:string;disc:1|2;flipped:number[];board:Disc[]}[];resignedBy:string|null;
}
type Session={code:string;token:string}
type Ack={ok:boolean;error?:string;code?:string;token?:string;room?:Room}
type Props={onBack:()=>void;onActivityChange:(active:boolean)=>void}
const SESSION_KEY='reversi:session'
const NAME_KEY='reversi:name'
const cleanCode=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)
const codeFromUrl=()=>cleanCode(new URLSearchParams(window.location.search).get('room')||'')
const inviteUrl=(code:string)=>window.location.origin+'/games/reversi?room='+encodeURIComponent(code)
function savedSession():Session|null {
  try{
    const v=JSON.parse(safeLocalStorage.getItem(SESSION_KEY)||'null') as Session|null
    const invite=codeFromUrl()
    return v&&typeof v.code==='string'&&v.code.length===6&&typeof v.token==='string'&&v.token.length>=32&&(!invite||invite===v.code)?v:null
  }catch{return null}
}
function DiscIcon({colour}:{colour:1|2}){
  return <span aria-hidden="true" className={'rv-disc rv-disc-'+(colour===1?'black':'white')}/>
}
function occupantName(value:Disc){
  return value===1?'Black':value===2?'White':'Empty'
}
function OnlineReversiPage({onBack,onActivityChange,onLocal}:Props & {onLocal:()=>void}){
  const [connected,setConnected]=useState(false)
  const [room,setRoom]=useState<Room|null>(null)
  const [name,setName]=useState(()=>safeLocalStorage.getItem(NAME_KEY)||'')
  const [tab,setTab]=useState<'create'|'join'>(()=>codeFromUrl()?'join':'create')
  const [joinCode,setJoinCode]=useState(codeFromUrl)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [copied,setCopied]=useState(false)
  const [review,setReview]=useState<number|null>(null)
  const socketRef=useRef<Socket|null>(null)
  const sessionRef=useRef<Session|null>(savedSession())

  useEffect(()=>{
    const socket=io({reconnection:true,reconnectionDelay:500,timeout:10000})
    socketRef.current=socket
    socket.on('connect',()=>{
      const previous=sessionRef.current
      // A working WebSocket is not an authenticated room until resume succeeds.
      setConnected(!previous)
      if(!previous)return
      socket.timeout(8000).emit('reversi:resume',previous,(err:Error|null,res:Ack)=>{
        if(!socket.connected)return
        setConnected(true)
        if(err){
          setRoom(null)
          setError('Could not reconnect to your room. Refresh to retry; your saved room code is kept.')
        }else if(res?.ok&&res.room){setRoom(res.room);setError('')}
        else{
          safeLocalStorage.removeItem(SESSION_KEY)
          sessionRef.current=null
          setRoom(null);setError(res?.error||'This Reversi room is no longer available. Create a new one.')
        }
      })
    })
    socket.on('disconnect',()=>setConnected(false))
    socket.on('connect_error',()=>setError('Unable to reach the game server. Check your internet connection.'))
    socket.on('reversi:update',(update:Room)=>{setRoom(update);setError('')})
    return ()=>{socket.disconnect();socketRef.current=null}
  },[])

  useEffect(()=>{
    onActivityChange(room?.phase==='lobby'||room?.phase==='playing')
    return ()=>onActivityChange(false)
  },[room?.phase,onActivityChange])

  useEffect(()=>{setReview(null)},[room?.round])

  const request=useCallback((event:string,payload:unknown):Promise<Ack>=>{
    const socket=socketRef.current
    if(!socket?.connected)return Promise.reject(new Error('No server connection. Check your internet.'))
    return new Promise((resolve,reject)=>{
      socket.timeout(9000).emit(event,payload,(err:Error|null,res:Ack)=>{
        if(err){reject(new Error('Request timed out. Please try again.'));return}
        if(!res?.ok){reject(new Error(res?.error||'Request failed.'));return}
        resolve(res)
      })
    })
  },[])
  const act=async(event:string,payload:unknown,onSuccess?:(result:Ack)=>void)=>{
    if(busy)return
    setBusy(true);setError('')
    try{const result=await request(event,payload);onSuccess?.(result)}
    catch(e){setError(e instanceof Error?e.message:'Something went wrong.')}
    finally{setBusy(false)}
  }
  const joinOrCreate=async()=>{
    const nickname=name.trim()
    if(nickname.length<2||nickname.length>20){setError('Enter a nickname between 2 and 20 characters.');return}
    if(tab==='join'&&joinCode.length!==6){setError('Enter the six-character room code.');return}
    await act(tab==='create'?'reversi:create':'reversi:join',
      tab==='create'?{name:nickname}:{name:nickname,code:joinCode},res=>{
        if(!res.code||!res.token||!res.room)return
        const saved={code:res.code,token:res.token}
        safeLocalStorage.setItem(SESSION_KEY,JSON.stringify(saved))
        safeLocalStorage.setItem(NAME_KEY,nickname)
        sessionRef.current=saved
        setRoom(res.room)
        window.history.replaceState(null,'','/games/reversi')
      })
  }
  const leave=async()=>{
    if(room?.phase==='playing'&&!window.confirm('Exit this Reversi room? Your friend will have to start a new game if you do not reconnect.'))return
    try{await request('reversi:leave',{})}catch{/* Local exit remains possible. */}
    safeLocalStorage.removeItem(SESSION_KEY)
    sessionRef.current=null
    setRoom(null);setError('');setCopied(false)
  }
  const copy=async()=>{
    if(!room)return
    const url=inviteUrl(room.code)
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url)
      else{
        const field=document.createElement('textarea')
        field.value=url;field.style.position='fixed';field.style.opacity='0'
        document.body.appendChild(field);field.select()
        const ok=document.execCommand('copy');field.remove()
        if(!ok)throw new Error('Copy failed')
      }
      setCopied(true);window.setTimeout(()=>setCopied(false),1800)
    }catch{setError('Could not copy the link. You can share the six-character room code.')}
  }
  const share=async()=>{
    if(!room)return
    if(navigator.share){
      try{await navigator.share({title:'Reversi on Playgrove',text:'Play a strategy duel with me! Room: '+room.code,url:inviteUrl(room.code)})}
      catch{/* The user may cancel the share sheet. */}
    }else await copy()
  }
  const me=room?.players.find(p=>p.id===room.you)
  const opponent=room?.players.find(p=>p.id!==room.you)
  const black=room?.players.find(p=>p.disc===1)
  const white=room?.players.find(p=>p.disc===2)
  const myTurn=room?.phase==='playing'&&room.turnPlayerId===room.you
  const bothOnline=room?.players.length===2&&room.players.every(p=>p.online)
  const viewing=review!==null
  const viewedMove=review===null||review===0?null:room?.history?.[review-1]||null
  const displayBoard=viewing?(review===0?startingBoard():viewedMove?.board||room?.board):room?.board
  const displayedLast=viewing?viewedMove:room?.lastMove
  const canMove=Boolean(connected&&bothOnline&&myTurn&&!busy&&!viewing)
  const yourWin=room?.winnerId===room?.you
  const otherName=opponent?.name||'Your friend'
  const playerLabel=(p:Player|undefined)=>!p?'Waiting for player':p.id===room?.you?'You':p.name
  const passed=room?.passedPlayerId?room.players.find(p=>p.id===room.passedPlayerId):null

  return <div className="rv-shell">
    <div className="rv-frame">
      <header className="rv-topbar">
        <button className="rv-back" type="button" onClick={onBack}><ArrowLeft size={17}/> All games</button>
        <span className="rv-brand"><Gamepad2 size={19}/> Reversi<span>.</span></span>
        <span className={'rv-online '+(connected?'is-online':'')}><span/>{connected?'Online':'Offline'}</span>
      </header>
      {error&&<div className="rv-alert" role="alert">{error}<button type="button" onClick={()=>setError('')} aria-label="Dismiss error"><X size={17}/></button></div>}
      {!room&&<main className="rv-entry">
        <section className="rv-intro">
          <span className="rv-eyebrow"><CircleDot size={16}/> THE STRATEGY DUEL</span>
          <h1>Control the corners.<br/><em>Own the board.</em></h1>
          <p>Flip your rival's discs, protect key positions and think three moves ahead. A classic strategy game for two.</p>
          <div className="rv-chips"><span><Users size={16}/> 2 players</span><span><ShieldCheck size={16}/> Private rooms</span><span><Wifi size={16}/> Online together</span></div>
          <button className="rv-local-switch rv-online-local-cta" type="button" onClick={onLocal}>Together on one device? <strong>Play local two-player</strong> <ArrowRight size={16}/></button>
          <div className="rv-rules"><strong>How to play</strong>
            <p>Black moves first. Place a disc to trap at least one opponent disc in a straight line, then flip every captured disc. If you cannot move, your turn passes automatically. When neither player can move, the player with more discs wins.</p>
            <div className="rv-mini-board" aria-hidden="true">{Array.from({length:16},(_,i)=><span key={i} className={i===5||i===10?'rv-mini-white':i===6||i===9?'rv-mini-black':''}/>)}</div>
          </div>
        </section>
        <section className="rv-card rv-join">
          <div className="rv-tabs" role="group" aria-label="Room action">
            <button type="button" className={tab==='create'?'active':''} aria-pressed={tab==='create'} onClick={()=>{setTab('create');setError('')}}>Create room</button>
            <button type="button" className={tab==='join'?'active':''} aria-pressed={tab==='join'} onClick={()=>{setTab('join');setError('')}}>Join room</button>
          </div>
          <div className="rv-form">
            <span className="rv-eyebrow">{tab==='create'?'START THE DUEL':'JOIN YOUR FRIEND'}</span>
            <h2>{tab==='create'?'Ready to flip?':'Have a room code?'}</h2>
            <label htmlFor="rv-name">YOUR NICKNAME</label>
            <input id="rv-name" value={name} maxLength={20} autoComplete="nickname" placeholder="e.g. Alex"
              onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void joinOrCreate()}}/>
            {tab==='join'&&<><label htmlFor="rv-code">6-CHARACTER ROOM CODE</label>
              <input id="rv-code" autoCapitalize="characters" className="rv-code" maxLength={6} placeholder="ABC123" value={joinCode}
                onChange={e=>setJoinCode(cleanCode(e.target.value))} onKeyDown={e=>{if(e.key==='Enter')void joinOrCreate()}}/></>}
            <button className="rv-primary" type="button" disabled={busy||!connected} onClick={()=>void joinOrCreate()}>
              {busy?'Connecting…':tab==='create'?'Create Reversi room':'Join Reversi room'}<ArrowRight size={17}/>
            </button>
          </div>
        </section>
      </main>}

      {room&&<main className="rv-game">
        <div className="rv-room-heading">
          <div><span className="rv-eyebrow">ROOM {room.code} · ROUND {room.round}</span>
            <h1>{room.phase==='lobby'?'Waiting for your friend.':room.phase==='playing'?'A battle of corners.':'Round complete.'}</h1></div>
          <button type="button" className="rv-outline" onClick={()=>void leave()}><X size={17}/> Exit room</button>
        </div>
        <section className="rv-scoreboard" aria-label="Reversi disc counts">
          {([1,2] as const).map(colour=>{
            const player=colour===1?black:white
            const count=colour===1?room.scores.black:room.scores.white
            return <div key={colour} className={'rv-score '+(room.turnPlayerId===player?.id?'rv-score-turn':'')}>
              <DiscIcon colour={colour}/>
              <div><strong>{playerLabel(player)}</strong><span>{colour===1?'BLACK':'WHITE'}{player&&!player.online?' · OFFLINE':''}</span></div>
              <b>{count}</b>
            </div>
          })}
        </section>
        {room.phase==='lobby'&&<section className="rv-card rv-waiting">
          <div className="rv-wait-icon"><Users size={31}/></div>
          <h2>Invite your opponent</h2><p>Send your room link or share the code below. The game begins as soon as your friend joins.</p>
          <span className="rv-eyebrow">YOUR ROOM CODE</span>
          <div className="rv-invite" aria-label={'Room code '+room.code}>{room.code.split('').map((c,i)=><span key={i}>{c}</span>)}</div>
          <div className="rv-invite-actions">
            <button className="rv-primary" type="button" onClick={()=>void copy()}>{copied?<Check size={17}/>:<Copy size={17}/>} {copied?'Copied!':'Copy invite link'}</button>
            <button className="rv-outline" type="button" onClick={()=>void share()}><Share2 size={17}/> Share</button>
          </div>
          <p className="rv-wait-pulse">Waiting for player two…</p>
        </section>}

        {room.phase!=='lobby'&&<section className="rv-layout">
          <div className="rv-card rv-board-panel">
            <div className={'rv-turn-banner '+(canMove?'active':'')} role="status" aria-live="polite" aria-atomic="true">
              {viewing?<><History size={22}/><div><strong>Reviewing {review===0?'the starting board':'move '+review}</strong><span>Review mode does not change your active game.</span></div></>:
                room.phase==='finished'?<><Trophy size={22}/><div><strong>{room.draw?"It's a draw!":yourWin?'You win the board!':otherName+' wins!'}</strong>
                <span>Black {room.scores.black} · White {room.scores.white}. {room.draw?'Equal discs.':'Most discs wins.'}</span></div></>:
                !connected||!bothOnline?<><WifiOff size={22}/><div><strong>Waiting for reconnection</strong><span>Both players must be online to continue.</span></div></>:
                myTurn?<><Sparkles size={22}/><div><strong>Your turn — place a disc!</strong>
                  <span>{room.legalMoves.length} legal {room.legalMoves.length===1?'move':'moves'} highlighted. Trap your rival's discs.</span></div></>:
                <><RotateCcw size={22}/><div><strong>{otherName} is thinking</strong><span>Watch the board and plan your response.</span></div></>}
            </div>
            {passed&&room.phase==='playing'&&<p className="rv-pass" role="status">
              {passed.id===room.you?'You had no legal move, so your turn passed automatically.':passed.name+' had no legal move, so you play again.'}
            </p>}
            <div className="rv-board-heading"><span>8 × 8 BOARD</span><span>{room.moveCount} moves · {room.scores.empty} empty squares</span></div>
            <div className="rv-board-wrap">
              <div className="rv-board" role="grid" aria-label="Reversi board">
                {Array.from({length:8},(_,row)=><div className="rv-board-row" role="row" key={row}>
                  {Array.from({length:8},(_,col)=>{
                    const index=row*8+col,value=displayBoard?.[index]??room.board[index]
                    const legal=canMove&&room.legalMoves.includes(index)
                    const last=displayedLast?.index===index
                    const flipped=displayedLast?.flipped.includes(index)
                    const label='Row '+(row+1)+', column '+(col+1)+': '+occupantName(value)+
                      (value===0?(legal?', legal move':', not a legal move'):'')+(last?', last move':'')
                    return <button key={index} type="button" role="gridcell" aria-label={label}
                      className={'rv-cell'+(legal?' rv-cell-legal':'')+(last?' rv-cell-last':'')+(flipped?' rv-cell-flipped':'')}
                      disabled={!legal} onClick={()=>void act('reversi:place',{index})}>
                      {value!==0?<DiscIcon colour={value}/>:legal?<span className="rv-move-hint" aria-hidden="true"/>:null}
                      {last&&<span className="rv-last-dot" aria-hidden="true"/>}
                    </button>
                  })}
                </div>)}
              </div>
            </div>
            <p className="rv-board-tip">
              {viewing?'Review mode: use Live board in Move history to return to the current turn.':room.phase==='finished'?'Round finished. Both players must agree to start another.':
                !bothOnline?'Play resumes when your friend reconnects.':
                  'Place a disc to trap enemy discs horizontally, vertically, or diagonally. Corners are powerful.'}
            </p>
          </div>
          <aside className="rv-side">
            <div className="rv-card rv-stats">
              <span className="rv-eyebrow">THE SCORE</span>
              <h2>Board control</h2>
              <div className="rv-score-bars" aria-label={'Black '+room.scores.black+', White '+room.scores.white}>
                <span className="rv-black-bar" style={{flex:room.scores.black||0.01}}/>
                <span className="rv-white-bar" style={{flex:room.scores.white||0.01}}/>
              </div>
              <div className="rv-stat-row"><span><DiscIcon colour={1}/> Black</span><strong>{room.scores.black}</strong></div>
              <div className="rv-stat-row"><span><DiscIcon colour={2}/> White</span><strong>{room.scores.white}</strong></div>
              <div className="rv-stat-row"><span>Empty squares</span><strong>{room.scores.empty}</strong></div>
              {room.lastMove&&<p className="rv-move-info">Last move: {String.fromCharCode(97+room.lastMove.index%8)}{8-Math.floor(room.lastMove.index/8)}
                {' · '+room.lastMove.flipped.length+' '+(room.lastMove.flipped.length===1?'disc':'discs')+' flipped'}</p>}
            </div>
            <div className="rv-card rv-history">
              <div className="rv-history-title"><History size={18}/><h2>Move history</h2></div>
              <div className="rv-history-list" role="group" aria-label="Review moves">
                <button type="button" aria-pressed={review===0} onClick={()=>setReview(0)}>Start · 2–2</button>
                {(room.history||[]).map((move,i)=><button type="button" key={i} aria-pressed={review===i+1} onClick={()=>setReview(i+1)}>
                  {i+1}. {move.disc===1?'Black':'White'} · {String.fromCharCode(97+move.index%8)}{8-Math.floor(move.index/8)} · {move.flipped.length} flipped
                </button>)}
              </div>
              <button type="button" className="rv-live" onClick={()=>setReview(null)} disabled={!viewing}>Live board <ArrowRight size={15}/></button>
            </div>
            {room.phase==='playing'?<div className="rv-card rv-tip">
              <CircleDot size={23}/><h3>Think ahead</h3>
              <p>Taking the most discs immediately is not always the best move. Corners cannot be flipped, so controlling them matters.</p>
              <button type="button" className="rv-resign" disabled={busy||!connected||!bothOnline} onClick={()=>{
                if(window.confirm('Resign this Reversi round? Your opponent will win.'))void act('reversi:resign',{})
              }}><Flag size={16}/> Resign round</button>
            </div>:
            <div className="rv-card rv-rematch">
              <Trophy size={31}/><h2>{room.draw?'Evenly matched.':yourWin?'Well played!':'Ready for a comeback?'}</h2>
              <p>Both players must agree before the next round. The Black and White seats swap automatically.</p>
              <button type="button" className="rv-primary" disabled={busy||!connected||!bothOnline||Boolean(me?.rematchReady)}
                onClick={()=>void act('reversi:rematch',{})}>
                {me?.rematchReady?'Waiting for your friend…':'Request rematch'}<RotateCcw size={17}/>
              </button>
              {opponent?.rematchReady&&<p className="rv-ready">Your friend is ready for a rematch.</p>}
            </div>}
          </aside>
        </section>}
      </main>}
      <footer className="rv-footer">playgrove<span>.</span> · Mind games for good company.</footer>
    </div>
  </div>
}

const MODE_KEY='playgrove:reversi:mode:v1'
export default function ReversiPage(props:Props){
  const [mode,setMode]=useState<'online'|'local'>(()=>{
    if(new URLSearchParams(window.location.search).has('room'))return 'online'
    try{return sessionStorage.getItem(MODE_KEY)==='local'?'local':'online'}catch{return 'online'}
  })
  const choose=(next:'online'|'local')=>{
    setMode(next)
    try{sessionStorage.setItem(MODE_KEY,next)}catch{/* Local mode still works without storage. */}
  }
  return mode==='local'?<LocalReversiPage onBack={props.onBack} onOnline={()=>choose('online')}/>:
    <OnlineReversiPage {...props} onLocal={()=>choose('local')}/>
}
