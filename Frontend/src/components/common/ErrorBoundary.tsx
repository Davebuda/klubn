import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
          <div className="max-w-2xl w-full space-y-6">
            <div className="relative rounded-3xl border border-red-500/30 bg-gradient-to-br from-red-950/20 via-zinc-900 to-black p-8">
              {/* Glow effect */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600/20 via-orange-600/20 to-purple-600/20 rounded-3xl blur-xl" />

              <div className="relative space-y-4">
                {/* Icon */}
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30">
                  <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>

                {/* Title */}
                <div>
                  <h1 className="text-3xl font-black bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent">
                    Something went wrong
                  </h1>
                  <p className="text-gray-400 mt-2">
                    We encountered an unexpected error. Don't worry, we've logged it and we'll look into it.
                  </p>
                </div>

                {/* Error details (only in development) */}
                {import.meta.env.DEV && this.state.error && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-300 transition-colors">
                      Technical Details
                    </summary>
                    <div className="mt-3 p-4 rounded-xl bg-black/60 border border-white/10">
                      <pre className="text-xs text-red-300 font-mono overflow-auto whitespace-pre-wrap break-words">
                        {this.state.error.toString()}
                        {'\n\n'}
                        {this.state.error.stack}
                      </pre>
                    </div>
                  </details>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-red-600 to-[#5D1725] text-white hover:shadow-[0_0_30px_rgba(220,38,38,0.6)] hover:scale-105 transition-all"
                  >
                    Reload Page
                  </button>
                  <button
                    onClick={() => window.history.back()}
                    className="px-6 py-3 rounded-xl font-bold text-sm tracking-wide bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all"
                  >
                    Go Back
                  </button>
                </div>
              </div>
            </div>

            {/* Help text */}
            <div className="text-center text-sm text-gray-600">
              If this problem persists, please{' '}
              <a href="/contact" className="text-orange-400 hover:text-orange-300 transition-colors">
                contact support
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
