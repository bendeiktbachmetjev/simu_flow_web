import React from 'react';

export class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('SimuFlow render error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
            background: '#f8fafc',
            color: '#0f172a',
          }}
        >
          <div style={{ maxWidth: 480 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ fontSize: 14, opacity: 0.85, marginBottom: 12 }}>
              The app failed to load. Open the browser console (F12) for details, or try a hard refresh
              (Ctrl+Shift+R / Cmd+Shift+R).
            </p>
            <pre
              style={{
                fontSize: 12,
                padding: 12,
                background: '#fff',
                borderRadius: 8,
                overflow: 'auto',
                border: '1px solid #e2e8f0',
              }}
            >
              {String(this.state.error?.message || this.state.error)}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
