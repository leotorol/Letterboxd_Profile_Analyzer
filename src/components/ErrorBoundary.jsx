import React from 'react';
import './ErrorBoundary.css';

/**
 * Error boundary component catching unexpected UI crashes and presenting fallback view.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // la puta madre se ha roto algo, grab error state
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled UI error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-wrap">
          <h2 className="error-boundary-title">
            Something went wrong rendering this section.
          </h2>
          <p className="error-boundary-msg">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            className="error-boundary-btn"
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
