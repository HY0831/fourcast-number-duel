import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { ArrowLeft, Bomb, CheckCircle2, Clock3, Flag, Gamepad2, Minus, Pause, Play, Plus, RotateCcw, ShieldCheck, Sparkles, Trophy, X } from 'lucide-react'
import {
  MINESWEEPER_LEVELS, createMinesweeper, restoreMinesweeper,
  revealCell, flagCell, countFlags, revealedSafeCount,
  type MineLevel, type MineState,
} from './minesweeper-engine.mjs'
import './minesweeper.css'

type Props = { onBack: () => void }
type ClickMode = 'reveal' | 'flag'
type Zoom = 'compact' | 'regular' | 'large'

const LEVELS: MineLevel[] = ['easy', 'medium', 'hard']
const STORAGE = 'playgrove:minesweeper:v1:'
const LAST_LEVEL = STORAGE + 'last-level'
const BEST = STORAGE + 'best:'
const ZOOMS: Zoom[] = ['compact', 'regular', 'large']
const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

function savedLevel(): MineLevel {
  try {
    const level = localStorage.getItem(LAST_LEVEL)
    return LEVELS.includes(level as MineLevel) ? level as MineLevel : 'easy'
  } catch { return 'easy' }
}

function loadGame(level: MineLevel): MineState {
  try {
    const value = localStorage.getItem(STORAGE + level)
    return value ? restoreMinesweeper(JSON.parse(value) as unknown, level) : createMinesweeper(level)
  } catch { return createMinesweeper(level) }
}

function loadBest(level: MineLevel): number | null {
  try {
    const value = localStorage.getItem(BEST + level)
    const n = value === null ? NaN : Number(value)
    return Number.isInteger(n) && n >= 0 ? n : null
  } catch { return null }
}

function describeCell(game: MineState, index: number): string {
  const row = Math.floor(index / game.cols) + 1
  const col = index % game.cols + 1
  const value = game.field?.[index]
  const isShownMine = game.status === 'lost' && value === -1
  const wrongFlag = game.status === 'lost' && game.flags[index] && value !== -1
  let description = 'covered'
  if (wrongFlag) description = 'incorrect flag'
  else if (game.flags[index]) description = 'flagged'
  else if (isShownMine) description = game.explodedIndex === index ? 'exploded mine' : 'mine'
  else if (game.revealed[index]) description = value === 0 ? 'empty revealed' : `revealed ${value}`
  return `Row ${row}, column ${col}: ${description}`
}

export default function MinesweeperPage({ onBack }: Props) {
  const [game, setGame] = useState<MineState>(() => loadGame(savedLevel()))
  const [paused, setPaused] = useState(false)
  const [mode, setMode] = useState<ClickMode>('reveal')
  const [zoom, setZoom] = useState<Zoom>('regular')
  const [best, setBest] = useState<number | null>(() => loadBest(savedLevel()))
  const boardRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([])
  const config = MINESWEEPER_LEVELS[game.level]
  const opened = revealedSafeCount(game)
  const safeTotal = game.rows * game.cols - game.mines
  const flags = countFlags(game)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE + game.level, JSON.stringify(game))
      localStorage.setItem(LAST_LEVEL, game.level)
    } catch { /* Game is still playable without local persistence. */ }
  }, [game])

  useEffect(() => {
    if (game.status !== 'playing' || paused) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setGame(current => current.status === 'playing' ? { ...current, seconds: current.seconds + 1 } : current)
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [game.status, paused])

  useEffect(() => {
    if (game.status !== 'won') return
    const previousBest = loadBest(game.level)
    if (previousBest === null || game.seconds < previousBest) {
      try { localStorage.setItem(BEST + game.level, String(game.seconds)) } catch { /* optional */ }
      setBest(game.seconds)
    } else setBest(previousBest)
  }, [game.status, game.seconds, game.level])

  const changeLevel = (level: MineLevel) => {
    if (level === game.level) return
    setGame(loadGame(level))
    setBest(loadBest(level))
    setPaused(false)
    setMode('reveal')
    setZoom('regular')
    boardRef.current?.scrollTo({ top: 0, left: 0 })
  }

  const resetGame = () => {
    if ((game.status === 'playing' || game.revealed.some(Boolean) || flags > 0) &&
        game.status !== 'won' && game.status !== 'lost' &&
        !window.confirm('Start a new Minesweeper game? Your current progress will be replaced.')) return
    setGame(createMinesweeper(game.level))
    setPaused(false)
    setMode('reveal')
    boardRef.current?.scrollTo({ top: 0, left: 0 })
  }

  const actOnCell = (index: number, action: ClickMode = mode) => {
    if (paused || game.status === 'won' || game.status === 'lost') return
    setGame(current => action === 'flag' ? flagCell(current, index) : revealCell(current, index))
  }

  const onContextMenu = (event: MouseEvent<HTMLButtonElement>, index: number) => {
    event.preventDefault()
    actOnCell(index, 'flag')
  }

  const onCellKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key.toLowerCase() === 'f') {
      event.preventDefault()
      actOnCell(index, 'flag')
      return
    }
    const steps: Record<string, number> = {
      ArrowLeft: index % game.cols > 0 ? index - 1 : index,
      ArrowRight: index % game.cols < game.cols - 1 ? index + 1 : index,
      ArrowUp: Math.max(0, index - game.cols),
      ArrowDown: Math.min(game.rows * game.cols - 1, index + game.cols),
    }
    if (Object.hasOwn(steps, event.key)) {
      event.preventDefault()
      cellRefs.current[steps[event.key]]?.focus()
    }
  }

  const changeZoom = (direction: -1 | 1) => {
    setZoom(current => ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(current) + direction))])
  }

  return <div className="msw-shell">
    <div className="msw-frame">
      <header className="msw-header">
        <button className="msw-brand" type="button" onClick={onBack} aria-label="Back to Playgrove Game Library">
          <span className="msw-brand-icon"><Gamepad2 size={20}/></span>playgrove<b>.</b>
        </button>
        <button className="msw-back" type="button" onClick={onBack}><ArrowLeft size={17}/> All games</button>
      </header>

      <main className="msw-main">
        <div className="msw-intro">
          <div><span className="msw-eyebrow"><Sparkles size={15}/> A LITTLE FIELD OF MYSTERY</span>
            <h1>Minesweeper<span>.</span></h1>
            <p>Reveal safe squares, use the numbers as clues, and mark the mines before they find you.</p>
          </div>
          <span className="msw-intro-badge"><ShieldCheck size={17}/> Your first reveal is safe</span>
        </div>

        <section className="msw-level-section" aria-label="Choose Minesweeper difficulty">
          <div className="msw-section-title"><h2>Choose your level</h2><span>Play at your own pace</span></div>
          <div className="msw-level-grid">{LEVELS.map(level => {
            const meta = MINESWEEPER_LEVELS[level]
            return <button type="button" key={level} aria-pressed={game.level === level}
              aria-label={`${meta.label}, ${meta.cols} by ${meta.rows}, ${meta.mines} mines`}
              className={`msw-level ${game.level === level ? 'msw-level-current' : ''}`}
              onClick={() => changeLevel(level)}>
              <strong>{meta.label}</strong><small>{meta.cols} × {meta.rows} · {meta.mines} mines</small>
              {game.level === level && <CheckCircle2 size={17} className="msw-level-check"/>}
            </button>
          })}</div>
        </section>

        <section className="msw-workspace" aria-label="Minesweeper game">
          <div className="msw-board-panel">
            <div className="msw-hud">
              <div className="msw-stat"><Flag size={19}/><div><small>MINES LEFT</small><strong aria-label="Estimated mines left">{game.mines - flags}</strong></div></div>
              <div className="msw-stat"><Clock3 size={19}/><div><small>TIME</small><strong aria-label="Elapsed time">{formatTime(game.seconds)}</strong></div></div>
              <div className="msw-stat"><ShieldCheck size={19}/><div><small>SAFE REVEALED</small><strong>{opened}/{safeTotal}</strong></div></div>
            </div>

            <div className="msw-actions-bar">
              <div className="msw-mode" role="group" aria-label="Board action mode">
                <button type="button" aria-pressed={mode === 'reveal'} className={mode === 'reveal' ? 'msw-mode-active' : ''} onClick={() => setMode('reveal')}>Reveal</button>
                <button type="button" aria-pressed={mode === 'flag'} className={mode === 'flag' ? 'msw-mode-active' : ''} onClick={() => setMode('flag')}><Flag size={15}/> Flag</button>
              </div>
              <div className="msw-quick-actions">
                <button type="button" onClick={() => setPaused(value => !value)} disabled={game.status === 'ready' || game.status === 'won' || game.status === 'lost'}>
                  {paused ? <Play size={17}/> : <Pause size={17}/>} {paused ? 'Resume' : 'Pause'}
                </button>
                <button type="button" onClick={resetGame}><RotateCcw size={17}/> New Game</button>
              </div>
            </div>

            <div className="msw-board-tools">
              <p className="msw-board-hint">{game.status === 'ready' ? 'Tap any square to start. Your first reveal and surrounding squares are safe.' :
                game.status === 'playing' ? (paused ? 'Game paused. Resume to continue.' : mode === 'flag' ? 'Flag mode: tap a covered square to mark or unmark it.' : 'Reveal mode: tap a covered square to uncover it.') :
                game.status === 'won' ? 'All safe squares revealed. You win!' : 'Mine hit. Try another field!'}</p>
              <div className="msw-zoom" role="group" aria-label="Board zoom">
                <button type="button" aria-label="Zoom out" onClick={() => changeZoom(-1)} disabled={zoom === 'compact'}><Minus size={16}/></button>
                <span>Zoom</span>
                <button type="button" aria-label="Zoom in" onClick={() => changeZoom(1)} disabled={zoom === 'large'}><Plus size={16}/></button>
              </div>
            </div>

            <p id="msw-keyboard-help" className="pg-sr-only">Use arrow keys to navigate squares, Enter or Space for the selected action, and F to flag or unflag a square. The first reveal and surrounding squares are safe.</p>
            <div className="pg-sr-only" role="status" aria-live="polite" aria-atomic="true">{opened} safe squares revealed; {flags} flags placed; {game.status === 'won' ? 'game won' : game.status === 'lost' ? 'game lost' : 'game in progress'}.</div>
            <div className="msw-board-wrapper">
            <div className="msw-scroll" ref={boardRef} aria-label="Scrollable Minesweeper board" tabIndex={0}>
              <div className="msw-grid" role="grid" aria-label={`${config.label} Minesweeper board`} aria-describedby="msw-keyboard-help"
                aria-rowcount={game.rows} aria-colcount={game.cols}
                data-level={game.level} data-zoom={zoom}
                style={{ gridTemplateColumns: `repeat(${game.cols}, var(--msw-cell-size))` }}>
                {Array.from({length: game.rows}, (_,row) => <div className="msw-board-row" role="row" key={row}>
                  {Array.from({length: game.cols}, (_,col) => {
                    const index = row * game.cols + col
                    const value = game.field?.[index]
                    const flagged = game.flags[index]
                    const revealed = game.revealed[index]
                    const exploded = game.status === 'lost' && game.explodedIndex === index
                    const mineShown = game.status === 'lost' && value === -1
                    const wrongFlag = game.status === 'lost' && flagged && value !== -1
                    const cls = ['msw-cell', revealed ? 'msw-revealed' : 'msw-covered',
                      flagged ? 'msw-flagged' : '',
                      mineShown ? 'msw-mine' : '', exploded ? 'msw-exploded' : '',
                      wrongFlag ? 'msw-wrong-flag' : '',
                      revealed && value !== undefined && value >= 1 ? `msw-number-${value}` : '',
                    ].filter(Boolean).join(' ')
                    return <button key={index} type="button" role="gridcell" ref={node => { cellRefs.current[index] = node }}
                      className={cls} aria-label={describeCell(game, index)}
                      disabled={paused || game.status === 'won' || game.status === 'lost'}
                      onClick={() => actOnCell(index)} onContextMenu={event => onContextMenu(event, index)}
                      onKeyDown={event => onCellKeyDown(event, index)}>
                      {wrongFlag ? <><X size={16}/><Flag size={11}/></> :
                        flagged ? <Flag size={18} fill="currentColor"/> :
                        mineShown ? <Bomb size={18}/> :
                        revealed && value !== undefined && value > 0 ? value : null}
                    </button>
                  })}
                </div>)}
              </div>
            </div>
              {paused && <div className="msw-pause-overlay"><Pause size={30}/><strong>Game paused</strong><p>The timer is stopped.</p><button type="button" onClick={() => setPaused(false)}>Resume game <Play size={16}/></button></div>}
            </div>

            {(game.status === 'won' || game.status === 'lost') && <div className={`msw-result ${game.status === 'won' ? 'msw-result-win' : 'msw-result-loss'}`} role="status">
              {game.status === 'won' ? <Trophy size={27}/> : <Bomb size={27}/>}
              <div><strong>{game.status === 'won' ? 'Field cleared. You win!' : 'You hit a mine!'}</strong>
                <p>{config.label} · {formatTime(game.seconds)} · {game.status === 'won' ? 'Every safe square revealed.' : 'Try a new field and find a safer route.'}</p></div>
              <button type="button" onClick={resetGame}>Play again <RotateCcw size={17}/></button>
            </div>}
            <div className="msw-board-footer"><span><i className="msw-legend msw-legend-covered"/> Covered</span><span><i className="msw-legend msw-legend-revealed"/> Safe</span><span><Flag size={14}/> Flagged</span><span><Bomb size={14}/> Mine</span></div>
          </div>

          <aside className="msw-side">
            <section className="msw-side-card"><span className="msw-eyebrow">HOW TO PLAY</span><h2>Every number tells a story.</h2>
              <p>A revealed number shows how many mines touch that square, including diagonally. Clear every safe square to win—flags are optional.</p>
              <div className="msw-tip"><span>1</span><p><strong>Reveal</strong> to uncover safe squares. Empty spaces open nearby cells automatically.</p></div>
              <div className="msw-tip"><span><Flag size={17}/></span><p><strong>Flag</strong> a likely mine before revealing nearby squares.</p></div>
              <div className="msw-tip"><span><ShieldCheck size={17}/></span><p><strong>First move is safe.</strong> The board is generated after your first reveal.</p></div>
            </section>
            <section className="msw-side-card msw-progress"><span className="msw-eyebrow">YOUR PROGRESS</span>
              <div className="msw-progress-header"><strong>{Math.round(opened / safeTotal * 100)}%</strong><span>{safeTotal - opened} safe squares left</span></div>
              <div className="msw-track"><div style={{ width: `${opened / safeTotal * 100}%` }}/></div>
              <p>{best === null ? 'Finish a puzzle to set your best time.' : <>Best {config.label} time: <strong>{formatTime(best)}</strong></>}</p>
            </section>
            <section className="msw-side-card msw-shortcuts"><span className="msw-eyebrow">QUICK CONTROLS</span>
              <p><strong>Computer:</strong> Left-click reveals; right-click flags. Arrow keys move between squares. Press F to flag.</p>
              <p><strong>Phone:</strong> Choose Reveal or Flag above the board, then tap a square. Scroll the grid for Medium and Hard.</p>
              <p>Mines left is an estimate based on flags placed, not a count of confirmed mines.</p>
            </section>
          </aside>
        </section>
      </main>
      <footer className="msw-footer"><span>playgrove.</span> One safe square at a time.</footer>
    </div>
  </div>
}
