import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Catches render-time errors so the app shows a message instead of a blank page. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    // Surface in the console for debugging.
    console.error('App crashed:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="glass-card" style={{ maxWidth: 560, padding: 32 }}>
            <h1 className="font-serif" style={{ fontSize: '1.4rem', color: 'var(--ink)', marginBottom: 8 }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 16 }}>
              The app hit an unexpected error. Details below:
            </p>
            <pre
              style={{
                background: 'rgba(192,57,43,0.08)', color: 'var(--red)', padding: 14,
                borderRadius: 12, fontSize: '0.78rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}
            >
              {this.state.error.message}
            </pre>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
