import {useEffect,useMemo,useState} from 'react'
import {ArrowLeft,ArrowRight,CheckCircle2,CircleDot,Flag,Gamepad2,History,RotateCcw,Users} from 'lucide-react'
import {safeLocalStorage} from '../../playgrove/safeStorage'
import {BLACK,WHITE,startingBoard} from './reversi-rules.mjs'
import {freshLocal,playLocal,resignLocal,rematchLocal,restoreLocal,inspectLocal,localPlayerName,type LocalState} from './reversi-local.mjs'

const KEY='playgrove:reversi:local:v1'
function readSave():LocalState|null {
  try{const raw=safeLocalStorage.getItem(KEY);return raw?restoreLocal(JSON.parse(raw)):null}
  catch{return null}
}
const discName=(d:number)=>d===BLACK?'Black':'White'
const coordinate=(index:number)=>String.fromCharCode(97+index%8)+(8-Math.floor(index/8))

export default function LocalReversiPage({onBack,onOnline}:{onBack:()=>void;onOnline:()=>void}) {
  const [saved,setSaved]=useState(readSave)
  const [started,setStarted]=useState(false)
  const [game,setGame]=useState<LocalState>(()=>saved||freshLocal())
  const [names,setNames]=useState<[string,string]>(saved?[saved.names[0],saved.names[1]]:['Player 1','Player 2'])
  const [review,setReview]=useState<number|null>(null)
  const [message,setMessage]=useState('')
  useEffect(()=>{
    if(started)safeLocalStorage.setItem(KEY,JSON.stringify(game))
  },[started,game])
  const detail=useMemo(()=>inspectLocal(game),[game])
  const watching=review!==null
  const viewedMove=watching&&review>0?game.moves[review-1]:null
  const board=watching?review===0?startingBoard():viewedMove!.board:game.board
  const last=watching?viewedMove:detail.lastMove
  const allowed=!watching&&game.phase==='playing'?detail.legal:[]
  const current=localPlayerName(game,game.turn)
  const win=game.winner?localPlayerName(game,game.winner):null
  const start=(resume:boolean)=>{
    if(!resume){
      const safeNames=names.map((n,i)=>n.trim().slice(0,20)||'Player '+(i+1)) as [string,string]
      setGame(freshLocal(1,safeNames))
    }else if(saved)setGame(saved)
    setStarted(true);setReview(null);setMessage('')
  }
  const place=(index:number)=>{
    try{setGame(s=>playLocal(s,index));setReview(null);setMessage('')}
    catch(e){setMessage(e instanceof Error?e.message:'Illegal move.')}
  }
  const resign=()=>{
    if(!window.confirm(current+' resigns this round? '+localPlayerName(game,game.turn===BLACK?WHITE:BLACK)+' will win.'))return
    setGame(s=>resignLocal(s));setReview(null);setMessage('')
  }
  const restart=()=>{
    if(!window.confirm('Start a new local Reversi match? Current progress will be replaced.'))return
    setGame(freshLocal(1,game.names));setReview(null);setMessage('')
  }
  const end=(next:'online'|'library')=>{
    if(next==='online')onOnline()
    else onBack()
  }

  return <div className="rv-shell rv-local">
    <div className="rv-frame">
      <header className="rv-topbar">
        <button className="rv-back" onClick={()=>end('library')} type="button"><ArrowLeft size={17}/> All games</button>
        <span className="rv-brand"><Gamepad2 size={19}/> Reversi<span>.</span></span>
        <span className="rv-online rv-offline-label"><Users size={17}/> Same-device</span>
      </header>
      {!started?<main className="rv-entry">
        <section className="rv-intro">
          <span className="rv-eyebrow"><CircleDot size={16}/> TWO PLAYERS · ONE SCREEN</span>
          <h1>Pass the phone.<br/><em>Outthink each other.</em></h1>
          <p>Take turns on the same device. Black plays first, legal moves glow, and all captured discs flip automatically. No room code or internet connection is needed once the game loads.</p>
          <div className="rv-chips"><span><Users size={16}/> Local multiplayer</span><span><CheckCircle2 size={16}/> No database</span></div>
          <div className="rv-rules"><strong>Reversi rules</strong><p>Surround opponent discs in any direction to flip them. If you have no legal move, your turn passes. The player with more discs when both have no moves wins.</p></div>
        </section>
        <section className="rv-card rv-local-setup">
          <span className="rv-eyebrow">LOCAL MATCH</span>
          <h2>Who's playing?</h2>
          {(['Player 1','Player 2'] as const).map((label,i)=><label key={i} htmlFor={'rv-local-name-'+i}>{label}
            <input id={'rv-local-name-'+i} maxLength={20} value={names[i]} onChange={e=>setNames(s=>s.map((v,k)=>k===i?e.target.value:v) as [string,string])} autoComplete="off"/>
          </label>)}
          <p>Player 1 takes Black in round one. Colours swap on each rematch.</p>
          <button type="button" className="rv-primary" onClick={()=>start(false)}>Start local match <ArrowRight size={17}/></button>
          {saved&&<button type="button" className="rv-outline rv-local-resume" onClick={()=>start(true)}>Resume saved local match <RotateCcw size={17}/></button>}
          <button type="button" className="rv-local-switch" onClick={()=>end('online')}>Want to play from different phones? <strong>Online mode</strong></button>
        </section>
      </main>:<main className="rv-game">
        <div className="rv-room-heading">
          <div><span className="rv-eyebrow">LOCAL TWO-PLAYER · ROUND {game.round}</span>
            <h1>{game.phase==='finished'?'Round complete.':'The battle is on.'}</h1></div>
          <button type="button" className="rv-outline" onClick={()=>{setStarted(false);setReview(null);setSaved(game)}}><ArrowLeft size={17}/> Mode menu</button>
        </div>
        <section className="rv-scoreboard" aria-label="Local Reversi disc counts">
          {([BLACK,WHITE] as const).map(d=><div key={d} className={'rv-score '+(game.phase==='playing'&&game.turn===d?'rv-score-turn':'')}>
            <span aria-hidden="true" className={'rv-disc '+(d===BLACK?'rv-disc-black':'rv-disc-white')}/>
            <div><strong>{localPlayerName(game,d)}</strong><span>{discName(d).toUpperCase()}{game.phase==='playing'&&game.turn===d?' · TO MOVE':''}</span></div>
            <b>{d===BLACK?detail.scores.black:detail.scores.white}</b>
          </div>)}
        </section>
        <section className="rv-layout">
          <div className="rv-card rv-board-panel">
            <div className={'rv-turn-banner '+(!watching&&game.phase==='playing'?'active':'')} role="status" aria-live="polite">
              {watching?<><History size={22}/><div><strong>Viewing {review===0?'the starting board':'move '+review}</strong><span>Reviewing does not change your live match.</span></div></>:
                game.phase==='finished'?<><CheckCircle2 size={22}/><div><strong>{game.draw?"It's a draw!":win+' wins!'}</strong><span>{game.resignedBy?'Round ended by resignation.':'Black '+detail.scores.black+' · White '+detail.scores.white+'.'}</span></div></>:
                <><CircleDot size={22}/><div><strong>{current}'s turn — {discName(game.turn)}!</strong><span>Pass the device to {current} and choose a highlighted square.</span></div></>}
            </div>
            {!watching&&game.passed&&game.phase==='playing'&&<p className="rv-pass" role="status">{localPlayerName(game,game.passed)} had no legal move, so the turn passed automatically.</p>}
            <div className="rv-board-heading"><span>8 × 8 BOARD</span><span>{game.moves.length} moves · {detail.scores.empty} empty squares</span></div>
            <div className="rv-board-wrap">
              <div className="rv-board" role="grid" aria-label="Local Reversi board">
                {Array.from({length:8},(_,row)=><div key={row} className="rv-board-row" role="row">
                  {Array.from({length:8},(_,col)=>{
                    const index=row*8+col,value=board[index],legal=allowed.includes(index)
                    const isLast=last?.index===index,flipped=last?.flipped.includes(index)
                    const name=value===BLACK?'Black':value===WHITE?'White':'Empty'
                    return <button type="button" role="gridcell" key={index} disabled={!legal}
                      aria-label={'Row '+(row+1)+', column '+(col+1)+': '+name+(legal?', legal move':'')+(isLast?', last move':'')}
                      className={'rv-cell'+(legal?' rv-cell-legal':'')+(isLast?' rv-cell-last':'')+(flipped?' rv-cell-flipped':'')}
                      onClick={()=>place(index)}>
                      {value!==0?<span aria-hidden="true" className={'rv-disc '+(value===BLACK?'rv-disc-black':'rv-disc-white')}/>:legal?<span aria-hidden="true" className="rv-move-hint"/>:null}
                      {isLast&&<span className="rv-last-dot" aria-hidden="true"/>}
                    </button>
                  })}
                </div>)}
              </div>
            </div>
            <p className="rv-board-tip">{watching?'Select Live board below to continue.':
              game.phase==='finished'?'Start a rematch to swap colours.':'Tap the highlighted squares. Your moves are automatically saved in this browser.'}</p>
          </div>
          <aside className="rv-side">
            <div className="rv-card rv-stats">
              <span className="rv-eyebrow">THE SCORE</span><h2>Board control</h2>
              <div className="rv-score-bars"><span className="rv-black-bar" style={{flex:detail.scores.black||.01}}/><span className="rv-white-bar" style={{flex:detail.scores.white||.01}}/></div>
              <div className="rv-stat-row"><span>Black</span><strong>{detail.scores.black}</strong></div>
              <div className="rv-stat-row"><span>White</span><strong>{detail.scores.white}</strong></div>
              <div className="rv-stat-row"><span>Empty squares</span><strong>{detail.scores.empty}</strong></div>
            </div>
            <div className="rv-card rv-history">
              <div className="rv-history-title"><History size={18}/><h2>Move history</h2></div>
              <div className="rv-history-list" role="group" aria-label="Review moves">
                <button type="button" aria-pressed={review===0} onClick={()=>setReview(0)}>Start · 2–2</button>
                {game.moves.map((move,i)=><button key={i} type="button" aria-pressed={review===i+1} onClick={()=>setReview(i+1)}>
                  {i+1}. {discName(move.disc)} · {coordinate(move.index)} · {move.flipped.length} flipped
                </button>)}
              </div>
              <button className="rv-live" type="button" onClick={()=>setReview(null)} disabled={!watching}>Live board <ArrowRight size={15}/></button>
            </div>
            {game.phase==='playing'?<div className="rv-card rv-local-actions">
              <button type="button" className="rv-outline" onClick={resign} disabled={watching}><Flag size={17}/> Resign round</button>
              <button type="button" className="rv-outline" onClick={restart}><RotateCcw size={17}/> Restart match</button>
            </div>:<div className="rv-card rv-rematch">
              <CheckCircle2 size={29}/><h2>{game.draw?'Evenly matched.':'Ready for another round?'}</h2>
              <p>Black and White swap each round; no room is needed.</p>
              <button type="button" className="rv-primary" onClick={()=>{setGame(s=>rematchLocal(s));setReview(null)}}>
                Play another round <RotateCcw size={17}/>
              </button>
            </div>}
          </aside>
        </section>
        {message&&<div className="rv-alert" role="alert">{message}</div>}
      </main>}
      <footer className="rv-footer">playgrove<span>.</span> · Same screen, serious strategy.</footer>
    </div>
  </div>
}
