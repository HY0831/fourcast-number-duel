import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Clock3, Eraser, Gamepad2, Lightbulb, Pause, Pencil, Play, RotateCcw, Sparkles, Trophy, Undo2 } from 'lucide-react'
import { LEVEL_META, SUDOKU_LEVELS, enterDigit, generateSudoku, getConflicts, isGrid, isLevel, isSolved, nextHint, progress } from './sudoku-engine.mjs'
import type { SudokuLevel, SudokuPuzzle } from './sudoku-engine.mjs'
import './sudoku.css'

type SudokuSession = SudokuPuzzle & {
  board: string
  notes: number[][]
  seconds: number
  mistakes: number
  hints: number
  completed: boolean
}
type UndoEntry = Pick<SudokuSession, 'board' | 'notes' | 'mistakes' | 'hints' | 'completed'>
const STORAGE_PREFIX = 'playgrove:sudoku:v1:'
const LAST_LEVEL_KEY = STORAGE_PREFIX + 'last-level'
const BEST_PREFIX = STORAGE_PREFIX + 'best:'

function newSession(level: SudokuLevel): SudokuSession {
  const puzzle = generateSudoku(level)
  return { ...puzzle, board: puzzle.puzzle, notes: Array.from({ length: 81 }, () => []), seconds: 0, mistakes: 0, hints: 0, completed: false }
}
function readSession(level: SudokuLevel): SudokuSession {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + level)
    if (raw) {
      const data = JSON.parse(raw) as SudokuSession
      if (data.level === level && isGrid(data.puzzle) && isGrid(data.solution) && isGrid(data.board)
        && [...data.puzzle].every((digit, i) => digit === '0' || (digit === data.solution[i] && digit === data.board[i]))
        && Array.isArray(data.notes) && data.notes.length === 81
        && data.notes.every(n => Array.isArray(n) && n.every(d => Number.isInteger(d) && d >= 1 && d <= 9))
        && Number.isFinite(data.seconds) && data.seconds >= 0
        && Number.isFinite(data.mistakes) && data.mistakes >= 0
        && Number.isFinite(data.hints) && data.hints >= 0) {
        return { ...data, completed: isSolved(data.board, data.solution) }
      }
    }
  } catch { /* Storage can be disabled or contain an outdated save. */ }
  return newSession(level)
}
function lastLevel(): SudokuLevel {
  try { const saved = localStorage.getItem(LAST_LEVEL_KEY); return isLevel(saved) ? saved : 'easy' }
  catch { return 'easy' }
}
function savedBest(level: SudokuLevel): number | null {
  try { const time = Number(localStorage.getItem(BEST_PREFIX + level)); return Number.isFinite(time) && time > 0 ? time : null }
  catch { return null }
}
function elapsed(seconds: number) {
  const sec = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(sec / 60), hours = Math.floor(mins / 60)
  return hours ? `${hours}:${String(mins % 60).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}` : `${String(mins).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

export default function SudokuPage({ onBack }: { onBack: () => void }) {
  const [game, setGame] = useState<SudokuSession>(() => readSession(lastLevel()))
  const [selected, setSelected] = useState<number | null>(() => null)
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [notesMode, setNotesMode] = useState(false)
  const [paused, setPaused] = useState(false)
  const [best, setBest] = useState<number | null>(() => savedBest(lastLevel()))
  const [notice, setNotice] = useState('')
  const undoStack = useRef<UndoEntry[]>([])
  const conflicts = useMemo(() => getConflicts(game.board), [game.board])
  const filled = progress(game.board)
  const hasChanges = game.board !== game.puzzle || game.hints > 0

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + game.level, JSON.stringify(game))
      localStorage.setItem(LAST_LEVEL_KEY, game.level)
    } catch { /* Playing without saved progress still works. */ }
  }, [game])

  useEffect(() => {
    if (game.completed || paused) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') setGame(current => ({ ...current, seconds: current.seconds + 1 }))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [game.completed, paused])

  useEffect(() => {
    if (!game.completed) return
    const record = savedBest(game.level)
    if (record === null || game.seconds < record) {
      try { localStorage.setItem(BEST_PREFIX + game.level, String(Math.max(1, game.seconds))) } catch { /* still won */ }
      setBest(Math.max(1, game.seconds))
    }
  }, [game.completed, game.seconds, game.level])

  const changeLevel = (level: SudokuLevel) => {
    if (level === game.level) return
    const next = readSession(level)
    setGame(next)
    setSelected(null)
    setNotesMode(false)
    setPaused(false)
    setNotice('')
    setBest(savedBest(level))
    undoStack.current = []
  }

  const record = (next: SudokuSession) => {
    if (next.board === game.board && next.notes === game.notes) return
    undoStack.current = [...undoStack.current.slice(-99), {
      board: game.board, notes: game.notes, mistakes: game.mistakes, hints: game.hints, completed: game.completed,
    }]
    setGame(next)
  }

  const enter = (digit: number) => {
    if (paused || game.completed || selected === null || game.puzzle[selected] !== '0') return
    const previous = game.board[selected]
    if (notesMode && digit !== 0) {
      const notes = game.notes.map(entry => [...entry]);
      const existing = notes[selected]
      notes[selected] = existing.includes(digit) ? existing.filter(n => n !== digit) : [...existing, digit].sort()
      record({ ...game, notes })
      return
    }
    const board = enterDigit(game.board, game.puzzle, selected, digit)
    if (board === game.board && !game.notes[selected].length) return
    const notes = game.notes.map(entry => [...entry])
    notes[selected] = []
    const wrongEntry = digit !== 0 && String(digit) !== game.solution[selected] && previous !== String(digit)
    const mistakes = game.mistakes + Number(wrongEntry)
    const completed = isSolved(board, game.solution)
    record({ ...game, board, notes, mistakes, completed })
    setNotice(wrongEntry ? 'That digit is not correct for this cell. Try another!' : '')
  }

  const undo = () => {
    if (paused || !undoStack.current.length) return
    const previous = undoStack.current.at(-1)!
    undoStack.current = undoStack.current.slice(0, -1)
    setGame(current => ({ ...current, ...previous }))
    setNotice('')
  }

  const hint = () => {
    if (paused || game.completed) return
    const index = nextHint(game.board, game.solution, selected)
    if (index === null) return
    const board = enterDigit(game.board, game.puzzle, index, Number(game.solution[index]))
    const notes = game.notes.map(n => [...n]); notes[index] = []
    record({ ...game, board, notes, hints: game.hints + 1, completed: isSolved(board, game.solution) })
    setSelected(index)
    setNotice('One correct digit revealed. Keep going!')
  }

  const restart = () => {
    if (hasChanges && !game.completed && !window.confirm('Start a new Sudoku puzzle? Your current puzzle progress will be replaced.')) return
    setGame(newSession(game.level))
    setSelected(null)
    setPaused(false)
    setNotesMode(false)
    setNotice('')
    undoStack.current = []
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return
      const target = event.target instanceof HTMLElement ? event.target : null
      // Do not hijack arrow keys or number shortcuts while another control has focus.
      if (target?.isContentEditable || target?.closest('input, textarea, select') ||
          (target?.closest('button') && !target.closest('.sdk-board'))) return
      if (event.key >= '1' && event.key <= '9') { event.preventDefault(); enter(Number(event.key)); return }
      if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') { event.preventDefault(); enter(0); return }
      if (event.key.toLowerCase() === 'n') { event.preventDefault(); setNotesMode(v => !v); return }
      const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }
      if (!(event.key in step) || paused) return
      event.preventDefault()
      const firstEmpty = game.puzzle.indexOf('0')
      const from = selected === null ? Math.max(0, firstEmpty) : selected
      const row = Math.floor(from / 9), col = from % 9
      const next = event.key === 'ArrowLeft' ? row * 9 + Math.max(col - 1, 0)
        : event.key === 'ArrowRight' ? row * 9 + Math.min(col + 1, 8)
        : Math.max(0, Math.min(8, row + (event.key === 'ArrowUp' ? -1 : 1))) * 9 + col
      setSelected(next)
      if (target?.closest('.sdk-board')) cellRefs.current[next]?.focus())
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  return <div className="sdk-shell">
    <div className="sdk-frame">
      <header className="sdk-header">
        <button className="sdk-brand" type="button" onClick={onBack} aria-label="Back to Playgrove Game Library"><span><Gamepad2 size={22}/></span>playgrove<b>.</b></button>
        <button type="button" className="sdk-back" onClick={onBack}><ArrowLeft size={16}/> All games</button>
      </header>
      <main className="sdk-main">
        <div className="sdk-intro">
          <div><div className="sdk-eyebrow"><Sparkles size={15}/> A QUIET LITTLE CHALLENGE</div><h1>Sudoku<span>.</span></h1><p>Fill every row, column and 3×3 box with 1–9. Every digit belongs exactly once.</p></div>
          <div className="sdk-intro-badge"><span>01—09</span><small>ONE GRID. ONE SOLUTION.</small></div>
        </div>

        <section className="sdk-level-section" aria-label="Choose Sudoku difficulty">
          <div className="sdk-section-line"><h2>Choose your level</h2><span>Pick your pace</span></div>
          <div className="sdk-levels">{SUDOKU_LEVELS.map(level => <button type="button" key={level} aria-pressed={game.level === level} className={`sdk-level ${game.level === level ? 'sdk-level-selected' : ''}`} onClick={() => changeLevel(level)}>
            <strong>{LEVEL_META[level].label}</strong><small>{LEVEL_META[level].subtitle}</small>
            {game.level === level && <Check size={16} className="sdk-level-check"/>}
          </button>)}</div>
        </section>

        <div className="sdk-workspace">
          <section className="sdk-board-panel" aria-label="Sudoku puzzle">
            <div className="sdk-stat-row">
              <div className="sdk-stat"><Clock3 size={17}/><div><span>TIME</span><strong aria-label="Elapsed time">{elapsed(game.seconds)}</strong></div></div>
              <div className="sdk-stat"><div className="sdk-stat-icon">#</div><div><span>FILLED</span><strong>{filled}/81</strong></div></div>
              <div className="sdk-stat"><div className="sdk-stat-icon">!</div><div><span>MISTAKES</span><strong>{game.mistakes}</strong></div></div>
            </div>
            <div className="sdk-board-wrap">
              <p id="sdk-keyboard-help" className="pg-sr-only">Use arrow keys to move between squares, digits 1 through 9 to enter a value, Delete to erase, and N to toggle pencil notes.</p>
              <div className="sdk-board" role="grid" aria-label="Sudoku 9 by 9 board" aria-describedby="sdk-keyboard-help">
                {Array.from({length:9}, (_,row) => <div className="sdk-board-row" role="row" key={row}>
                  {Array.from({length:9},(_,col) => {
                    const i=row*9+col
                    const value=game.board[i]
                    const isGiven=game.puzzle[i] !== '0'
                    const highlighted=selected !== null && (row === Math.floor(selected/9) || col === selected%9 || (Math.floor(row/3)===Math.floor(selected/27) && Math.floor(col/3) === Math.floor((selected%9)/3)))
                    const sameDigit=selected !== null && game.board[selected] !== '0' && value === game.board[selected]
                    const wrong=value !== '0' && !isGiven && value !== game.solution[i]
                    const classes=['sdk-cell',isGiven?'sdk-given':'sdk-editable',highlighted?'sdk-related':'',sameDigit?'sdk-matching':'',selected===i?'sdk-selected':'',wrong||conflicts.has(i)?'sdk-wrong':'',col%3===2&&col!==8?'sdk-block-right':'',row%3===2&&row!==8?'sdk-block-bottom':''].filter(Boolean).join(' ')
                    return <button key={i} type="button" role="gridcell" ref={node => { cellRefs.current[i] = node }} aria-selected={selected===i} aria-label={`Row ${row+1}, column ${col+1}: ${value==='0'?'empty':value}${value==='0' && game.notes[i].length ? `, notes ${game.notes[i].join(', ')}` : ''}${isGiven?', given':''}${wrong?', incorrect':''}`} className={classes} onClick={() => { if (!paused) setSelected(i) }} disabled={paused}>
                      {value!=='0' ? value : <div className="sdk-cell-notes" aria-hidden="true">{Array.from({length:9},(_,n) => <span key={n}>{game.notes[i].includes(n+1)?n+1:''}</span>)}</div>}
                    </button>
                  })}</div>)}
              </div>
              {paused && <div className="sdk-board-overlay"><Pause size={31}/><strong>Puzzle paused</strong><span>Your timer is stopped.</span><button type="button" onClick={() => setPaused(false)}>Resume puzzle <Play size={15}/></button></div>}
              {game.completed && <div className="sdk-board-overlay sdk-success-overlay" role="status" aria-live="polite"><Trophy size={36}/><strong>You solved it!</strong><span>{LEVEL_META[game.level].label} · {elapsed(game.seconds)} · {game.mistakes} mistakes</span><button type="button" onClick={restart}>New puzzle <ArrowRight size={16}/></button></div>}
            </div>
            <div className="sdk-board-caption"><span><i className="sdk-legend-dot"/> Original numbers are fixed</span><span><i className="sdk-legend-dot sdk-legend-error"/> Red numbers need fixing</span></div>
          </section>

          <aside className="sdk-tools">
            <div className="sdk-tool-header"><span className="sdk-eyebrow">YOUR WORKSPACE</span><h2>Take your time.</h2><p>Tap a square, then enter a number. Use notes to keep track of possibilities.</p></div>
            <div className="sdk-keypad" role="group" aria-label="Sudoku number keypad">{Array.from({length:9},(_,n) => <button key={n+1} type="button" aria-label={`Digit ${n+1}`} onClick={() => enter(n+1)} disabled={paused || game.completed || selected === null || game.puzzle[selected] !== '0'}>{n+1}</button>)}</div>
            <div className="sdk-tools-grid">
              <button type="button" onClick={() => enter(0)} disabled={paused||game.completed||selected===null||game.puzzle[selected]!=='0'}><Eraser size={20}/><span>Erase</span></button>
              <button type="button" aria-pressed={notesMode} className={notesMode?'sdk-mode-active':''} onClick={() => setNotesMode(v=>!v)} disabled={paused||game.completed}><Pencil size={20}/><span>Notes {notesMode?'ON':''}</span></button>
              <button type="button" onClick={undo} disabled={paused||undoStack.current.length===0}><Undo2 size={20}/><span>Undo</span></button>
              <button type="button" onClick={hint} disabled={paused||game.completed}><Lightbulb size={20}/><span>Hint</span></button>
            </div>
            <div className="sdk-tool-divider"/>
            <div className="sdk-actions"><button type="button" onClick={() => setPaused(v=>!v)} disabled={game.completed}>{paused?<Play size={18}/>:<Pause size={18}/>} {paused?'Resume':'Pause'}</button><button type="button" onClick={restart}><RotateCcw size={18}/> New puzzle</button></div>
            {notice && <div className="sdk-notice" role="status">{notice}</div>}
            <div className="sdk-progress-card"><span>YOUR PROGRESS</span><div className="sdk-progress-line"><strong>{Math.round(filled/81*100)}%</strong><span>{81-filled} cells left</span></div><div className="sdk-progress-track"><div style={{width:`${filled/81*100}%`}}/></div><div className="sdk-record">{best===null?'Finish a puzzle to set your best time.':<>Best {LEVEL_META[game.level].label} time: <b>{elapsed(best)}</b></>} {game.hints>0&&<span> · {game.hints} hints</span>}</div></div>
            <div className="sdk-tip"><Sparkles size={17}/><p><strong>Little tip</strong><br/>Start with rows, columns or boxes that have the most numbers already filled.</p></div>
          </aside>
        </div>
      </main>
      <footer className="sdk-footer"><span>playgrove.</span> A little space for big thinking.</footer>
    </div>
  </div>
}