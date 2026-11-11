import { Component, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  onBack: () => void
}

type State = { failed: boolean }

/**
 * A failed lazy game import (or unexpected screen render error) must not take
 * the entire game hub down. Remount this boundary for each selected route.
 */
export default class GameRouteBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children

    return <main className="pg-route-error" role="alert">
      <div className="pg-route-error-card">
        <h1>We couldn't open this game.</h1>
        <p>The game files may not have loaded correctly. Your saved progress and room details have not been intentionally cleared.</p>
        <div className="pg-route-error-actions">
          <button type="button" onClick={() => window.location.reload()}>Try again</button>
          <button type="button" onClick={this.props.onBack}>Back to Game Library</button>
        </div>
      </div>
    </main>
  }
}
