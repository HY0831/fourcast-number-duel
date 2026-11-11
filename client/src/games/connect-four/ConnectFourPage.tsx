import { safeLocalStorage } from '../../playgrove/safeStorage'
import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { ArrowLeft, ArrowRight, Check, CircleDot, Copy, Gamepad2, RotateCcw, Share2, ShieldCheck, Trophy, Users, Wifi, WifiOff, X } from 'lucide-react'
import './connect-four.css'

type Phase = 'lobby' | 'playing' | 'finished'
type Player = { id: string; name: string; isHost: boolean; online: boolean; rematchReady: boolean }
type Move = { row: number; column: number; index: number; by: string }
type Room = {
  code: string; phase: Phase; round: number; you: string;
  board: number[]; turnPlayerId: string | null; winnerId: string | null; draw: boolean;
  winningCells: number[]; lastMove: Move | null; players: Player[]
}
type Session = { code: string; token: string }
type Ack = { ok: boolean; error?: string; code?: string; token?: string; room?: Room }
type Props = { onBack: () => void; onActivityChange: (active: boolean) => void }
const SESSION = 'connect4:session'
const NAME = 'connect4:name'
const cleanRoomCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
const roomFromUrl = () => cleanRoomCode(new URLSearchParams(window.location.search).get('room') || '')
const inviteUrl = (code: string) => `${window.location.origin}/games/connect-four?room=${encodeURIComponent(code)}`

function savedSession(): Session | null {
  try {
    const v = JSON.parse(safeLocalStorage.getItem(SESSION) || 'null') as Session | null
    const invite = roomFromUrl()
    return v && typeof v.code === 'string' && v.code.length === 6 && typeof v.token === 'string' && v.token.length >= 32 && (!invite || invite === v.code) ? v : null
  } catch { return null }
}

export default function ConnectFourPage({ onBack, onActivityChange }: Props) {
  const [connected, setConnected] = useState(false)
  const [room, setRoom] = useState<Room | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const sessionRef = useRef<Session | null>(savedSession())
  const [name, setName] = useState(() => safeLocalStorage.getItem(NAME) || '')
  const [tab, setTab] = useState<'create' | 'join'>(() => roomFromUrl() ? 'join' : 'create')
  const [joinCode, setJoinCode] = useState(roomFromUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const socket = io({ reconnection: true, reconnectionDelay: 500, timeout: 10000 })
    socketRef.current = socket
    socket.on('connect', () => {
      const previous = sessionRef.current
      // Socket transport recovery is not room recovery until resume is acknowledged.
      setConnected(!previous)
      if (!previous) return
      socket.timeout(8000).emit('connect4:resume', previous, (err: Error | null, res: Ack) => {
        if (!socket.connected) return
        setConnected(true)
        if (err) {
          setRoom(null)
          setError('Could not restore the room. Refresh this page to retry; your saved session is kept.')
          return
        }
        if (res?.ok && res.room) { setRoom(res.room); setError('') }
        else {
          safeLocalStorage.removeItem(SESSION)
          sessionRef.current = null
          setRoom(null)
          setError(res?.error || 'Your previous Connect Four room is no longer available.')
        }
      })
    })
    socket.on('disconnect', () => setConnected(false))
    socket.on('connect4:update', (next: Room) => { setRoom(next); setError('') })
    socket.on('connect_error', () => setError('Cannot connect to the game server.'))
    return () => { socket.disconnect(); socketRef.current = null }
  }, [])

  useEffect(() => {
    onActivityChange(room?.phase === 'lobby' || room?.phase === 'playing')
    return () => onActivityChange(false)
  }, [room?.phase, onActivityChange])

  const request = useCallback((event: string, payload: unknown): Promise<Ack> => {
    const socket = socketRef.current
    if (!socket?.connected) return Promise.reject(new Error('No internet connection.'))
    return new Promise((resolve, reject) => {
      socket.timeout(9000).emit(event, payload, (err: Error | null, response: Ack) => {
        if (err) { reject(new Error('The request timed out. Check your connection.')); return }
        if (!response?.ok) { reject(new Error(response?.error || 'The request failed.')); return }
        resolve(response)
      })
    })
  }, [])

  const act = async (event: string, payload: unknown, onSuccess?: (response: Ack) => void) => {
    if (busy) return
    setBusy(true); setError('')
    try { const response = await request(event, payload); onSuccess?.(response) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not complete this action.') }
    finally { setBusy(false) }
  }

  const joinOrCreate = async () => {
    const nickname = name.trim()
    if (nickname.length < 2 || nickname.length > 20) { setError('Your nickname must be 2–20 characters.'); return }
    if (tab === 'join' && joinCode.length !== 6) { setError('Enter a six-character room code.'); return }
    await act(tab === 'create' ? 'connect4:create' : 'connect4:join', tab === 'create' ? { name: nickname } : { name: nickname, code: joinCode }, result => {
      if (!result.code || !result.token || !result.room) return
      const session = { code: result.code, token: result.token }
      safeLocalStorage.setItem(SESSION, JSON.stringify(session))
      safeLocalStorage.setItem(NAME, nickname)
      sessionRef.current = session
      setRoom(result.room)
      window.history.replaceState(null, '', '/games/connect-four')
    })
  }

  const leaveRoom = async () => {
    if (room && room.phase === 'playing' && !window.confirm('Leave this Connect Four room? Your friend will have to wait for you to reconnect.')) return
    try { await request('connect4:leave', {}) } catch { /* local exit still allowed */ }
    safeLocalStorage.removeItem(SESSION)
    sessionRef.current = null
    setRoom(null); setError('')
  }
  const copyLink = async () => {
    if (!room) return
    try {
      await navigator.clipboard.writeText(inviteUrl(room.code))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch { setError('Could not copy the link. Share the room code instead.') }
  }
  const shareLink = async () => {
    if (!room) return
    if (navigator.share) {
      try { await navigator.share({ title: 'Connect Four on Playgrove', text: `Join my game with code ${room.code}`, url: inviteUrl(room.code) }) }
      catch { /* cancelled */ }
    } else await copyLink()
  }

  const me = room?.players.find(p => p.id === room.you)
  const opponent = room?.players.find(p => p.id !== room.you)
  const yourTurn = room?.phase === 'playing' && room.turnPlayerId === room.you
  const bothOnline = room?.players.length === 2 && room.players.every(p => p.online)
  const canMove = Boolean(connected && bothOnline && yourTurn && !busy)
  const isWinner = room?.winnerId === room?.you
  const lastColumn = room?.lastMove?.column
  const playerName = (p: Player) => p.id === room?.you ? 'You' : p.name

  return <div className="c4-shell"><div className="c4-frame">
    <header className="c4-topbar">
      <button className="c4-back" type="button" onClick={onBack}><ArrowLeft size={17}/> All games</button>
      <span className="c4-brand"><Gamepad2 size={19}/> Connect Four<span>.</span></span>
      <span className={`c4-connection ${connected ? 'is-online' : ''}`}><span/> {connected ? 'Online' : 'Offline'}</span>
    </header>
    {error && <div className="c4-alert" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Dismiss error"><X size={17}/></button></div>}

    {!room && <main className="c4-entry">
      <section className="c4-intro">
        <span className="c4-eyebrow"><CircleDot size={16}/> THE FOUR-IN-A-ROW DUEL</span>
        <h1>Four in a row.<br/><em>One winner.</em></h1>
        <p>Drop your discs, block your friend, and connect four to win. Play together from different places.</p>
        <div className="c4-chips"><span><Users size={16}/> 2 players</span><span><ShieldCheck size={16}/> Private room</span><span><Wifi size={16}/> Live online</span></div>
        <div className="c4-mini-rule"><strong>Easy to play</strong><span>7 columns × 6 rows · Alternate turns · Connect 4 to win</span></div>
      </section>
      <section className="c4-card c4-join-card">
        <div className="c4-tabs" role="group" aria-label="Room action">
          <button type="button" aria-pressed={tab === 'create'} className={tab === 'create' ? 'active' : ''} onClick={() => { setTab('create'); setError('') }}>Create room</button>
          <button type="button" aria-pressed={tab === 'join'} className={tab === 'join' ? 'active' : ''} onClick={() => { setTab('join'); setError('') }}>Join room</button>
        </div>
        <div className="c4-form">
          <span className="c4-eyebrow">{tab === 'create' ? 'YOUR NEXT CHALLENGE' : 'JOIN YOUR FRIEND'}</span>
          <h2>{tab === 'create' ? 'Start the duel.' : 'Got an invite code?'}</h2>
          <label htmlFor="c4-name">YOUR NICKNAME</label>
          <input id="c4-name" value={name} maxLength={20} placeholder="e.g. Alex" autoComplete="nickname" onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void joinOrCreate() }} />
          {tab === 'join' && <><label htmlFor="c4-code">6-CHARACTER ROOM CODE</label><input id="c4-code" className="c4-code-input" value={joinCode} maxLength={6} placeholder="ABC123" autoCapitalize="characters" onChange={e => setJoinCode(cleanRoomCode(e.target.value))} onKeyDown={e => { if (e.key === 'Enter') void joinOrCreate() }} /></>}
          <button className="c4-primary" type="button" disabled={busy || !connected} onClick={() => void joinOrCreate()}>{busy ? 'Connecting…' : tab === 'create' ? 'Create Connect Four room' : 'Join Connect Four room'}<ArrowRight size={17}/></button>
        </div>
      </section>
    </main>}

    {room && <main className="c4-game">
      <div className="c4-room-heading">
        <div><span className="c4-eyebrow">ROOM {room.code} · ROUND {room.round}</span><h1>{room.phase === 'lobby' ? 'Waiting for your friend.' : room.phase === 'playing' ? 'The next move is yours.' : 'Round complete.'}</h1></div>
        <button type="button" className="c4-outline c4-exit" onClick={() => void leaveRoom()}><X size={17}/> Exit room</button>
      </div>
      <section className="c4-players" aria-label="Player status">
        {room.players.map((p, index) => <div key={p.id} className={`c4-player ${room.turnPlayerId === p.id ? 'c4-player-turn' : ''}`}>
          <div className={`c4-disc c4-disc-${index+1}`} aria-hidden="true">{index+1}</div>
          <div><strong>{playerName(p)}</strong><span>{p.isHost ? 'HOST' : 'PLAYER 2'}{!p.online ? ' · OFFLINE' : ''}</span></div>
          <small>{room.phase === 'finished' ? (room.winnerId === p.id ? 'WINNER' : p.rematchReady ? 'REMATCH READY' : 'FINISHED') : room.turnPlayerId === p.id ? 'YOUR MOVE' : 'WAITING'}</small>
        </div>)}
        {room.players.length === 1 && <div className="c4-player c4-placeholder"><div className="c4-disc c4-empty" aria-hidden="true">2</div><div><strong>Player 2</strong><span>NOT CONNECTED</span></div><small>WAITING</small></div>}
      </section>

      {room.phase === 'lobby' && <section className="c4-card c4-waiting">
        <div className="c4-round-icon"><Users size={28}/></div>
        <h2>Battle with a friend</h2><p>Share the invite link or room code below. Your game begins automatically when a friend joins.</p>
        <span className="c4-eyebrow">YOUR ROOM CODE</span>
        <div className="c4-invite-code" aria-label={`Room code ${room.code}`}>{room.code.split('').map((c,i)=><span key={i}>{c}</span>)}</div>
        <div className="c4-waiting-actions">
          <button className="c4-primary" type="button" onClick={() => void copyLink()}>{copied ? <Check size={17}/> : <Copy size={17}/>} {copied ? 'Copied!' : 'Copy invite link'}</button>
          <button className="c4-outline" type="button" onClick={() => void shareLink()}><Share2 size={17}/> Share</button>
        </div>
        <p className="c4-waiting-pulse">Waiting for another player…</p>
      </section>}

      {room.phase !== 'lobby' && <section className="c4-play-layout">
        <div className="c4-card c4-board-panel">
          <div className={`c4-turn-banner ${yourTurn && bothOnline ? 'active' : ''}`} role="status" aria-live="polite" aria-atomic="true">
            {room.phase === 'finished' ? <><Trophy size={21}/><div><strong>{room.draw ? "It's a draw!" : isWinner ? 'You connected four!' : `${opponent?.name || 'Opponent'} wins!`}</strong><span>{room.draw ? 'All 42 spaces are full.' : 'The winning four discs are highlighted below.'}</span></div></>
              : !connected || !bothOnline ? <><WifiOff size={21}/><div><strong>Waiting for reconnection</strong><span>Both players must be online to continue.</span></div></>
              : yourTurn ? <><CircleDot size={21}/><div><strong>Your turn — drop a disc!</strong><span>Tap any non-full column. Your disc drops to the lowest open space.</span></div></>
              : <><RotateCcw size={21}/><div><strong>{opponent?.name || 'Opponent'} is choosing</strong><span>Watch your friend’s next move.</span></div></>}
          </div>
          <div className="c4-board-heading"><span>7 × 6 BOARD</span><span>{room.board.filter(Boolean).length} / 42 moves</span></div>
          <div className="c4-board-wrap">
            <div className="c4-board" role="grid" aria-label="Connect Four board">
              {Array.from({ length: 7 }, (_, column) => {
                const full = room.board[column] !== 0
                return <button key={column} type="button" role="gridcell" className={`c4-column ${canMove && !full ? 'c4-column-enabled' : ''}`} disabled={!canMove || full} aria-label={`Drop in column ${column+1}${full ? ', full' : ''}`} aria-describedby={`c4-column-${column}-contents`} onClick={() => void act('connect4:drop', { column })}>
                  <span className="c4-column-label" aria-hidden="true">{column+1} <span>↓</span></span>
                   <span id={`c4-column-${column}-contents`} className="pg-sr-only">Bottom to top: {Array.from({length:6},(_,row) => room.board[(5-row)*7+column]).map(value => value === 0 ? 'empty' : value === 1 ? 'player one' : 'player two').join(', ')}.</span>
                  {Array.from({ length: 6 }, (_, row) => {
                    const index = row*7+column, owner=room.board[index]
                    const winner = room.winningCells.includes(index), last = room.lastMove?.index === index
                    return <span key={index} aria-hidden="true" className={`c4-slot ${owner ? `c4-slot-${owner}` : 'c4-slot-empty'} ${winner ? 'c4-slot-winning' : ''} ${last ? 'c4-slot-last' : ''}`}><span>{owner || ''}</span></span>
                  })}
                </button>
              })}
            </div>
          </div>
          <p className="c4-board-tip">{room.phase === 'finished' ? 'Ready to play again?' : !bothOnline ? 'Game paused until both players reconnect.' : `Tap a column to drop a disc${lastColumn === undefined || lastColumn === null ? '.' : ` · Last move: column ${lastColumn+1}`}`}</p>
          {room.phase === 'finished' && <div className="c4-rematch">
            <div><strong>{room.draw ? 'Nobody wins this round.' : isWinner ? 'Nice move!' : 'Good game!'}</strong><span>Both players must agree before the next round begins.</span></div>
            <button type="button" className="c4-primary" disabled={busy || !connected || !bothOnline || Boolean(me?.rematchReady)} onClick={() => void act('connect4:rematch', {})}>{me?.rematchReady ? 'Waiting for friend…' : 'Request rematch'}<RotateCcw size={17}/></button>
            {opponent?.rematchReady && <span className="c4-rematch-ready">Your friend is ready for a rematch.</span>}
          </div>}
        </div>
        <aside className="c4-card c4-rules">
          <span className="c4-eyebrow">HOW TO PLAY</span>
          <h3>Connect four first.</h3>
          <p>Take turns dropping discs into the 7-column board. Discs always fall to the lowest open space.</p>
          <p>Connect four of your colour in a horizontal, vertical, or diagonal line to win. A full board without a winner is a draw.</p>
          <div className="c4-rule-badge"><ShieldCheck size={16}/> No timer · No surprise forfeits</div>
          <div className="c4-rule-badge"><Wifi size={16}/> Room stays saved for reconnection</div>
        </aside>
      </section>}
    </main>}
    <footer className="c4-footer">playgrove<span>.</span> <small>Connect Four · Good games, great company</small></footer>
  </div></div>
}
