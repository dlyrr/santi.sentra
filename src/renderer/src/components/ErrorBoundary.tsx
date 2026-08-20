import React from "react";

interface State {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  children?: React.ReactNode;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("[ErrorBoundary] error", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 24,
            color: "var(--color-text-primary)",
            background: "var(--color-app-bg)",
            height: "100vh",
            boxSizing: "border-box",
          }}
        >
          <h2 style={{ marginTop: 0 }}>An unexpected error occurred</h2>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              color: "var(--color-text-secondary)",
            }}
          >
            {this.state.error?.message ?? String(this.state.error)}
          </pre>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              marginTop: 12,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--color-border-strong)",
              background: "var(--color-surface-hover)",
              color: "var(--color-text-primary)",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <details style={{ color: "var(--color-text-muted)", marginTop: 12 }}>
            <summary>Stack trace</summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {this.state.error?.stack}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
