import React from 'react';
import './ErrorBoundary.css';

/**
 * Error boundary component catching unexpected UI crashes and presenting fallback view.
 *
 * Args:
 *   children (ReactNode): Tree that should never take the whole page down.
 *   compact (boolean, optional): Section sized fallback instead of full screen.
 *   onReset (Function, optional): Drops the current import and returns to the drop zone.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled UI error:', error, errorInfo);
  }

  /**
   * Retries the failed subtree without reloading the whole page.
   *
   * Returns:
   *   void
   */
  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  /**
   * Hands control back to the upload screen so a different export can be tried.
   *
   * Returns:
   *   void
   */
  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className={`error-boundary-wrap${this.props.compact ? ' is-compact' : ''}`}>
          <h2 className="error-boundary-title">
            Something went wrong rendering this section.
          </h2>
          <p className="error-boundary-msg">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <div className="error-boundary-actions">
            <button
              className="error-boundary-btn"
              onClick={this.handleRetry}
            >
              Try again
            </button>
            {this.props.onReset && (
              <button
                className="error-boundary-btn is-secondary"
                onClick={this.handleReset}
              >
                Upload another ZIP
              </button>
            )}
            <button
              className="error-boundary-btn is-secondary"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
