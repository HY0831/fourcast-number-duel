import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { io, Socket } from 'socket.io-client'
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, Clock3, Copy,
  Crown, Fingerprint, Hash, KeyRound, LockKeyhole, PartyPopper,
  RefreshCw, RotateCcw, Share2, ShieldCheck, Signal, Sparkles,
  Trophy, Users, Wifi, WifiOff, X,
} from 'lucide-react'
import './style.css'
import './theme.css'

type Mode = 'unique' | 'repeat'
type Phase = 'lobby' | 'setup' | 'playing' | 'finished'
type Player = { id: string; name: string; isHost: boolean; online: boolean; ready: boolean; guesses: number }
type Guess = { id: string; by: string; against: string; guess: string; exact: number; at: string; round: number }
type Room = {
  code: string; mode: Mode; phase: Phase; round: number; you: string;
  hostId: string; turnPlayerId: string | null; winnerId: string | null;
  players: Player[]; guesses: Guess[]; revealedSecrets: Record<string,string> | null;
}
type Session = { code: string; token: string }
type JoinResponse = { ok: boolean; error?: string; code?: string; token?: string; room?: Room }
type Ack = { ok: boolean; error?: string }
const SESSION_KEY = 'fourcast:session'
const NAME_KEY = 'fourcast:name'

function getSession(): Session | null {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as Session | null
    if (!saved || typeof saved.code !== 'string' || typeof saved.token !== 'string') return null
    const inviteCode = getInviteCode()
    return inviteCode && inviteCode !== saved.code ? null : saved
  } catch { return null }
}
function getInviteCode() {
  const q = new URLSearchParams(window.location.search).get('room')?.toUpperCase() || ''
  return q.replace(/[^A-Z0-9]/g, '').slice(0, 6)
}
function shareLink(code: string) {
  const url = new URL(window.location.href)
  url.search = `?room=${code}`
  return url.toString()
}
function initials(name: string) { return name.trim().slice(0, 1).toUpperCase() || '?' }
function validDigits(code: string, mode: Mode) {
  return /^\d{4}$/.test(code) && (mode === 'repeat' || new Set(code).size === 4)
}
function countText(n: number) { return n === 1 ? '1 correct position' : `${n} correct positions` }

function Logo({ small = false }: { small?: boolean }) {
  return <div className={'brand' + (small ? ' brand-small' : '')}>
    <div className="brand-icon" aria-hidden="true"><span /><span /><span /><span /></div>
    <span>fourcast<span className="brand-period">.</span></span>
  </div>
}

function ModeChoice({ value, selected, onClick, compact = false, disabled = false }: {
  value: Mode; selected: boolean; onClick: () => void; compact?: boolean; disabled?: boolean;
}) {
  const repeat = value === 'repeat'
  return <button type="button" disabled={disabled} className={`mode-choice ${selected ? 'selected' : ''} ${compact ? 'compact' : ''}`} onClick={onClick}>
    <div className="mode-choice-top"><span className={`mode-symbol ${repeat ? 'lilac' : 'mint'}`}>{repeat ? <RefreshCw size={18} /> : <Fingerprint size={18} />}</span>
      <span className="mode-select">{selected ? <CheckCircle2 size={20} /> : <span className="empty-radio" />}</span></div>
    <strong>{repeat ? 'Repeatable' : 'No repeats'}</strong>
    <span>{repeat ? 'Digits may repeat, like 1133.' : 'Every digit must be different.'}</span>
    <span className="mode-example">{repeat ? 'e.g. 8 8 2 8' : 'e.g. 3 9 1 6'}</span>
  </button>
}

function CodeSlots({ code, mode, error = false }: { code: string; mode: Mode; error?: boolean }) {
  return <div className={'code-slots' + (error ? ' code-error' : '')} role="status" aria-label={`${code.length} out of 4 digits entered`}>
    {Array.from({ length: 4 }, (_, index) => <span key={index} className={`code-slot ${code[index] ? 'filled' : ''} ${!code[index] && code.length === index ? 'cursor-slot' : ''}`}>{code[index] || '·'}</span>)}
    <span className="sr-only">{mode === 'repeat' ? 'Repeated digits allowed' : 'No repeated digits allowed'}</span>
  </div>
}

function Keypad({ code, setCode, mode, disabled = false }: { code: string; setCode: (value: string) => void; mode: Mode; disabled?: boolean }) {
  const press = (key: string) => {
    if (disabled) return
    if (key === 'back') { setCode(code.slice(0, -1)); return }
    if (code.length === 4 || (mode === 'unique' && code.includes(key))) return
    setCode(code + key)
  }
  return <div className="keypad" role="group" aria-label="Number keypad">
    {['1','2','3','4','5','6','7','8','9','clear','0','back'].map((key) => <button key={key} type="button"
      aria-label={key === 'back' ? 'Delete last digit' : key === 'clear' ? 'Clear digits' : `Digit ${key}`}
      className={`key ${key === 'back' || key === 'clear' ? 'key-soft' : ''}`} disabled={disabled}
      onClick={() => key === 'clear' ? setCode('') : press(key)}>
      {key === 'back' ? <ArrowLeft size={22} /> : key === 'clear' ? <span className="key-clear">Clear</span> : key}
    </button>)}
  </div>
}

function Avatar({ player, size = 'regular' }: { player: Player; size?: 'regular' | 'large' }) {
  return <div className={`avatar ${size === 'large' ? 'avatar-large' : ''} ${player.isHost ? 'avatar-primary' : 'avatar-secondary'}`}>{initials(player.name)}</div>
}

function App() {
  const [connected, setConnected] = useState(false)
  const [room, setRoom] = useState<Room | null>(null)
  const sessionRef = useRef<Session | null>(getSession())
  const socketRef = useRef<Socket | null>(null)
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || '')
  const [mode, setMode] = useState<Mode>('unique')
  const [tab, setTab] = useState<'create' | 'join'>(() => getInviteCode() ? 'join' : 'create')
  const [joinCode, setJoinCode] = useState(getInviteCode)
  const [digits, setDigits] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [historyAll, setHistoryAll] = useState(false)

  useEffect(() => {
    const socket = io({ reconnection: true, reconnectionDelay: 500, timeout: 10000 })
    socketRef.current = socket
    const resume = async () => {
      setConnected(true)
      const saved = sessionRef.current
      if (!saved) return
      socket.timeout(8000).emit('room:resume', saved, (err: Error | null, res: JoinResponse) => {
        if (err) { setError('Could not reconnect. Check your internet connection.'); return }
        if (res?.ok && res.room) { setRoom(res.room); setError('') }
        else {
          localStorage.removeItem(SESSION_KEY)
          sessionRef.current = null
          setRoom(null)
          setError(res?.error || 'That room is no longer available.')
        }
      })
    }
    socket.on('connect', resume)
    socket.on('disconnect', () => setConnected(false))
    socket.on('room:update', (next: Room) => { setRoom(next); setError('') })
    socket.on('connect_error', () => setError('Cannot reach the game server. Please try again.'))
    return () => { socket.disconnect(); socketRef.current = null }
  }, [])

  useEffect(() => { setDigits(''); setHistoryAll(false) }, [room?.phase, room?.round])
  useEffect(() => {
    if (!room || room.mode === 'repeat' || new Set(digits).size === digits.length) return
    setDigits('')
  }, [room?.mode])

  const self = room?.players.find(p => p.id === room.you)
  const opponent = room?.players.find(p => p.id !== room.you)
  const isTurn = room?.phase === 'playing' && room.turnPlayerId === room.you
  const bothOnline = room?.players.every(p => p.online) || false
  const latest = room?.guesses.at(-1)
  const visibleGuesses = useMemo(() => {
    if (!room) return []
    return historyAll ? [...room.guesses].reverse() : [...room.guesses].reverse().slice(0, 6)
  }, [room, historyAll])

  async function request<T extends Ack>(event: string, payload: unknown): Promise<T> {
    const socket = socketRef.current
    if (!socket?.connected) throw new Error('No server connection. Check your internet connection.')
    return new Promise((resolve, reject) => {
      socket.timeout(9000).emit(event, payload, (err: Error | null, response: T) => {
        if (err) return reject(new Error('Request timed out. Check your connection.'))
        if (!response?.ok) return reject(new Error(response?.error || 'Request failed.'))
        resolve(response)
      })
    })
  }

  async function act(event: string, payload: unknown, onSuccess?: (result: Ack) => void) {
    setBusy(true)
    setError('')
    try { const result = await request(event, payload); onSuccess?.(result) }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.') }
    finally { setBusy(false) }
  }

  const joinOrCreate = async () => {
    const clean = name.trim()
    if (clean.length < 2 || clean.length > 20) { setError('Enter a name between 2 and 20 characters.'); return }
    if (tab === 'join' && joinCode.length !== 6) { setError('Enter the 6-character room code.'); return }
    await act(tab === 'create' ? 'room:create' : 'room:join', tab === 'create' ? { name: clean, mode } : { name: clean, code: joinCode }, (res) => {
      const data = res as JoinResponse
      if (!data.code || !data.token || !data.room) return
      const saved = { code: data.code, token: data.token }
      localStorage.setItem(SESSION_KEY, JSON.stringify(saved))
      localStorage.setItem(NAME_KEY, clean)
      sessionRef.current = saved
      setRoom(data.room)
      history.replaceState(null, '', window.location.pathname)
    })
  }

  const leave = async () => {
    try { await request('room:leave', {}) } catch { /* local leave is still allowed */ }
    localStorage.removeItem(SESSION_KEY)
    sessionRef.current = null
    setRoom(null)
    setDigits('')
    setError('')
  }

  const copy = async () => {
    if (!room) return
    try {
      const invite = shareLink(room.code)
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(invite)
      else {
        const field = document.createElement('textarea')
        field.value = invite
        field.style.position = 'fixed'
        field.style.opacity = '0'
        document.body.appendChild(field)
        field.select()
        const worked = document.execCommand('copy')
        field.remove()
        if (!worked) throw new Error('Clipboard unavailable')
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { setError('Could not copy. Share the room code instead.') }
  }
  const share = async () => {
    if (!room) return
    if (navigator.share) {
      try { await navigator.share({ title: 'Join my Fourcast game', text: `Join my number duel. Room: ${room.code}`, url: shareLink(room.code) }) }
      catch { /* cancelled share */ }
    } else await copy()
  }

  const gameInput = (next: string) => {
    if (/^\d{0,4}$/.test(next)) setDigits(next)
    if (error) setError('')
  }

  return <div className="app-shell">
    <div className="ambient ambient-a" /><div className="ambient ambient-b" />
    <div className="app-frame">
      <header className="topbar">
        <Logo small />
        <div className="topbar-actions">
          <span className={`connection ${connected ? 'connection-live' : ''}`}><span className="connection-dot" />{connected ? 'Online' : 'Offline'}</span>
          {room && <button type="button" onClick={leave} className="topbar-exit" title="Leave room"><X size={18} /><span>Exit</span></button>}
        </div>
      </header>
      {error && <div className="alert" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={17} /></button></div>}

      {!room && <main className="home-layout">
        <section className="hero"><div className="eyebrow"><Sparkles size={15} /> THE LITTLE GAME OF BIG GUESSES</div>
          <h1>Crack the code.<br /><span>Claim the win.</span></h1>
          <p>A four-digit mind game for two. Make a secret number, take turns guessing, and be the first to get all four in the right spot.</p>
          <div className="hero-perks"><span><Users size={16} /> 2 players</span><span><Wifi size={16} /> Real-time</span><span><LockKeyhole size={16} /> Private rooms</span></div>
          <div className="hero-decoration" aria-hidden="true"><div className="floating-code"><span>0</span><span>4</span><span>2</span><span>9</span></div><div className="sparkle-one">✳</div><div className="sparkle-two">✦</div><div className="small-orbit" /></div>
        </section>
        <section className="panel home-panel">
          <div className="tabs"><button className={tab === 'create' ? 'active' : ''} onClick={() => { setTab('create'); setError('') }}>Create room</button><button className={tab === 'join' ? 'active' : ''} onClick={() => { setTab('join'); setError('') }}>Join room</button></div>
          <div className="panel-body">
            <div className="panel-heading"><span className="step-label">{tab === 'create' ? 'START A NEW GAME' : 'JOIN A FRIEND'}</span><h2>{tab === 'create' ? 'Set up your duel' : 'Got an invite code?'}</h2><p>{tab === 'create' ? 'Choose your rules, then invite someone to play.' : 'Enter your name and the room code your friend shared.'}</p></div>
            <label className="field-label" htmlFor="player-name">YOUR NICKNAME</label>
            <input id="player-name" className="text-input" placeholder="e.g. Alex" autoComplete="nickname" value={name} maxLength={20} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && joinOrCreate()} />
            {tab === 'create' ? <><div className="field-label row-heading">GAME RULES <span>Choose one</span></div><div className="mode-grid"><ModeChoice value="unique" selected={mode === 'unique'} onClick={() => setMode('unique')} /><ModeChoice value="repeat" selected={mode === 'repeat'} onClick={() => setMode('repeat')} /></div></> : <><label className="field-label field-spaced" htmlFor="join-code">6-CHARACTER ROOM CODE</label><input id="join-code" className="text-input room-code-input" placeholder="ABC123" maxLength={6} autoCapitalize="characters" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6))} onKeyDown={e => e.key === 'Enter' && joinOrCreate()} /><p className="small-hint">Your friend can send you a code or an invite link.</p></>}
            <button className="primary-btn main-cta" onClick={joinOrCreate} disabled={busy || !connected}>{busy ? 'Connecting...' : tab === 'create' ? 'Create game room' : 'Join game room'}<ArrowRight size={19} /></button>
          </div>
        </section>
      </main>}

      {room && <main className="game-layout">
        <div className="room-subhead"><div><span className="step-label">ROOM {room.code} <span className="round-pill">ROUND {room.round}</span></span><h1>{room.phase === 'lobby' ? 'Waiting for a rival.' : room.phase === 'setup' ? 'Pick your secret.' : room.phase === 'playing' ? 'The duel is on.' : 'Game over!'}</h1></div><span className="mode-tag">{room.mode === 'unique' ? <Fingerprint size={15} /> : <RefreshCw size={15} />}{room.mode === 'unique' ? 'No repeats' : 'Repeatable'}</span></div>
        <div className="players-row">{room.players.map((player, index) => <React.Fragment key={player.id}>
          {index > 0 && <div className="versus">VS</div>}
          <div className={`player-chip ${player.id === room.turnPlayerId ? 'player-active' : ''}`}><Avatar player={player} /><div><strong>{player.id === room.you ? 'You' : player.name}</strong><span>{room.phase === 'setup' ? player.ready ? 'Code locked' : 'Choosing code' : room.phase === 'playing' ? player.id === room.turnPlayerId ? 'Guessing now' : 'Waiting' : player.isHost ? 'Host' : 'Player 2'}</span></div>{room.phase === 'setup' && player.ready && <CheckCircle2 className="chip-check" size={18} />}{!player.online && <span className="offline-tag">Offline</span>}</div>
        </React.Fragment>)}{room.players.length === 1 && <><span className="versus">VS</span><div className="player-chip player-empty"><div className="avatar ghost"><Users size={19} /></div><div><strong>Player 2</strong><span>Waiting to join</span></div></div></>}</div>

        {room.phase === 'lobby' && <section className="game-card lobby-card"><div className="big-icon lilac-bg"><Users size={29} /></div><h2>Better with a friend</h2><p>Invite one friend to join your private game room. The game starts once both players choose their secret number.</p><div className="room-code-label">YOUR ROOM CODE</div><div className="invite-code">{room.code.split('').map((char, idx) => <span key={idx}>{char}</span>)}</div><div className="invite-actions"><button className="primary-btn" onClick={copy}>{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? 'Link copied!' : 'Copy invite link'}</button><button className="outline-btn" onClick={share}><Share2 size={18} />Share</button></div><div className="waiting-line"><span className="waiting-pulse" /> Waiting for another player to join...</div><div className="lobby-mode"><div><span className="field-label">GAME MODE</span><strong>{room.mode === 'unique' ? 'No repeats' : 'Repeatable digits'}</strong></div><div className="lobby-mode-actions"><button className={room.mode === 'unique' ? 'on' : ''} onClick={() => act('room:mode', { mode: 'unique' })} disabled={busy}>Unique</button><button className={room.mode === 'repeat' ? 'on' : ''} onClick={() => act('room:mode', { mode: 'repeat' })} disabled={busy}>Repeat</button></div></div></section>}

        {room.phase === 'setup' && <section className="game-card play-card"><div className="center-heading"><div className="big-icon mint-bg"><LockKeyhole size={26} /></div><h2>{self?.ready ? 'Your code is locked!' : 'Set your secret number'}</h2><p>{self?.ready ? 'Your opponent cannot see it. The duel begins when both players are ready.' : room.mode === 'unique' ? 'Choose four different digits. Keep them secret!' : 'Choose four digits. Repeated numbers are allowed!'}</p></div>
          {!self?.ready ? <><div className="mini-label">YOUR SECRET CODE</div><CodeSlots code={digits} mode={room.mode} /><div className="code-hint"><ShieldCheck size={15} /> Your number is hidden from your opponent</div><div className="keypad-wrap"><Keypad code={digits} setCode={gameInput} mode={room.mode} disabled={busy} /></div><button className="primary-btn submit-btn" disabled={!validDigits(digits, room.mode) || busy || !connected} onClick={() => act('room:secret', {code: digits}, () => setDigits(''))}>Lock my secret number <LockKeyhole size={18} /></button></> : <><div className="success-check"><Check size={40} /></div><div className="waiting-line"><span className="waiting-pulse" /> Waiting for your opponent to lock their code...</div></>}
          {self?.isHost && room.players.every(p => !p.ready) && <div className="change-mode"><span>Change mode</span><button onClick={() => act('room:mode', { mode: room.mode === 'unique' ? 'repeat' : 'unique' })} disabled={busy}>{room.mode === 'unique' ? 'Switch to repeatable' : 'Switch to no repeats'}<ChevronRight size={16}/></button></div>}</section>}

        {room.phase === 'playing' && <div className="play-columns"><section className="game-card play-card"><div className={`turn-banner ${isTurn && bothOnline ? 'your-turn' : 'other-turn'}`}><span className="turn-banner-icon">{!bothOnline ? <WifiOff size={19} /> : isTurn ? <Sparkles size={19} /> : <Clock3 size={19}/>}</span><div><strong>{!bothOnline ? 'Waiting for reconnection' : isTurn ? 'Your turn to guess!' : `${opponent?.name || 'Opponent'} is guessing`}</strong><span>{!bothOnline ? 'The game will resume when both are online.' : isTurn ? `Try to crack ${opponent?.name || 'their'}'s secret code` : 'Your turn is coming up next.'}</span></div></div><div className="mini-label">{isTurn ? 'YOUR GUESS' : 'NEXT GUESS'}</div><CodeSlots code={digits} mode={room.mode} /><div className="guess-helper">{room.mode === 'unique' ? 'Each digit can only be used once.' : 'You can repeat digits.'} Only exact positions count.</div><div className="keypad-wrap"><Keypad code={digits} setCode={gameInput} mode={room.mode} disabled={!isTurn || !bothOnline || busy} /></div><button className="primary-btn submit-btn" onClick={() => act('room:guess', { guess: digits }, () => setDigits(''))} disabled={!isTurn || !bothOnline || !validDigits(digits, room.mode) || busy || !connected}>Submit guess <ArrowRight size={19} /></button>{latest && <div className="last-result"><div className="last-result-icon"><Hash size={18}/></div><div><span>LATEST GUESS</span><strong>{latest.guess.split('').join(' ')}</strong></div><div className="exact-counter"><strong>{latest.exact}<span>/4</span></strong><span>correct</span></div></div>}</section><section className="side-content"><div className="game-card history-card"><div className="side-heading"><div><span className="step-label">THE GAME SO FAR</span><h3>Guess history</h3></div><span className="count-bubble">{room.guesses.length}</span></div>{room.guesses.length ? <><div className="guess-list">{visibleGuesses.map((guess) => <div className="guess-row" key={guess.id}><div className={`guess-player-dot ${guess.by === room.you ? 'dot-you' : 'dot-them'}`}>{initials(room.players.find(p => p.id === guess.by)?.name || '?')}</div><div className="guess-details"><span>{guess.by === room.you ? 'You' : room.players.find(p => p.id === guess.by)?.name}</span><strong>{guess.guess.split('').join('  ')}</strong></div><div className={`guess-exact ${guess.exact > 0 ? 'has-match' : ''}`}><strong>{guess.exact}/4</strong><small>correct</small></div></div>)}</div>{room.guesses.length > 6 && <button className="view-all" onClick={() => setHistoryAll(!historyAll)}>{historyAll ? 'Show less' : `View all ${room.guesses.length} guesses`}<ChevronRight size={15} /></button>}</> : <div className="history-empty"><div><Hash size={23}/></div><strong>No guesses yet</strong><span>The first guess will appear here.</span></div>}</div><div className="tips-card"><div><ShieldCheck size={19} /><strong>A little reminder</strong></div><p>Only the right digit in the right position counts. We won't tell you which digits are correct!</p></div></section></div>}

        {room.phase === 'finished' && <section className="game-card result-card"><div className={`winner-emblem ${room.winnerId === room.you ? 'you-won' : ''}`}>{room.winnerId === room.you ? <Trophy size={42} /> : <PartyPopper size={42} />}</div><span className="step-label">ROUND {room.round} COMPLETE</span><h2>{room.winnerId === room.you ? 'You cracked it!' : `${room.players.find(p => p.id === room.winnerId)?.name || 'Opponent'} wins!`}</h2><p>{room.winnerId === room.you ? 'Four digits. Four perfect positions. Nicely played.' : 'The code has been cracked. Ready for another round?'}</p><div className="reveal-panel"><span className="mini-label">SECRET NUMBERS REVEALED</span>{room.players.map(player => <div key={player.id} className="reveal-row"><div><Avatar player={player} /><strong>{player.id === room.you ? 'Your code' : `${player.name}'s code`}</strong></div><span>{room.revealedSecrets?.[player.id]?.split('').join(' ') || '—'}</span></div>)}</div><div className="result-stats"><div><strong>{room.guesses.filter(g => g.by === room.you).length}</strong><span>Your guesses</span></div><div><strong>{room.guesses.filter(g => g.by !== room.you).length}</strong><span>Their guesses</span></div></div>{self?.isHost ? <button className="primary-btn submit-btn" disabled={busy || !connected} onClick={() => act('room:rematch', {})}>Play another round <RotateCcw size={19} /></button> : <div className="waiting-line"><span className="waiting-pulse" /> Waiting for the host to start the next round...</div>}</section>}
        <footer className="game-footer"><LockKeyhole size={15} /> Private room <span>·</span> Codes stay secret until the round ends</footer>
      </main>}

      <footer className="site-footer"><span>Made for little rivalries & big brain moments.</span><span>fourcast © 2026</span></footer>
    </div>
  </div>
}

createRoot(document.getElementById('root')!).render(<App />)