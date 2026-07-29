import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('VestFirma Kanban:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-loading">
          <p>Algo deu errado ao carregar o Kanban.</p>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', maxWidth: 420, textAlign: 'center' }}>
            {this.state.error.message}
          </p>
          <button
            type="button"
            className="btn primary"
            style={{ marginTop: '1rem' }}
            onClick={() => window.location.reload()}
          >
            Recarregar página
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
