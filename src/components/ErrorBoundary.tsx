import React from 'react'

interface State { error: Error | null }

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; name?: string },
  State
> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name ?? 'Unknown'}]`, error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (error) {
      return (
        <div style={{
          padding: 24, color: '#f87171',
          background: 'rgba(239,68,68,0.07)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 12, margin: 16, fontFamily: 'monospace'
        }}>
          <p style={{ fontWeight: 700, marginBottom: 8 }}>
            ⚠ {this.props.name ?? 'Page'} crashed
          </p>
          <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', color: '#fca5a5', marginBottom: 12 }}>
            {error.message}
          </pre>
          <button
            onClick={this.reset}
            style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #f87171', background: 'transparent', color: '#f87171', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
