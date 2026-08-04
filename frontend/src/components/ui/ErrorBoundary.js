'use client';

import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, resetKey: props.resetKey };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (nextProps.resetKey && nextProps.resetKey !== prevState.resetKey) {
      return { hasError: false, resetKey: nextProps.resetKey };
    }
    return null;
  }

  componentDidCatch(error, info) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('CRM UI error:', error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
          <h1 className="text-xl font-semibold text-black mb-2">Something went wrong</h1>
          <p className="text-sm text-zoho-muted mb-6 max-w-md">
            The page hit an unexpected error. Refresh to try again, or return to the dashboard.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-primary-sm"
              onClick={() => window.location.reload()}
            >
              Refresh
            </button>
            <a href="/dashboard/" className="btn-secondary-sm">Go to dashboard</a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
