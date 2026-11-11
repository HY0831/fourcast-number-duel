import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronLeft, Crown, Gamepad2, Move, RotateCcw, Sparkles, Trophy, Undo2 } from 'lucide-react'
import { createGame, moveGame, continueAfterWin, maximumTile, restoreGame, type Direction, type Game } from './engine.mjs'
import './twenty48.css'

type Props = { onBack: () => void }
type PlayState = { game: Game; undo: Game | null }
const SAVE_KEY = 'playgrove:2048:v1'
const BEST_KEY = 'playgrove:2048:best'
const INITIAL: () => PlayState = () => ({game:createGame(),undo:null})

function getSaved(): PlayState {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') as { game?: unknown; undo?: unknown } | null
    const game = restoreGame(saved?.game)
    if (game) return {game,undo:restoreGame(saved?.undo)}
  } catch { /* blocked or invalid browser storage; use a fresh puzzle */ }
  return INITIAL()
}
function readBest() {
  try {
    const stored = Number(localStorage.getItem(BEST_KEY) || '0')
    return Number.isSafeInteger(stored) && stored >= 0 ? stored : 0
  } catch { return 0 }
}
const scoreText = (score: number) => score.toLocaleString('en-US')

export default function Twenty48Page({ onBack }: Props) {
  const [state, setState] = useState<PlayState>(getSaved)
  const [best, setBest] = useState(readBest)
  const [notice, setNotice] = useState('')
  const touch = useRef<{ x: number; y: number } | null>(null)
  const { game, undo } = state
  const topTile = maximumTile(game.board)
  const empty = game.board.filter(n => n === 0).length

  useEffect(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)) } catch { /* local storage may be disabled */ }
  }, [state])
  useEffect(() => {
    if (game.score > best) {
      setBest(game.score)
      try { localStorage.setItem(BEST_KEY, String(game.score)) } catch { /* optional */ }
    }
  }, [game.score, best])

  const slide = useCallback((direction: Direction) => {
    setState(previous => {
      const moved = moveGame(previous.game, direction)
      if (!moved.moved) return previous
      return { game: moved.game, undo: { ...previous.game, board: [...previous.game.board], spawnIndex: null } }
    })
    setNotice('')
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable || target?.closest('input, textarea, select, button, [role="button"]')) return
      // Arrow shortcuts apply to the board, never to modal/finished states.
      if (game.status !== 'playing') return
      const arrow: Record<string, Direction> = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right' }
      if (arrow[event.key]) { event.preventDefault(); slide(arrow[event.key]); }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slide, game.status])

  function undoMove() {
    if (!undo) return
    setState({ game: { ...undo, board: [...undo.board], spawnIndex:null }, undo: null })
    setNotice('Last move undone.')
  }
  function startNew() {
    if (game.status === 'playing' && game.moves > 0 && !window.confirm('Start a new 2048 game? Your current board will be replaced.')) return
    setState(INITIAL())
    setNotice('Fresh board. Good luck!')
  }
  function handleTouchEnd(event: React.TouchEvent<HTMLElement>) {
    if (!touch.current || !event.changedTouches[0]) return
    const dx = event.changedTouches[0].clientX - touch.current.x
    const dy = event.changedTouches[0].clientY - touch.current.y
    touch.current = null
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
    slide(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'))
  }
  const overlay = game.status === 'won' || game.status === 'lost'

  return <div className="t48-shell">
    <div className="t48-frame">
      <header className="t48-header">
        <button type="button" className="t48-brand" onClick={onBack} aria-label="Back to Playgrove Game Library"><span><Gamepad2 size={21}/></span> playgrove<b>.</b></button>
        <button type="button" className="t48-back" onClick={onBack}><ChevronLeft size={18}/> All games</button>
      </header>
      <main className="t48-main">
        <div className="t48-intro">
          <div>
            <span className="t48-kicker"><Sparkles size={15}/> THE SLIDING NUMBER PUZZLE</span>
            <h1>2048<span>.</span></h1>
            <p>Swipe the tiles. Combine matching numbers. Reach 2048 and go beyond.</p>
            <div className="t48-tags"><span>Solo challenge</span><span>Play at your pace</span><span>Saves on this device</span></div>
          </div>
          <div className="t48-hero-tile" aria-hidden="true"><strong>2</strong><strong>0</strong><strong>4</strong><strong>8</strong></div>
        </div>
        <div className="t48-workspace">
          <section className="t48-play-panel" aria-label="2048 game">
            <div className="t48-dashboard">
              <div className="t48-stat"><span>SCORE</span><strong aria-label="Current score" data-testid="2048-score">{scoreText(game.score)}</strong></div>
              <div className="t48-stat t48-best"><span><Trophy size={14}/> BEST</span><strong aria-label="Best score">{scoreText(Math.max(best, game.score))}</strong></div>
              <div className="t48-stat t48-max"><span>TOP TILE</span><strong aria-label="Highest tile">{scoreText(topTile)}</strong></div>
            </div>
            <div className="t48-board-wrap">
              <div className="t48-board" role="grid" aria-label="2048 4 by 4 board" aria-describedby="t48-keyboard-help" tabIndex={0}
                onTouchStart={event => { if (event.touches[0]) touch.current = { x:event.touches[0].clientX, y:event.touches[0].clientY } }}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={() => { touch.current = null }}>
                {game.board.map((n, index) => <div key={index} role="gridcell" aria-label={`Row ${Math.floor(index/4)+1} column ${index%4+1}: ${n || 'empty'}`}
                  data-value={n} data-testid={`tile-${index}`} className={`t48-tile ${n > 2048?'t48-super':''} ${n !== 0 && index === game.spawnIndex ? 't48-spawn':''}`}>
                  {n || ''}
                </div>)}
              </div>
              {overlay && <div className={`t48-overlay ${game.status==='won'?'t48-victory':'t48-loss'}`} role="status" aria-live="polite">
                <div className="t48-overlay-icon">{game.status==='won'?<Crown size={36}/>:<RotateCcw size={34}/>}</div>
                <h2>{game.status==='won'?'You made 2048!':'No moves left.'}</h2>
                <p>{game.status==='won'?'Congratulations! Keep playing for an even higher score or try a new board.':'Nice try! Start a new game to beat your best score.'}</p>
                <div className="t48-overlay-buttons">
                  {game.status === 'won' && <button type="button" className="t48-btn-primary" onClick={() => { setState(prev=>({ ...prev, game:continueAfterWin(prev.game) }));setNotice('Keep it going!') }}>Keep playing <ArrowRight size={17}/></button>}
                  <button type="button" className="t48-btn-secondary" onClick={startNew}>New game <RotateCcw size={16}/></button>
                </div>
              </div>}
            </div>
            <p id="t48-keyboard-help" className="pg-sr-only">Use arrow keys when the board is focused, swipe on a touch screen, or use the four movement buttons. Press Tab to reach other controls.</p>
            <div className="pg-sr-only" role="status" aria-live="polite" aria-atomic="true">{game.moves ? `Move ${game.moves}; score ${game.score}; highest tile ${topTile}.` : 'New game ready.'}</div>
            <div className="t48-control-header"><span><Move size={17}/> Swipe on the board, or use arrow keys</span><span>{game.moves} moves · {empty} spaces</span></div>
            <div className="t48-direction-pad" role="group" aria-label="Move tiles">
              <button type="button" aria-label="Move left" disabled={overlay} onClick={()=>slide('left')}><ArrowLeft size={22}/></button>
              <button type="button" aria-label="Move up" disabled={overlay} onClick={()=>slide('up')}><ArrowUp size={22}/></button>
              <button type="button" aria-label="Move down" disabled={overlay} onClick={()=>slide('down')}><ArrowDown size={22}/></button>
              <button type="button" aria-label="Move right" disabled={overlay} onClick={()=>slide('right')}><ArrowRight size={22}/></button>
            </div>
            {notice && <div className="t48-notice" role="status"><Check size={15}/>{notice}</div>}
          </section>
          <aside className="t48-side">
            <div className="t48-guide-card">
              <span className="t48-kicker">HOW TO PLAY</span>
              <h2>Small moves. Big numbers.</h2>
              <div className="t48-instruction"><span className="t48-instruction-number">01</span><div><strong>Swipe to slide</strong><p>Move all tiles up, down, left or right using your keyboard, swipe or the buttons.</p></div></div>
              <div className="t48-instruction"><span className="t48-instruction-number">02</span><div><strong>Combine matching tiles</strong><p>Two matching numbers merge into one larger tile. Each merge adds its value to your score.</p></div></div>
              <div className="t48-instruction"><span className="t48-instruction-number">03</span><div><strong>Reach 2048</strong><p>One new tile appears after each valid move. Plan ahead to avoid running out of space.</p></div></div>
            </div>
            <div className="t48-action-card">
              <span className="t48-kicker">YOUR GAME</span>
              <h3>A second chance?</h3>
              <p>Undo your last move, or begin a new challenge. Your best score stays saved.</p>
              <div className="t48-actions">
                <button type="button" onClick={undoMove} disabled={!undo} aria-label="Undo last move"><Undo2 size={17}/> Undo move</button>
                <button type="button" onClick={startNew}><RotateCcw size={17}/> New game</button>
              </div>
            </div>
            <div className="t48-tip"><Sparkles size={19}/><div><strong>Little tip</strong><p>Try to keep your highest tile near a corner while you combine the smaller ones.</p></div></div>
          </aside>
        </div>
      </main>
      <footer className="t48-footer"><span>playgrove.</span> One move closer to 2048.</footer>
    </div>
  </div>
}
