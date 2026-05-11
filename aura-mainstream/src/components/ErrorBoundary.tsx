import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

/**
 * Generic in-page ErrorBoundary.
 * Renders children unless a child throws during render — in which case it shows
 * the error name, message, full JS stack and React component stack in red.
 *
 * Use this to surface runtime crashes that would otherwise white-screen the page.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
    this.setState({ info });
  }

  reset = () => this.setState({ error: null, info: null });

  render() {
    if (this.state.error) {
      const { error, info } = this.state;
      return (
        <div className="p-6">
          <div className="max-w-3xl mx-auto bg-red-500/5 border border-red-500/40 rounded-2xl p-5 shadow">
            <h2 className="text-lg font-bold text-red-500 mb-2">
              ⚠️ Render error caught by ErrorBoundary
            </h2>
            <p className="text-sm text-red-500/90 mb-3">
              <strong>{error.name}:</strong> {error.message}
            </p>
            <pre className="bg-background/80 border border-red-500/20 rounded-lg p-3 text-xs overflow-auto max-h-96 whitespace-pre-wrap text-red-600 dark:text-red-400">
              {error.stack || '(no stack)'}
              {info?.componentStack ? '\n\n— Component stack —' + info.componentStack : ''}
            </pre>
            <button
              onClick={this.reset}
              className="mt-3 px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-sm font-medium"
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
