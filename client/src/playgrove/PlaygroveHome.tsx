import { ArrowRight, Gamepad2, Grid3X3, Hash, RotateCcw, ShieldCheck, Sprout, Users, Wifi } from 'lucide-react'

type Props = {
  hasSavedSession: boolean
  onPlayFourcast: () => void
  onPlaySudoku: () => void
  onResumeFourcast: () => void
}

export default function PlaygroveHome({ hasSavedSession, onPlayFourcast, onPlaySudoku, onResumeFourcast }: Props) {
  return <div className="pg-shell">
    <div className="pg-background-orb pg-orb-one" aria-hidden="true" />
    <div className="pg-background-orb pg-orb-two" aria-hidden="true" />
    <div className="pg-frame">
      <header className="pg-header">
        <div className="pg-brand" aria-label="Playgrove home">
          <div className="pg-brand-icon" aria-hidden="true"><Gamepad2 size={23} strokeWidth={2.3} /></div>
          <span>playgrove<span className="pg-brand-period">.</span></span>
        </div>
        <span className="pg-header-label" aria-current="page">Game Library</span>
      </header>

      <main id="main-content" className="pg-main">
        <section className="pg-hero" aria-labelledby="pg-hero-title">
          <div className="pg-hero-content">
            <span className="pg-kicker"><Sprout size={16} /> YOUR LITTLE CORNER OF FUN</span>
            <h1 id="pg-hero-title">Good games.<br /><span>Great company.</span></h1>
            <p>Play with a friend or enjoy a quiet solo challenge. A little fun for every mood.</p>
            <div className="pg-hero-perks" aria-label="How Playgrove works">
              <span><Users size={15} /> Play together or solo</span>
              <span><ShieldCheck size={15} /> Easy to start</span>
              <span><Wifi size={15} /> Play online</span>
            </div>
          </div>
          <div className="pg-hero-art" aria-hidden="true">
            <div className="pg-art-glow" />
            <div className="pg-art-swatch pg-art-swatch-one">0</div>
            <div className="pg-art-swatch pg-art-swatch-two">4</div>
            <div className="pg-art-swatch pg-art-swatch-three">2</div>
            <div className="pg-art-swatch pg-art-swatch-four">9</div>
            <span className="pg-art-sparkle pg-art-sparkle-one">✳</span>
            <span className="pg-art-sparkle pg-art-sparkle-two">✦</span>
            <p>Same room.<br />Different places.</p>
          </div>
        </section>

        {hasSavedSession && <section className="pg-resume" aria-label="Saved Fourcast room">
          <div className="pg-resume-mark"><RotateCcw size={20} /></div>
          <div className="pg-resume-copy">
            <strong>Have an unfinished Fourcast room?</strong>
            <span>Return to your saved session if the room is still available.</span>
          </div>
          <button className="pg-resume-button" type="button" onClick={onResumeFourcast}>
            Resume Fourcast <ArrowRight size={16} />
          </button>
        </section>}

        <section className="pg-library" aria-labelledby="pg-library-title">
          <div className="pg-section-heading">
            <div>
              <span className="pg-section-eyebrow">THE GAME LIBRARY</span>
              <h2 id="pg-library-title">Explore games</h2>
            </div>
            <span className="pg-game-count">02 GAMES AVAILABLE</span>
          </div>
          <div className="pg-games-grid">
            <article className="pg-game-card">
              <div className="pg-card-top">
                <div className="pg-game-symbol"><Hash size={39} strokeWidth={2.4} /></div>
                <span className="pg-availability"><span className="pg-availability-dot" /> Available</span>
              </div>
              <div className="pg-game-description">
                <span className="pg-card-kicker">THE ORIGINAL NUMBER DUEL</span>
                <h3>Fourcast</h3>
                <p>Crack your opponent's secret four-digit number before they crack yours.</p>
              </div>
              <div className="pg-game-features">
                <span><Users size={16} /> 2 players</span>
                <span><Wifi size={16} /> Online multiplayer</span>
              </div>
              <button className="pg-play-button" type="button" onClick={onPlayFourcast}>
                Play Fourcast <ArrowRight size={18} />
              </button>
            </article>
            <article className="pg-game-card pg-sudoku-card">
              <div className="pg-card-top">
                <div className="pg-game-symbol pg-sudoku-symbol"><Grid3X3 size={37} strokeWidth={2.0} /></div>
                <span className="pg-availability"><span className="pg-availability-dot" /> Available</span>
              </div>
              <div className="pg-game-description">
                <span className="pg-card-kicker">THE CLASSIC LOGIC PUZZLE</span>
                <h3>Sudoku</h3>
                <p>Find a little space to think. Fill the grid with numbers and enjoy the challenge.</p>
              </div>
              <div className="pg-game-features">
                <span><Users size={16} /> Solo play</span>
                <span><Grid3X3 size={16} /> 3 difficulty levels</span>
              </div>
              <button className="pg-play-button pg-sudoku-play" type="button" onClick={onPlaySudoku}>
                Play Sudoku <ArrowRight size={18} />
              </button>
            </article>
            <div className="pg-coming-soon">
              <div className="pg-coming-icon"><Sprout size={30} strokeWidth={1.8} /></div>
              <h3>More games are<br />growing here.</h3>
              <p>Fresh challenges are on their way. Until then, battle a friend or solve a Sudoku.</p>
              <span className="pg-coming-label">COMING SOON</span>
            </div>
          </div>
        </section>
      </main>
      <footer className="pg-footer"><span>playgrove<span className="pg-footer-period">.</span></span><span>Made for every kind of player · 2026</span></footer>
    </div>
  </div>
}