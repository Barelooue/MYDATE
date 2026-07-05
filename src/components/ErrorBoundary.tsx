import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  title?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
          <h3 className="text-sm font-semibold text-red-200">
            {this.props.title ?? '页面加载出错'}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-red-100/90">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="mt-4 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15"
          >
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
