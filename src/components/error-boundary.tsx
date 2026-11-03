import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children?: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    console.error('[ErrorBoundary] Uncaught application error:', error, errorInfo)

    // Handle chunk load failures upon new deployments
    const errStr = (error?.message || '') + (error?.toString() || '')
    const isChunkLoadError =
      errStr.includes('Failed to fetch dynamically imported module') ||
      errStr.includes('Importing a module script failed') ||
      errStr.includes('error loading chunk')

    if (isChunkLoadError) {
      const storageKey = 'b2c_chunk_reload_attempts'
      const attempts = parseInt(sessionStorage.getItem(storageKey) || '0', 10)
      if (attempts < 2) {
        sessionStorage.setItem(storageKey, String(attempts + 1))
        window.location.reload()
      }
    }
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] w-full flex-col items-center justify-center p-6 text-center select-text">
          <div className="mx-auto flex max-w-lg flex-col items-center rounded-xl border border-destructive/30 bg-destructive/5 p-6 shadow-sm">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
              <AlertTriangle className="size-6" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              {this.props.fallbackTitle || 'Something went wrong'}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              An unexpected error occurred while rendering this view. You can reload the page or return to the dashboard.
            </p>

            {this.state.error && (
              <div className="mt-4 w-full rounded-md border border-border bg-surface p-3 text-left font-mono text-[11px] text-destructive overflow-x-auto max-h-36">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className="gap-1.5 text-xs cursor-pointer"
              >
                <RefreshCw className="size-3.5" />
                Reload page
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  this.handleReset()
                  window.location.href = '/dashboard'
                }}
                className="gap-1.5 text-xs cursor-pointer"
              >
                <Home className="size-3.5" />
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
