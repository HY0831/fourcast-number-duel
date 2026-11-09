import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, Eraser, Gamepad2, Grid3X3, LockKeyhole, RotateCcw, Share2, ShieldCheck, Trophy, Users, Wifi, WifiOff, X } from 'lucide-react'
import { io, type Socket } from 'socket.io-client'
import './bingo.css'

type Phase = 'lobby' | 'setup' | 'playing' | 'finished'
type Player = { id: string; name: string; isHost: boolean; online: boolean; ready: boolean; lines: number; board?: number[] | null }
type Call = { by: string; number: number }
type BingoRoom = {
  code: string; phase: Phase; round: number; you: string; hostId: string;
  turnPlayerId: string | null; winnerId: string | null; draw: boolean;
  yourBoard: number[] | null; players: Player[]; called: number[]; calls: Call[]
}
type BingoSession = { code: string; token: string }
type RoomAck = { ok: boolean; error?: string; code?: string; token?: string; room?: BingoRoom }
type Props = { onBack: () => void; onActivityChange: (active: boolean) => void }
type CellValue = number | null
const SESSION = 'bingo:session'
const NAME = 'bingo:name'
const blankBoard = (): CellValue[] => Array.from({ length: 25 }, () => null)
const LETTERS = 'BINGO'

function inviteCode() {
  return (new URLSearchParams(window.location.search).get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}
function readSession(): BingoSession | null {
  try {
    const item = JSON.parse(localStorage.getItem(SESSION) || 'null') as BingoSession | null
    if (!item || typeof item.token !== 'string' || typeof item.code !== 'string' || item.code.length !== 6) return null
    return inviteCode() && item.code !== inviteCode() ? null : item
  } catch { return null }
}
function readDraft(code: string, round: number) {
  try {
    const value = JSON.parse(localStorage.getItem(`bingo:draft:${code}:${round}`) || 'null') as CellValue[] | null
    if (Array.isArray(value) && value.length === 25 && value.every(n => n === null || Number.isInteger(n) && n >= 1 && n <= 25) && new Set(value.filter(n => n !== null)).size === value.filter(n => n !== null).length) return value
  } catch { /* ignore invalid local draft */ }
  return blankBoard()
}
function inviteLink(code: string) {
  return `${window.location.origin}/games/bingo?room=${encodeURIComponent(code)}`
}
function bingoLines(board: CellValue[], called: number[]) {
  const marked = new Set(called)
  const patterns = [
    ...Array.from({ length: 5 }, (_, row) => Array.from({ length: 5 }, (_, col) => row * 5 + col)),
    ...Array.from({ length: 5 }, (_, col) => Array.from({ length: 5 }, (_, row) => row * 5 + col)),
    [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
  ]
  return patterns.filter(line => line.every(index => board[index] !== null && marked.has(board[index] as number)))
}
function Letters({ lines }: { lines: number }) {
  return <div className="bgo-letters" aria-label={`${lines} of 5 lines complete`}>
    {LETTERS.split('').map((letter, index) => <span key={letter} className={index < lines ? 'bgo-earned' : ''}>{letter}</span>)}
  </div>
}

export default function BingoPage({ onBack, onActivityChange }: Props) {
  const [connected, setConnected] = useState(false)
  const [room, setRoom] = useState<BingoRoom | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const sessionRef = useRef<BingoSession | null>(readSession())
  const [name, setName] = useState(() => localStorage.getItem(NAME) || '')
  const [tab, setTab] = useState<'create' | 'join'>(() => inviteCode() ? 'join' : 'create')
  const [joinCode, setJoinCode] = useState(inviteCode)
  const [board, setBoard] = useState<CellValue[]>(blankBoard)
  const [selectedCell, setSelectedCell] = useState(0)
  const [selectedCall, setSelectedCall] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const keyRef = useRef('')

  useEffect(() => {
    const socket = io({ reconnection: true, reconnectionDelay: 500, timeout: 10000 })
    socketRef.current = socket
    socket.on('connect', () => {
      setConnected(true)
      const saved = sessionRef.current
      if (!saved) return
      socket.timeout(8000).emit('bingo:resume', saved, (err: Error | null, res: RoomAck) => {
        if (err) { setError('Connection timed out. Try again.'); return }
        if (res?.ok && res.room) { setRoom(res.room); setError('') }
        else {
          localStorage.removeItem(SESSION)
          sessionRef.current = null
          setRoom(null)
          setError(res?.error || 'That Bingo room is no longer available.')
        }
      })
    })
    socket.on('disconnect', () => setConnected(false))
    socket.on('bingo:update', (next: BingoRoom) => { setRoom(next); setError(''); setSelectedCall(null) })
    socket.on('connect_error', () => setError('Cannot connect to the game server.'))
    return () => { socket.disconnect(); socketRef.current = null }
  }, [])

  useEffect(() => {
    onActivityChange(room?.phase === 'setup' || room?.phase === 'playing')
    return () => onActivityChange(false)
  }, [room?.phase, onActivityChange])

  useEffect(() => {
    if (!room) return
    const current = `${room.code}:${room.round}`
    if (keyRef.current !== current) {
      keyRef.current = current
      setBoard(room.yourBoard ? [...room.yourBoard] : readDraft(room.code, room.round))
      setSelectedCell(0)
      setSelectedCall(null)
    } else if (room.yourBoard) setBoard([...room.yourBoard])
  }, [room?.code, room?.round, room?.yourBoard])

  const me = room?.players.find(p => p.id === room.you)
  const opponent = room?.players.find(p => p.id !== room.you)
  const isTurn = room?.phase === 'playing' && room.turnPlayerId === room.you
  const bothOnline = room?.players.length === 2 && room.players.every(p => p.online)
  const called = room?.called || []
  const calledSet = new Set(called)
  const ownBoard = room?.yourBoard || board
  const completeLines = bingoLines(ownBoard, called)
  const completedIndices = new Set(completeLines.flat())
  const filled = board.filter(n => n !== null).length
  const complete = filled === 25 && new Set(board).size === 25

  const updateBoard = (next: CellValue[]) => {
    setBoard(next)
    if (room) localStorage.setItem(`bingo:draft:${room.code}:${room.round}`, JSON.stringify(next))
  }
  const selectNumber = (number: number) => {
    if (me?.ready || busy || board.some((n, index) => n === number && index !== selectedCell)) return
    const next = [...board]
    next[selectedCell] = number
    updateBoard(next)
    const nextEmpty = next.findIndex((n, index) => n === null && index > selectedCell)
    setSelectedCell(nextEmpty !== -1 ? nextEmpty : next.findIndex(n => n === null) !== -1 ? next.findIndex(n => n === null) : selectedCell)
  }
  const clearCell = () => {
    if (me?.ready || busy) return
    const next = [...board]
    next[selectedCell] = null
    updateBoard(next)
  }

  const request = useCallback((event: string, payload: unknown): Promise<RoomAck> => {
    const socket = socketRef.current
    if (!socket?.connected) return Promise.reject(new Error('No internet connection.'))
    return new Promise((resolve, reject) => {
      socket.timeout(9000).emit(event, payload, (err: Error | null, res: RoomAck) => {
        if (err) { reject(new Error('Request timed out. Check your connection.')); return }
        if (!res?.ok) { reject(new Error(res?.error || 'Request failed.')); return }
        resolve(res)
      })
    })
  }, [])
  const act = async (event: string, payload: unknown, callback?: (res: RoomAck) => void) => {
    setBusy(true)
    setError('')
    try { const res = await request(event, payload); callback?.(res) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not complete this action.') }
    finally { setBusy(false) }
  }
  const joinOrCreate = async () => {
    const clean = name.trim()
    if (clean.length < 2 || clean.length > 20) { setError('Your nickname must be 2–20 characters.'); return }
    if (tab === 'join' && joinCode.length !== 6) { setError('Enter a six-character room code.'); return }
    const event = tab === 'create' ? 'bingo:create' : 'bingo:join'
    await act(event, tab === 'create' ? { name: clean } : { name: clean, code: joinCode }, res => {
      if (!res.code || !res.token || !res.room) return
      const session = { code: res.code, token: res.token }
      localStorage.setItem(SESSION, JSON.stringify(session))
      localStorage.setItem(NAME, clean)
      sessionRef.current = session
      setRoom(res.room)
      window.history.replaceState(null, '', '/games/bingo')
    })
  }
  const leaveRoom = async () => {
    if (room && (room.phase === 'setup' || room.phase === 'playing') && !window.confirm('Leave this Bingo room permanently? Your opponent will need to wait or create another room.')) return
    try { await request('bingo:leave', {}) } catch { /* local leave is allowed */ }
    localStorage.removeItem(SESSION)
    sessionRef.current = null
    keyRef.current = ''
    setRoom(null); setBoard(blankBoard()); setSelectedCell(0); setSelectedCall(null); setError('')
  }
  const copyLink = async () => {
    if (!room) return
    try { await navigator.clipboard.writeText(inviteLink(room.code)); setCopied(true); window.setTimeout(() => setCopied(false), 1700) }
    catch { setError('Could not copy the link. You can share your room code instead.') }
  }
  const shareLink = async () => {
    if (!room) return
    if (navigator.share) {
      try { await navigator.share({ title: 'Play Bingo Duel with me', text: `Join my Bingo game! Room ${room.code}`, url: inviteLink(room.code) }) }
      catch { /* sharing was cancelled */ }
    } else await copyLink()
  }
  const chooseCell = (index: number) => {
    if (!room) return
    if (room.phase === 'setup' && !me?.ready) setSelectedCell(index)
    if (room.phase === 'playing' && isTurn && bothOnline && !calledSet.has(ownBoard[index] as number)) setSelectedCall(ownBoard[index] as number)
  }
  const call = () => {
    if (selectedCall === null) return
    void act('bingo:call', { number: selectedCall }, () => setSelectedCall(null))
  }
  const lastCall = room?.calls.at(-1)
  const caller = room?.players.find(p => p.id === lastCall?.by)

  return <div className="bgo-shell">
    <div className="bgo-frame">
      <header className="bgo-topbar">
        <button type="button" className="bgo-back" onClick={onBack}><ArrowLeft size={18} /> All games</button>
        <div className="bgo-brand"><Grid3X3 size={19} /> Bingo Duel<span>.</span></div>
        <div className={`bgo-connection ${connected ? 'bgo-online' : ''}`}><span /> {connected ? 'Online' : 'Offline'}</div>
      </header>
      {error && <div className="bgo-alert" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Dismiss error"><X size={17}/></button></div>}

      {!room && <main className="bgo-entry">
        <section className="bgo-intro"><span className="bgo-eyebrow"><Gamepad2 size={16}/> THE FIVE-LINE NUMBER DUEL</span><h1>Five lines.<br/><em>One BINGO.</em></h1>
          <p>Create your own 5×5 number board, call numbers in turns, and race your friend to five complete lines.</p>
          <div className="bgo-chips"><span><Users size={16}/> 2 players</span><span><ShieldCheck size={16}/> Private room</span><span><Wifi size={16}/> Live online</span></div>
          <div className="bgo-rule-mini"><strong>How it works</strong><span>1–25, once each · No free square · 5 lines wins · Both boards mark each call</span></div>
        </section>
        <section className="bgo-card bgo-join-card">
          <div className="bgo-tabs"><button type="button" className={tab === 'create' ? 'active' : ''} onClick={() => {setTab('create');setError('')}}>Create room</button><button type="button" className={tab === 'join' ? 'active' : ''} onClick={() => {setTab('join');setError('')}}>Join room</button></div>
          <div className="bgo-form"><span className="bgo-eyebrow">{tab === 'create' ? 'START A BINGO DUEL' : 'JOIN YOUR FRIEND'}</span><h2>{tab === 'create' ? 'Your next challenge.' : 'Got a room code?'}</h2>
            <label htmlFor="bgo-name">YOUR NICKNAME</label><input id="bgo-name" placeholder="e.g. Alex" maxLength={20} autoComplete="nickname" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&void joinOrCreate()}/>
            {tab === 'join' && <><label htmlFor="bgo-code">6-CHARACTER ROOM CODE</label><input id="bgo-code" placeholder="ABC123" maxLength={6} autoCapitalize="characters" className="bgo-code-input" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6))} onKeyDown={e=>e.key==='Enter'&&void joinOrCreate()}/></>}
            <button type="button" className="bgo-primary" disabled={!connected||busy} onClick={()=>void joinOrCreate()}>{busy?'Connecting...':tab==='create'?'Create Bingo room':'Join Bingo room'}<ArrowRight size={18}/></button>
          </div>
        </section>
      </main>}

      {room && <main className="bgo-game">
        <div className="bgo-room-heading"><div><span className="bgo-eyebrow">ROOM {room.code} · ROUND {room.round}</span><h1>{room.phase === 'lobby'?'Waiting for your friend.':room.phase === 'setup'?'Build your board.':room.phase === 'playing'?'The numbers are calling.':'BINGO!'}</h1></div><button className="bgo-outline bgo-exit" type="button" onClick={()=>void leaveRoom()}><X size={17}/> Exit room</button></div>
        <section className="bgo-scoreboard" aria-label="Player progress">
          {room.players.map((p, index) => <div key={p.id} className={`bgo-player ${p.id===room.turnPlayerId?'bgo-player-turn':''}`}><div className="bgo-player-top"><span>{p.id===room.you?'You':p.name}</span><small>{p.isHost?'HOST':`PLAYER ${index+1}`}{!p.online?' · OFFLINE':''}</small></div><Letters lines={p.lines}/><span className="bgo-progress-text">{p.lines}/5 lines {room.phase==='setup'?(p.ready?'· Board locked':'· Setting up'):''}</span></div>)}
          {room.players.length === 1 && <div className="bgo-player bgo-player-placeholder"><div className="bgo-player-top"><span>Player 2</span><small>WAITING</small></div><Letters lines={0}/><span className="bgo-progress-text">Share your room code</span></div>}
        </section>

        {room.phase === 'lobby' && <section className="bgo-card bgo-waiting"><div className="bgo-icon"><Users size={28}/></div><h2>Battle with a friend</h2><p>Send your invite link or room code. When your friend joins, each of you can fill your own board.</p><span className="bgo-eyebrow">YOUR ROOM CODE</span><div className="bgo-invite-code" aria-label={`Room code ${room.code}`}>{room.code.split('').map((char,i)=><span key={i}>{char}</span>)}</div><div className="bgo-waiting-actions"><button type="button" className="bgo-primary" onClick={()=>void copyLink()}>{copied?<Check size={18}/>:<Copy size={18}/>} {copied?'Copied!':'Copy invite link'}</button><button type="button" className="bgo-outline" onClick={()=>void shareLink()}><Share2 size={17}/> Share</button></div><div className="bgo-waiting-notice"><span className="bgo-pulse"/> Waiting for another player…</div></section>}

        {(room.phase === 'setup' || room.phase === 'playing' || room.phase === 'finished') && <div className="bgo-play-columns"><div className="bgo-card bgo-board-card">
          {room.phase==='setup' ? <div className="bgo-status"><span className="bgo-status-icon"><LockKeyhole size={20}/></span><div><strong>{me?.ready?'Your board is locked':'Your own board, your choice.'}</strong><span>{me?.ready?'Waiting for your friend to finish their board.':'Enter each number from 1 to 25 exactly once. No automatic arrangement.'}</span></div></div>
            : room.phase==='playing' ? <div className={`bgo-status ${isTurn&&bothOnline?'bgo-status-active':''}`}><span className="bgo-status-icon">{!bothOnline?<WifiOff size={20}/>:isTurn?<CheckCircle2 size={20}/>:<RotateCcw size={20}/>}</span><div><strong>{!bothOnline?'Waiting for reconnection':isTurn?'Your turn — call a number!':`${opponent?.name||'Opponent'} is choosing`}</strong><span>{!bothOnline?'Both players must be online.':isTurn?'Tap an unmarked number, then confirm your call.':'Every called number is marked for both players.'}</span></div></div>
            : <div className="bgo-status bgo-status-active"><span className="bgo-status-icon"><Trophy size={21}/></span><div><strong>{room.draw?"It's a draw!":room.winnerId===room.you?'You got BINGO!':`${opponent?.name||'Opponent'} got BINGO!`}</strong><span>Five completed lines. Round {room.round} is finished.</span></div></div>}
          <div className="bgo-board-heading"><span>YOUR 5 × 5 BOARD</span><span>{room.phase==='setup'?(me?.ready?'25 / 25 filled':`${filled} / 25 filled`):`${called.length} numbers called`}</span></div>
          <div className="bgo-board" role="grid" aria-label="Your Bingo board">
            {ownBoard.map((n, index)=>{
              const marked=n!==null&&calledSet.has(n)
              const locked=room.phase!=='setup'||!!me?.ready
              const selected=room.phase==='setup'?!me?.ready&&selectedCell===index:room.phase==='playing'&&n===selectedCall
              const interactive=room.phase==='setup'&&!me?.ready||room.phase==='playing'&&isTurn&&bothOnline&&!marked
              return <button key={index} role="gridcell" type="button" className={`bgo-cell ${selected?'bgo-selected':''} ${marked?'bgo-marked':''} ${marked&&completedIndices.has(index)?'bgo-complete':''} ${n===null?'bgo-blank':''}`} onClick={()=>chooseCell(index)} disabled={!interactive||busy} aria-selected={selected} aria-label={`Row ${Math.floor(index/5)+1} column ${index%5+1}: ${n===null?'empty':n}${marked?', called':''}`}>
                {n??<span aria-hidden="true">·</span>}
                {marked&&<span className="bgo-cell-cross" aria-hidden="true"/>}
              </button>
            })}
          </div>
          {room.phase==='setup'&&!me?.ready && <>
            <div className="bgo-board-note"><span><CheckCircle2 size={16}/> Select a cell, then enter a number below.</span><span>{25-filled} remaining</span></div>
            <div className="bgo-number-picker" role="group" aria-label="Numbers to place on your board">
              {Array.from({length:25},(_,i)=>i+1).map(n=><button type="button" key={n} aria-label={`Place ${n}`} className={board.includes(n)?'bgo-number-used':''} onClick={()=>selectNumber(n)} disabled={busy||board.some((v,i)=>v===n&&i!==selectedCell)}>{n}</button>)}
            </div>
            <div className="bgo-setup-controls"><button type="button" className="bgo-outline" onClick={clearCell}><Eraser size={17}/> Clear cell</button><button type="button" className="bgo-outline" onClick={()=>{if(window.confirm('Clear every number from your board?')){updateBoard(blankBoard());setSelectedCell(0)}}}><RotateCcw size={16}/> Reset board</button></div>
            <button type="button" className="bgo-primary bgo-lock" disabled={!connected||busy||!complete} onClick={()=>void act('bingo:board',{board},()=>{if(room)localStorage.removeItem(`bingo:draft:${room.code}:${room.round}`)})}>Lock my board <LockKeyhole size={18}/></button>
          </>}
          {room.phase==='setup'&&me?.ready&&<div className="bgo-waiting-notice"><span className="bgo-pulse"/> Waiting for your opponent to lock their board…</div>}
          {room.phase==='playing'&&<div className="bgo-call-controls"><button type="button" className="bgo-primary bgo-call-button" disabled={!isTurn||!bothOnline||busy||!connected||selectedCall===null} onClick={call}>{selectedCall===null?'Select a number to call':`Call number ${selectedCall}`}<ArrowRight size={18}/></button></div>}
          {room.phase==='finished'&&<div className="bgo-finished-actions">{me?.isHost?<button type="button" className="bgo-primary" disabled={busy||!connected} onClick={()=>void act('bingo:rematch',{})}>Play another round <RotateCcw size={18}/></button>:<div className="bgo-waiting-notice"><span className="bgo-pulse"/> Waiting for the host to start a rematch…</div>}</div>}
        </div>
        <aside className="bgo-side">
          <section className="bgo-card bgo-rules"><span className="bgo-eyebrow">THE RULES</span><h3>Race to BINGO.</h3><p>Each player uses numbers 1–25 once. Take turns calling an unused number; it marks both boards.</p><p>Complete any 5 rows, columns or diagonals to win. If you both reach five on the same call, it's a draw.</p><div className="bgo-rule-badge"><ShieldCheck size={17}/> Opponent's layout stays hidden until the round ends.</div></section>
          {room.phase!=='setup'&&<section className="bgo-card bgo-history"><span className="bgo-eyebrow">CALLED NUMBERS</span><h3>{called.length} of 25 called</h3>{room.calls.length?<div className="bgo-calls">{room.calls.slice().reverse().map((c,index)=><div className="bgo-call-history" key={`${c.number}-${index}`}><strong>{c.number}</strong><span>{c.by===room.you?'You':room.players.find(p=>p.id===c.by)?.name||'Opponent'} called</span></div>)}</div>:<p>No numbers called yet. The first player starts.</p>}</section>}
          {room.phase==='finished'&&<section className="bgo-card bgo-result"><span className="bgo-eyebrow">FINAL SCORE</span><h3>{room.draw?'Draw':room.winnerId===room.you?'You win!':'Opponent wins!'}</h3>{room.players.map(p=><div className="bgo-result-player" key={p.id}><span>{p.id===room.you?'You':p.name}</span><strong>{p.lines} lines</strong></div>)}</section>}
        </aside></div>}
      </main>}
      <footer className="bgo-footer">playgrove<span>.</span> <span>· Bingo Duel · Five lines to win</span></footer>
    </div>
  </div>
}
