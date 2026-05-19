import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    error: null
  };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, info);
  }

  render() {
    // @ts-ignore
    if (this.state.error) {
      return (
        <div style={{ padding: 32, background: "#1a0000", borderRadius: 12, border: "2px solid #ef4444", margin: 16 }}>
          <div style={{ color: "#ef4444", fontWeight: 800, fontSize: 16, marginBottom: 8 }}>⚠ Error en el módulo</div>
          <div style={{ color: "#fca5a5", fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap", marginBottom: 16 }}>
            {String(this.state.error)}
          </div>
          <button
            // @ts-ignore
            onClick={() => this.setState({ error: null })}
            style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 700 }}
          >
            Reintentar
          </button>
        </div>
      );
    }
    // @ts-ignore
    return this.props.children;
  }
}
