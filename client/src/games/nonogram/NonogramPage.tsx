import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'
import { ArrowLeft, Check, CheckCircle2, ChevronLeft, Clock3, Coffee, Flower2, Gamepad2, Grid3X3, Image, Lightbulb, Minus, Pause, PawPrint, Play, Plus, RotateCcw, Search, Sparkles, Trophy, Undo2, UserRound, X } from 'lucide-react'
import { CATEGORIES, DIFFICULTIES, PUZZLES, findPuzzle, type NonogramDifficulty, type NonogramPuzzle } from './puzzle-library.mjs'
import { MARK, MAX_HINTS, clueCompleted, freshSession, hintMark, restoreSession, toggleMark, undoMark, type NonogramSession } from './nonogram-engine.mjs'
import './nonogram.css'

type Props = { onBack: () => void }
type Mode = 'fill' | 'cross'
type DifficultyFilter = 'All' | NonogramDifficulty
type Zoom = 'compact' | 'regular' | 'large'
const STORE = 'playgrove:nonogram:v1:'
const ACTIVE = STORE + 'current'
const BEST = STORE + 'best:'
const ZOOMS: Zoom[] = ['compact','regular','large']
const fmtTime = (seconds: number) => `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`

function loadSession(p: NonogramPuzzle): NonogramSession {
  try { return restoreSession(JSON.parse(localStorage.getItem(STORE+p.id) || 'null'), p) }
  catch { return freshSession(p) }
}
function loadBest(id: string): number | null {
  try { const raw = localStorage.getItem(BEST+id); const n = raw === null ? NaN : Number(raw); return Number.isInteger(n) && n >= 0 ? n : null }
  catch { return null }
}
function initiallyActive(): string | null {
  try { const id = localStorage.getItem(ACTIVE) || ''; return findPuzzle(id) ? id : null }
  catch { return null }
}
function save(key: string, value: string) { try { localStorage.setItem(key, value) } catch { /* Remain playable in private browsing. */ } }
function clear(key: string) { try { localStorage.removeItem(key) } catch { /* Ignore */ } }
function PicturePixels({ puzzle, className = '' }: { puzzle: NonogramPuzzle; className?: string }) {
  return <div className={`ng-artwork ${className}`} role="img" aria-label={`Solved pixel art: ${puzzle.title}`}
    style={{gridTemplateColumns:`repeat(${puzzle.width},1fr)`}}>
    {puzzle.solution.join('').split('').map((value,i) => <span aria-hidden="true" key={i} className={value==='1'?'ng-pixel-painted':'ng-pixel-blank'}/>)}
  </div>
}
function MysteryArtwork({ puzzle }: { puzzle: NonogramPuzzle }) {
  return <div className="ng-mystery" aria-label={`Picture hidden: ${puzzle.title}`}>
    <Grid3X3 size={35} strokeWidth={1.25} aria-hidden="true"/>
    <span className="ng-mystery-question" aria-hidden="true">?</span>
  </div>
}
function categoryIcon(category: string) {
  if (category==='Animals') return <PawPrint size={15}/>
  if (category==='People') return <UserRound size={15}/>
  if (category==='Food') return <Coffee size={15}/>
  if (category==='Nature') return <Flower2 size={15}/>
  return <Image size={15}/>
}

export default function NonogramPage({ onBack }: Props) {
  const [active, setActive] = useState<string | null>(initiallyActive)
  const [game, setGame] = useState<NonogramSession | null>(() => { const id = initiallyActive(); const p = id && findPuzzle(id); return p ? loadSession(p) : null })
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('All')
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<Mode>('fill')
  const [paused, setPaused] = useState(false)
  const [zoom, setZoom] = useState<Zoom>('regular')
  const boardRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([])
  const puzzle = active ? findPuzzle(active) : null

  useEffect(() => {
    if (!game || !puzzle || game.id!==puzzle.id) return
    save(STORE+puzzle.id, JSON.stringify(game))
    if (game.status==='completed') {
      const previous = loadBest(puzzle.id)
      if (previous===null || game.seconds < previous) save(BEST+puzzle.id, String(game.seconds))
    }
  }, [game, puzzle])

  useEffect(() => {
    if (!game || game.status!=='playing' || paused) return
    const interval = window.setInterval(() => {
      if (document.visibilityState==='visible') setGame(current => current && current.status==='playing' ? {...current, seconds:current.seconds+1} : current)
    },1000)
    return () => window.clearInterval(interval)
  },[game?.status, paused])

  const library = useMemo(() => PUZZLES.filter(p =>
    (difficulty==='All'||p.difficulty===difficulty) &&
    (category==='All'||p.category===category) &&
    `${p.title} ${p.category}`.toLowerCase().includes(query.trim().toLowerCase())
  ),[difficulty,category,query])

  const pick = (id: string) => {
    const p = findPuzzle(id)
    if (!p) return
    save(ACTIVE,id)
    setActive(id);setGame(loadSession(p));setMode('fill');setPaused(false);setZoom('regular')
    cellRefs.current=[];boardRef.current?.scrollTo({top:0,left:0})
    window.scrollTo(0,0)
  }
  const gallery = () => {
    clear(ACTIVE);setActive(null);setGame(null);setPaused(false);setZoom('regular');setMode('fill')
    window.scrollTo(0,0)
  }
  const restart = () => {
    if (!puzzle || !game) return
    if (game.status!=='completed' && (game.marks.some(Boolean)||game.hints>0) &&
      !window.confirm(`Restart ${puzzle.title}? Your current markings will be cleared.`)) return
    setGame(freshSession(puzzle));setPaused(false);setMode('fill')
    boardRef.current?.scrollTo({top:0,left:0})
  }
  const mark = (index: number, action: Mode = mode) => {
    if (!puzzle || paused) return
    setGame(current => current && current.id===puzzle.id ? toggleMark(current,puzzle,index,action) : current)
  }
  const cellContext = (event: MouseEvent<HTMLButtonElement>, index: number) => { event.preventDefault();mark(index,'cross') }
  const cellKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!puzzle || paused) return
    if (event.key.toLowerCase()==='x') { event.preventDefault();mark(index,'cross');return }
    if (event.key.toLowerCase()==='f') { event.preventDefault();mark(index,'fill');return }
    const n=puzzle.width
    const next: Record<string,number> = {
      ArrowLeft:index%n?index-1:index, ArrowRight:index%n<n-1?index+1:index,
      ArrowUp:Math.max(0,index-n), ArrowDown:Math.min(n*n-1,index+n)
    }
    if (Object.prototype.hasOwnProperty.call(next,event.key)) {event.preventDefault();cellRefs.current[next[event.key]]?.focus()}
  }
  const zoomBy = (amount: -1 | 1) => setZoom(current => ZOOMS[Math.max(0,Math.min(ZOOMS.length-1,ZOOMS.indexOf(current)+amount))])

  const filled = game?.marks.filter(value=>value===MARK.FILL).length??0
  const crosses = game?.marks.filter(value=>value===MARK.CROSS).length??0
  const n = puzzle?.width??5
  const rowClueSlots = Math.max(1,...(puzzle?.rowClues??[[0]]).map(x=>x.length))
  const colClueSlots = Math.max(1,...(puzzle?.colClues??[[0]]).map(x=>x.length))
  const boardStyle = {
    '--ng-size':String(n), '--ng-left-clue':`${Math.max(50,rowClueSlots*20+18)}px`,
    '--ng-top-clue':`${Math.max(52,colClueSlots*19+18)}px`,
  } as CSSProperties
  const best = puzzle ? loadBest(puzzle.id) : null

  return <div className="ng-shell"><div className="ng-frame">
    <header className="ng-header">
      <button type="button" className="ng-brand" onClick={onBack} aria-label="Back to Playgrove Game Library"><span><Gamepad2 size={20}/></span>playgrove<b>.</b></button>
      <button type="button" className="ng-back" onClick={onBack}><ArrowLeft size={17}/> All games</button>
    </header>

    {!puzzle || !game ? <main className="ng-main">
      <section className="ng-hero"><div><span className="ng-eyebrow"><Sparkles size={15}/> GAME 07 · PIXEL PUZZLES</span>
        <h1>Nonogram<span>.</span></h1><p>Every square tells a story. Solve the clues and reveal 30 handcrafted pictures.</p>
        <div className="ng-tags"><span><Image size={15}/> 30 fixed pictures</span><span><Grid3X3 size={15}/> 3 difficulties</span><span><CheckCircle2 size={15}/> No guessing required</span></div>
      </div><div className="ng-hero-art" aria-hidden="true"><span>?</span><small>PICTURE LOGIC</small></div></section>
      <section className="ng-library" aria-label="Picture puzzle library">
        <div className="ng-section-top"><div><span className="ng-eyebrow">YOUR PICTURE COLLECTION</span><h2>Choose a picture.</h2><p>Unsolved artwork stays hidden. Complete a grid to reveal the picture.</p></div>
          <span className="ng-total">{PUZZLES.filter(p=>loadSession(p).status==='completed').length} / 30 completed</span></div>
        <div className="ng-library-tools">
          <div className="ng-filter-group" role="group" aria-label="Difficulty filter">
            {(['All',...DIFFICULTIES] as DifficultyFilter[]).map(option=><button key={option} type="button" aria-pressed={difficulty===option} className={difficulty===option?'ng-filter-active':''} onClick={()=>setDifficulty(option)}>{option}</button>)}
          </div>
          <label className="ng-search"><Search size={17}/><span className="ng-sr-only">Search pictures</span><input aria-label="Search pictures" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search picture names"/></label>
        </div>
        <div className="ng-categories" role="group" aria-label="Picture category filter">
          {['All',...CATEGORIES].map(value=><button type="button" key={value} aria-pressed={category===value} className={category===value?'ng-category-active':''} onClick={()=>setCategory(value)}>{value!=='All'?categoryIcon(value):<Grid3X3 size={15}/>} {value}</button>)}
        </div>
        <div className="ng-library-summary">Showing <strong>{library.length}</strong> puzzles · All pictures are fixed, validated designs</div>
        <div className="ng-gallery-grid">{library.map(p=>{
          const stored=loadSession(p),complete=stored.status==='completed',marked=stored.marks.some(Boolean)
          return <article className="ng-puzzle-card" key={p.id}>
            <div className={`ng-card-art ${complete?'ng-card-complete':''}`}>{complete?<PicturePixels puzzle={p}/>:<MysteryArtwork puzzle={p}/>}</div>
            <div className="ng-card-meta"><span className="ng-card-level">{p.difficulty} · {p.width}×{p.height}</span>{complete?<CheckCircle2 size={16} color="#557046" aria-label="Completed"/>:marked?<span className="ng-inprogress">In progress</span>:null}</div>
            <h3>{p.title}</h3><p>{p.category}</p>
            <button type="button" className="ng-start" onClick={()=>pick(p.id)} aria-label={`${complete?'Replay':marked?'Continue':'Play'} ${p.title}`}>{complete?'View / Replay':marked?'Continue puzzle':'Play puzzle'} <span aria-hidden="true">→</span></button>
          </article>
        })}</div>
        {library.length===0&&<div className="ng-empty-result"><Image size={27}/><p>No pictures match those filters.</p><button type="button" onClick={()=>{setDifficulty('All');setCategory('All');setQuery('')}}>Clear filters</button></div>}
      </section>
    </main> : <main className="ng-main ng-play-main">
      <div className="ng-game-heading"><div>
        <button className="ng-return" type="button" onClick={gallery}><ChevronLeft size={17}/> Picture collection</button>
        <span className="ng-eyebrow">{puzzle.difficulty.toUpperCase()} · {puzzle.width}×{puzzle.height} · {puzzle.category.toUpperCase()}</span>
        <h1>{puzzle.title}<span>.</span></h1><p>Fill the correct squares using the clues above and to the left of the board.</p>
      </div><span className="ng-picture-number">PICTURE {PUZZLES.findIndex(p=>p.id===puzzle.id)+1} / 30</span></div>
      <div className="ng-workspace">
        <section className="ng-board-panel" aria-label="Nonogram game">
          <div className="ng-stat-row">
            <div className="ng-stat"><Clock3 size={18}/><div><span>TIME</span><strong aria-label="Elapsed time">{fmtTime(game.seconds)}</strong></div></div>
            <div className="ng-stat"><Grid3X3 size={18}/><div><span>FILLED</span><strong>{filled}</strong></div></div>
            <div className="ng-stat"><X size={18}/><div><span>X MARKS</span><strong>{crosses}</strong></div></div>
          </div>
          <div className="ng-mode-row"><div className="ng-mode" role="group" aria-label="Board marking mode">
            <button type="button" aria-pressed={mode==='fill'} className={mode==='fill'?'ng-mode-active':''} onClick={()=>setMode('fill')}><Grid3X3 size={16}/> Fill</button>
            <button type="button" aria-pressed={mode==='cross'} className={mode==='cross'?'ng-mode-active':''} onClick={()=>setMode('cross')}><X size={16}/> Mark X</button>
          </div><div className="ng-zoom-controls" role="group" aria-label="Board zoom">
            <button type="button" aria-label="Zoom out" onClick={()=>zoomBy(-1)} disabled={zoom==='compact'}><Minus size={17}/></button>
            <span>{zoom==='regular'?'100%':zoom==='large'?'125%':'80%'}</span>
            <button type="button" aria-label="Zoom in" onClick={()=>zoomBy(1)} disabled={zoom==='large'}><Plus size={17}/></button>
          </div></div>
          <div className="ng-board-holder" ref={boardRef} aria-label="Scroll puzzle board to view hidden columns">
            <div className="ng-board-grid" role="grid" aria-label={`${puzzle.title}, ${n} by ${n} Nonogram board`} data-size={n} data-zoom={zoom} style={boardStyle}>
              <div className="ng-corner" aria-hidden="true"><Grid3X3 size={17}/></div>
              {puzzle.colClues.map((clues,col) => <div key={`col-${col}`} className={`ng-col-clue ${clueCompleted(puzzle,game.marks,false,col)?'ng-clue-finished':''}`} aria-label={`Column ${col+1} clues: ${clues.join(' ')}`}>
                {clues.map((value,i)=><span key={i}>{value}</span>)}
              </div>)}
              {puzzle.rowClues.map((clues,row) => [
                <div key={`row-${row}`} className={`ng-row-clue ${clueCompleted(puzzle,game.marks,true,row)?'ng-clue-finished':''}`} aria-label={`Row ${row+1} clues: ${clues.join(' ')}`}>
                  {clues.map((value,i)=><span key={i}>{value}</span>)}
                </div>,
                ...Array.from({length:n},(_,col)=>{
                  const index=row*n+col, state=game.marks[index]
                  return <button key={`cell-${index}`} type="button" role="gridcell" ref={element=>{cellRefs.current[index]=element}}
                    disabled={paused || game.status==='completed'}
                    aria-label={`Row ${row+1}, column ${col+1}: ${state===MARK.FILL?'filled':state===MARK.CROSS?'X mark':'empty'}`}
                    aria-selected={state===MARK.FILL}
                    className={`ng-cell ${state===MARK.FILL?'ng-cell-filled':state===MARK.CROSS?'ng-cell-cross':'ng-cell-empty'} ${col!==0&&col%5===0?'ng-cell-group-left':''} ${row!==0&&row%5===0?'ng-cell-group-top':''}`}
                    onClick={()=>mark(index)} onContextMenu={event=>cellContext(event,index)} onKeyDown={event=>cellKey(event,index)}>
                    {state===MARK.CROSS&&<X size={Math.min(19,n===15?16:19)} strokeWidth={2.5} aria-hidden="true"/>}
                  </button>
                })
              ])}
            </div>
          </div>
          {paused && <div className="ng-paused-banner" role="status"><Pause size={20}/> Puzzle paused — resume to keep solving.</div>}
          {game.status==='completed'&&<div className="ng-completed-banner" role="status"><Trophy size={24}/><div><strong>Picture unlocked!</strong><span>You've revealed {puzzle.title}.</span></div></div>}
          <div className="ng-board-caption"><span><span className="ng-legend-fill"/> Fill the picture</span><span><X size={13}/> Mark empty squares</span><span><Check size={14}/> Completed clues turn green</span></div>
          <p className="ng-mobile-hint">On larger puzzles, scroll the board to see more squares. Row and column clues move with the grid.</p>
        </section>
        <aside className="ng-side" aria-label="Puzzle controls and details">
          <section className="ng-side-card"><span className="ng-side-eyebrow">YOUR TOOLS</span><h2>One square at a time.</h2>
            <p>Numbers tell you how many consecutive squares to fill. Separate groups need at least one empty square between them.</p>
            <div className="ng-side-actions">
              <button type="button" onClick={()=>setGame(current=>current?undoMark(current,puzzle):current)} disabled={paused||game.status==='completed'||!game.history.length}><Undo2 size={18}/> Undo</button>
              <button type="button" onClick={()=>setGame(current=>current?hintMark(current,puzzle):current)} disabled={paused||game.status==='completed'||game.hints>=MAX_HINTS}><Lightbulb size={18}/> Hint ({MAX_HINTS-game.hints} left)</button>
              <button type="button" onClick={()=>setPaused(value=>!value)} disabled={game.status==='ready'||game.status==='completed'}>{paused?<Play size={18}/>:<Pause size={18}/>} {paused?'Resume':'Pause'}</button>
              <button type="button" onClick={restart}><RotateCcw size={18}/> Restart</button>
            </div>
            <span className="ng-helper">Desktop: right-click for X, press F to fill, X to cross, arrows to navigate.</span>
          </section>
          <section className="ng-side-card ng-progress-card"><span className="ng-side-eyebrow">YOUR PROGRESS</span>
            <div className="ng-progress-info"><strong>{game.status==='completed'?'Completed!':game.status==='ready'?'Not started':'In progress'}</strong><span>{game.hints} / {MAX_HINTS} hints used</span></div>
            <div className="ng-progress-track"><div style={{width:`${Math.round((filled+crosses)/(n*n)*100)}%`}}/></div>
            <p>{filled+crosses} of {n*n} cells marked · X marks are optional.</p>
            <div className="ng-best">{best===null?'Complete this picture to set your best time.':`Personal best: ${fmtTime(best)}`}</div>
          </section>
          {game.status==='completed'&&<section className="ng-side-card ng-unlocked-art"><span className="ng-side-eyebrow">COMPLETED ARTWORK</span><h2>{puzzle.title}</h2><PicturePixels puzzle={puzzle} className="ng-big-art"/>
            <button className="ng-see-library" onClick={gallery} type="button">Back to picture collection →</button>
          </section>}
        </aside>
      </div>
    </main>}
    <footer className="ng-footer"><span>playgrove<b>.</b></span><span>Picture logic · 30 handcrafted puzzles</span></footer>
  </div></div>
}
