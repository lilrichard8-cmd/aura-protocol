import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null; info: ErrorInfo | null }

export default class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to console for inspection
    // eslint-disable-next-line no-console
    console.error('[PageErrorBoundary]', error, info);
    this.setState({ info });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-background">
          <div className="max-w-2xl w-full bg-card border border-red-500/30 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-red-500 mb-3">⚠️ Page crashed</h2>
            <p className="text-sm text-muted-foreground mb-4">
              The page hit a runtime error. The full stack is below — please screenshot this and send it to the dev so we can fix it.
            </p>
            <pre className="bg-secondary rounded-xl p-4 text-xs overflow-auto max-h-80 whitespace-pre-wrap">
              <strong>{this.state.error.name}: {this.state.error.message}</strong>
              {'\n\n'}
              {this.state.error.stack}
              {this.state.info?.componentStack ? '\n\n— Component stack —' + this.state.info.componentStack : ''}
            </pre>
            <button
              onClick={() => this.setState({ error: null, info: null })}
              className="mt-4 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-sm font-medium"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
