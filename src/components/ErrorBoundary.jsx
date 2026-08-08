import React from 'react';
import { Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    // Reset state and redirect to home
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.href = window.location.origin;
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom premium fallback UI
      return (
        <div className="container flex-center" style={{ minHeight: '100vh', flexDirection: 'column', padding: '20px' }}>
          <div className="glass-panel text-center" style={{ 
            maxWidth: '550px', 
            padding: '40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            borderColor: 'rgba(239, 68, 68, 0.3)',
            boxShadow: '0 8px 32px 0 rgba(239, 68, 68, 0.1)'
          }}>
            <div className="flex-center" style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: 'var(--color-danger)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              fontSize: '28px'
            }}>
              ⚠️
            </div>

            <h2 className="glow-text" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Error Inesperado
            </h2>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
              La aplicación ha detectado un problema al procesar los datos de conexión o al adjuntar un archivo. Para proteger tu privacidad, no se han guardado registros de este chat.
            </p>

            {this.state.error && (
              <div style={{
                width: '100%',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '10px',
                padding: '12px 16px',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                color: 'var(--color-danger)',
                textAlign: 'left',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '120px'
              }}>
                <strong>Detalle del error:</strong><br />
                {this.state.error.toString()}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '10px' }}>
              <button 
                onClick={this.handleReset}
                className="btn-glow"
                style={{ 
                  flex: 1, 
                  background: 'linear-gradient(135deg, var(--color-danger) 0%, #b91c1c 100%)',
                  boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)'
                }}
              >
                <Home size={18} />
                Regresar al Inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
