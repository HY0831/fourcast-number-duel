import {useEffect,useMemo,useRef,useState,type KeyboardEvent,type PointerEvent} from 'react'
import {ArrowLeft,ArrowRight,CheckCircle2,Clock3,Gamepad2,Lightbulb,Minus,Pause,Play,Plus,Redo2,RotateCcw,Search,Undo2,ZoomIn} from 'lucide-react'
import {DIFFICULTIES,PUZZLES,findPuzzle} from './puzzle-library.mjs'
import {MAX_HINTS,canSetBridge,cycleBridge,freshSession,giveHint,inspectBoard,redo,restoreSession,toggleNoBridge,undo,type HashiPuzzle,type HashiSession} from './hashi-engine.mjs'
import './hashi.css'
type Props={onBack:()=>void}
type Filter='All'|'Easy'|'Medium'|'Hard'
const PREFIX='playgrove:hashi:v1:'
const ACTIVE=PREFIX+'active'
const BEST=PREFIX+'best:'
const safeRead=(key:string)=>{try{return localStorage.getItem(key)}catch{return null}}
const safeWrite=(key:string,val:string)=>{try{localStorage.setItem(key,val)}catch{/* Private browser: still playable */}}
const elapsed=(s:number)=>{const n=Math.floor(s);return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
const getActive=()=>{const id=safeRead(ACTIVE);return id&&findPuzzle(id)?id:null}
const getBest=(id:string)=>{const raw=safeRead(BEST+id);const v=raw===null?NaN:Number(raw);return Number.isInteger(v)&&v>0?v:null}
const load=(p:HashiPuzzle):HashiSession=>{try{return restoreSession(JSON.parse(safeRead(PREFIX+p.id)||'null'),p)}catch{return freshSession(p)}}

export default function HashiPage({onBack}:Props) {
  const [active,setActive]=useState<string|null>(getActive)
  const [game,setGame]=useState<HashiSession|null>(()=>{const id=getActive(),p=id&&findPuzzle(id);return p?load(p):null})
  const [difficulty,setDifficulty]=useState<Filter>('All')
  const [query,setQuery]=useState('')
  const [selected,setSelected]=useState<number|null>(null)
  const [noBridge,setNoBridge]=useState(false)
  const [paused,setPaused]=useState(false)
  const [zoom,setZoom]=useState(1)
  const [notice,setNotice]=useState('')
  const [refresh,setRefresh]=useState(0)
  const pointer=useRef<{island:number;x:number;y:number}|null>(null)
  const suppressClick=useRef(false)
  const puzzle=active?findPuzzle(active):null
  const analysis=useMemo(()=>puzzle&&game?inspectBoard(puzzle,game.bridges):null,[puzzle,game?.bridges])
  const filtered=PUZZLES.filter(p=>(difficulty==='All'||p.difficulty===difficulty)&&
    (p.id+' '+p.title).toLowerCase().includes(query.trim().toLowerCase()))
  const completedCount=PUZZLES.filter(p=>{try{return load(p).completed}catch{return false}}).length+refresh*0

  useEffect(()=>{
    if(!puzzle||!game||game.id!==puzzle.id)return
    safeWrite(PREFIX+puzzle.id,JSON.stringify(game))
    if(game.completed){
      const previous=getBest(puzzle.id)
      if(previous===null||game.seconds<previous){safeWrite(BEST+puzzle.id,String(Math.max(1,game.seconds)))}
    }
  },[game,puzzle])
  useEffect(()=>{
    if(!game||game.completed||paused)return
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')setGame(s=>s&&!s.completed?{...s,seconds:s.seconds+1}:s)},1000)
    return ()=>window.clearInterval(timer)
  },[game?.completed,paused,active])

  const pick=(id:string)=>{
    const p=findPuzzle(id);if(!p)return
    setActive(id);safeWrite(ACTIVE,id);setGame(load(p))
    setSelected(null);setNoBridge(false);setPaused(false);setZoom(1);setNotice('')
    window.scrollTo(0,0)
  }
  const collection=()=>{
    setActive(null);safeWrite(ACTIVE,'');setGame(null);setPaused(false);setSelected(null);setNotice('');setRefresh(n=>n+1);window.scrollTo(0,0)
  }
  const changeEdge=(index:number,reverse=false)=>{
    if(!puzzle||!game||paused||game.completed)return
    if(noBridge){
      if(game.bridges[index]){setNotice('Remove this bridge before marking the connection as unavailable.');return}
      setGame(s=>s?toggleNoBridge(s,puzzle,index):s)
      setNotice('');return
    }
    const target=(game.bridges[index]+(reverse?2:1))%3
    if(!canSetBridge(puzzle,game.bridges,index,target)){
      setNotice('A bridge cannot cross another bridge. Remove the crossing bridge first.');return
    }
    setGame(s=>s?cycleBridge(s,puzzle,index,reverse):s)
    setNotice('')
  }
  const tapIsland=(island:number)=>{
    if(!puzzle||!game||paused||game.completed)return
    if(selected===null){setSelected(island);setNotice('Choose another island in the same row or column.');return}
    if(selected===island){setSelected(null);setNotice('');return}
    const index=puzzle.edges.findIndex(e=>e.a===Math.min(selected,island)&&e.b===Math.max(selected,island))
    setSelected(island)
    if(index<0){setNotice('Only nearest visible islands in the same row or column can connect.');return}
    changeEdge(index);setSelected(null)
  }
  const onPointerDown=(event:PointerEvent<SVGSVGElement>)=>{
    const t=event.target as Element
    const index=t.closest('[data-island]')?.getAttribute('data-island')
    pointer.current=index===null||index===undefined?null:{island:Number(index),x:event.clientX,y:event.clientY}
  }
  const onPointerUp=(event:PointerEvent<SVGSVGElement>)=>{
    const start=pointer.current;pointer.current=null
    if(!start||!puzzle||paused)return
    if(Math.hypot(event.clientX-start.x,event.clientY-start.y)<12)return
    const el=document.elementFromPoint(event.clientX,event.clientY)
    const raw=el?.closest('[data-island]')?.getAttribute('data-island')
    if(raw===null||raw===undefined)return
    const destination=Number(raw)
    if(destination!==start.island){
      suppressClick.current=true
      window.setTimeout(()=>{suppressClick.current=false},0)
      const index=puzzle.edges.findIndex(e=>e.a===Math.min(start.island,destination)&&e.b===Math.max(start.island,destination))
      if(index>=0){changeEdge(index);setSelected(null)}
      else{setSelected(destination);setNotice('Those islands cannot be directly connected.')}
    }
  }
  const hint=()=>{
    if(!game||!puzzle)return
    const r=giveHint(game,puzzle);setGame(r.session);setNotice(r.detail)
  }
  const check=()=>{
    if(!puzzle||!game||!analysis)return
    if(analysis.overfull.length){setNotice('Check: '+analysis.overfull.length+' island(s) have too many bridges.');return}
    if(analysis.isolated.length){setNotice('Check: a completed island group is disconnected from the rest of the board.');return}
    const remaining=puzzle.islands.length-analysis.matched
    setNotice(remaining?'Check: '+remaining+' islands do not yet match their required numbers.':'All island counts match. Check that the entire network is connected.')
  }
  const restart=()=>{
    if(!puzzle)return
    if(!window.confirm('Restart this puzzle? All bridges, marks and hints will reset.'))return
    setGame(freshSession(puzzle));setSelected(null);setPaused(false);setNotice('')
  }
  const next=()=>{
    if(!puzzle)return
    const index=PUZZLES.findIndex(p=>p.id===puzzle.id)
    pick(PUZZLES[(index+1)%PUZZLES.length].id)
  }
  const zoomStep=()=>setZoom(z=>z===0.85?1:z===1?1.2:0.85)
  const width=puzzle?(puzzle.size-1)*60+96:0
  const boardWidth=Math.round(width*zoom)

  return <div className="hb-shell">
    <div className="hb-frame">
      <header className="hb-header">
        <button className="hb-brand" onClick={onBack} type="button"><span><Gamepad2 size={22}/></span>playgrove<b>.</b></button>
        <button className="hb-top-back" type="button" onClick={puzzle?collection:onBack}><ArrowLeft size={17}/>{puzzle?'Puzzle library':'All games'}</button>
      </header>
      {!puzzle||!game? <main className="hb-main">
        <section className="hb-hero">
          <span className="hb-eyebrow">GAME #08 · THE LOGIC COLLECTION</span>
          <h1>Hashi: <em>Bridges.</em></h1>
          <p>Connect numbered islands, balance every bridge, and create one unbroken network. No guessing needed.</p>
          <div className="hb-hero-tags"><span>45 unique puzzles</span><span>3 difficulties</span><span>Play offline after loading</span></div>
        </section>
        <section className="hb-library">
          <div className="hb-library-heading"><div><span className="hb-eyebrow">THE PUZZLE COLLECTION</span><h2>Choose your challenge</h2></div><strong>{completedCount} / 45 completed</strong></div>
          <div className="hb-filters">
            <div className="hb-levels" role="group" aria-label="Difficulty filter">
              {(['All',...DIFFICULTIES] as Filter[]).map(d=><button type="button" key={d} aria-pressed={difficulty===d} className={difficulty===d?'hb-filter-on':''} onClick={()=>setDifficulty(d)}>{d}</button>)}
            </div>
            <label className="hb-search"><Search size={17}/><span className="hb-sr-only">Search puzzles</span>
              <input type="search" aria-label="Search puzzles" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a puzzle..." maxLength={60}/></label>
          </div>
          <div className="hb-grid">
            {filtered.map(p=>{
              const s=load(p),best=getBest(p.id)
              return <article key={p.id} className="hb-puzzle-card">
                <div className="hb-card-mark"><span><ZoomIn size={23}/></span><strong>{p.id}</strong></div>
                <span className="hb-card-level">{p.difficulty} · {p.size}×{p.size}</span>
                <h3>{p.title}</h3>
                <p>{p.islands.length} islands · {s.completed?'Completed':s.bridges.some(Boolean)||s.hints?'In progress':'Not started'}</p>
                {best!==null&&<small>Best: {elapsed(best)}</small>}
                <button type="button" onClick={()=>pick(p.id)}>{s.completed?'View / Replay':s.bridges.some(Boolean)||s.hints?'Resume':'Play'} {p.title} <ArrowRight size={16}/></button>
              </article>
            })}
          </div>
          {!filtered.length&&<div className="hb-empty">No puzzles found. <button type="button" onClick={()=>{setDifficulty('All');setQuery('')}}>Clear filters</button></div>}
        </section>
      </main> : <main className="hb-main">
        <section className="hb-game-heading">
          <div><span className="hb-eyebrow">{puzzle.difficulty.toUpperCase()} · {puzzle.id} · {puzzle.size}×{puzzle.size}</span><h1>{puzzle.title}<span>.</span></h1>
            <p>Tap two neighbouring islands, or drag from one island to another. Repeat to cycle 0, 1 and 2 bridges.</p>
          </div>
          <button className="hb-collection" type="button" onClick={collection}>Puzzle collection</button>
        </section>
        <div className="hb-stats">
          <div><span><Clock3 size={14}/> TIME</span><strong>{elapsed(game.seconds)}</strong></div>
          <div><span><CheckCircle2 size={14}/> ISLANDS MATCHED</span><strong>{analysis?.matched||0} / {puzzle.islands.length}</strong></div>
          <div><span><Lightbulb size={14}/> HINTS LEFT</span><strong>{MAX_HINTS-game.hints}</strong></div>
        </div>
        <section className="hb-game-panel" aria-label="Hashi puzzle board">
          <div className="hb-board-tools">
            <span>{game.completed?'Network completed!':paused?'Puzzle paused':selected!==null?'Island '+(selected+1)+' selected':'Build one connected network'}</span>
            <div><button type="button" aria-label="Zoom out" disabled={zoom===0.85} onClick={()=>setZoom(z=>z===1.2?1:0.85)}><Minus size={17}/></button>
            <button type="button" aria-label="Zoom in" disabled={zoom===1.2} onClick={()=>setZoom(z=>z===0.85?1:1.2)}><Plus size={17}/></button></div>
          </div>
          <div className="hb-board-scroller">
            <svg className="hb-board" data-size={puzzle.size} data-zoom={zoom} style={{width:boardWidth,height:boardWidth}} viewBox={'0 0 '+width+' '+width}
              onPointerDown={onPointerDown} onPointerUp={onPointerUp} role="group" aria-label={puzzle.title+' Hashi islands and bridges'}>
              {Array.from({length:puzzle.size},(_,i)=>i).map(i=><g key={i}>
                <line x1={48} y1={48+i*60} x2={width-48} y2={48+i*60} stroke="#CBC8B9" strokeDasharray="3 7" strokeWidth={1}/>
                <line y1={48} x1={48+i*60} y2={width-48} x2={48+i*60} stroke="#CBC8B9" strokeDasharray="3 7" strokeWidth={1}/>
              </g>)}
              {puzzle.edges.map((edge,i)=>{
                const a=puzzle.islands[edge.a],b=puzzle.islands[edge.b],count=game.bridges[i],mark=game.marks[i];
                const x1=48+a.x*60,y1=48+a.y*60,x2=48+b.x*60,y2=48+b.y*60;
                const dx=edge.horizontal?0:6,dy=edge.horizontal?6:0;
                const label='Bridge between island '+(edge.a+1)+' and '+(edge.b+1)+': '+(mark?'marked unavailable':count+' of 2 bridges');
                return <g key={'e'+i} className="hb-edge-group" role="button" tabIndex={paused||game.completed?-1:0} aria-label={label}
                  onClick={()=>changeEdge(i)} onContextMenu={e=>{e.preventDefault();changeEdge(i,true)}}
                  onKeyDown={(e:KeyboardEvent<SVGGElement>)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();changeEdge(i)}}}>
                  {count===0&&<line x1={x1} y1={y1} x2={x2} y2={y2} stroke={mark?'#B25D3E':'#AAAFA0'} strokeDasharray={mark?'3 8':'2 12'} strokeWidth={mark?2:1.5} opacity={mark?0.75:0.35}/>}
                  {count===1&&<line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3E4734" strokeWidth={6} strokeLinecap="round"/>}
                  {count===2&&<><line x1={x1-dx} y1={y1-dy} x2={x2-dx} y2={y2-dy} stroke="#3E4734" strokeWidth={5} strokeLinecap="round"/>
                    <line x1={x1+dx} y1={y1+dy} x2={x2+dx} y2={y2+dy} stroke="#3E4734" strokeWidth={5} strokeLinecap="round"/></>}
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={20} className="hb-edge-hit"/>
                </g>
              })}
              {puzzle.islands.map((island,i)=>{
                const total=analysis?.totals[i]||0,complete=total===island.n,over=total>island.n;
                return <g key={'i'+i} data-island={i} role="button" tabIndex={paused||game.completed?-1:0}
                  aria-label={'Island '+(i+1)+': '+total+' of '+island.n+' bridges'+(complete?', matched':over?', too many':'')}
                  aria-pressed={selected===i} className="hb-island"
                  onClick={()=>{if(!suppressClick.current)tapIsland(i)}}
                  onKeyDown={(e:KeyboardEvent<SVGGElement>)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tapIsland(i)}}}>
                  <circle data-island={i} cx={48+island.x*60} cy={48+island.y*60} r={23} fill={selected===i?'#B25D3E':complete?'#E3E890':'#FFFFFF'}
                    stroke={over?'#B25D3E':selected===i?'#392525':'#728383'} strokeWidth={selected===i?4:2.6}/>
                  <text data-island={i} x={48+island.x*60} y={48+island.y*60+6.5} textAnchor="middle" fontWeight="800" fontSize="20" fill={selected===i?'#FFFFFF':'#392525'}>{island.n}</text>
                </g>
              })}
              {(paused||game.completed)&&<rect x="0" y="0" width={width} height={width} fill={paused?'#FAF5E9':'transparent'} opacity={paused?0.95:0} pointerEvents={paused?'all':'none'}/>}
            </svg>
          </div>
          <p className="hb-board-help">{paused?'Timer paused. Resume to continue.':noBridge?'No-bridge mode: tap an empty connection to mark it as ruled out.':'Tap two islands or a bridge path; right-click to cycle backwards on desktop.'}</p>
        </section>
        <div className="hb-controls">
          <button type="button" onClick={()=>setGame(s=>s?undo(s,puzzle):s)} disabled={paused||!game.history.length}><Undo2 size={19}/> Undo</button>
          <button type="button" onClick={()=>setGame(s=>s?redo(s,puzzle):s)} disabled={paused||!game.future.length}><Redo2 size={19}/> Redo</button>
          <button type="button" aria-pressed={noBridge} className={noBridge?'hb-control-active':''} onClick={()=>{setNoBridge(v=>!v);setSelected(null)}} disabled={paused||game.completed}><Minus size={19}/> No bridge</button>
          <button type="button" onClick={hint} disabled={paused||game.completed||game.hints>=MAX_HINTS}><Lightbulb size={19}/> Hint ({MAX_HINTS-game.hints})</button>
          <button type="button" onClick={check} disabled={paused||game.completed}><CheckCircle2 size={19}/> Check</button>
          <button type="button" onClick={()=>setPaused(v=>!v)} disabled={game.completed}>{paused?<Play size={19}/>:<Pause size={19}/>} {paused?'Resume':'Pause'}</button>
          <button type="button" onClick={restart}><RotateCcw size={19}/> Restart</button>
        </div>
        {notice&&<div className="hb-message" role="status">{notice}</div>}
        {game.completed&&<section className="hb-win" role="status" aria-live="polite">
          <CheckCircle2 size={36}/><h2>Every island connected!</h2>
          <p>You solved {puzzle.title} in {elapsed(game.seconds)} with {game.hints} hints used.</p>
          {getBest(puzzle.id)===null||game.seconds<=getBest(puzzle.id)!&&<strong>New personal best!</strong>}
          <div><button type="button" onClick={restart}>Replay puzzle</button><button type="button" onClick={next}>Next puzzle <ArrowRight size={16}/></button><button type="button" onClick={collection}>Back to library</button></div>
        </section>}
      </main>}
      <footer className="hb-footer">playgrove<span>.</span> · Eight games, countless little challenges.</footer>
    </div>
  </div>
}
