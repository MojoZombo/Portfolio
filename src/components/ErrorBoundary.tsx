import React, { ErrorInfo } from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-slate-50 dark:bg-[#141C28] text-slate-900 dark:text-slate-100 font-sans">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0c121e] p-6 sm:p-8 space-y-4">
            <div className="space-y-1.5">
              <p className="font-mono text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold">
                Viewport Recovery
              </p>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Something went wrong
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                An unexpected rendering error occurred. Reload the page to restore the portfolio view.
              </p>
            </div>
            {this.state.error?.message && (
              <pre className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900 text-[11px] font-mono text-slate-600 dark:text-slate-400 overflow-x-auto whitespace-pre-wrap">
                {this.state.error.message}
              </pre>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-ripple inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-medium cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
