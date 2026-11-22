import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  friendlyMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      friendlyMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let friendlyMessage =
      'Ocurrió un inconveniente inesperado al sincronizar con la base de datos.';
    if (error.message.includes('Missing or insufficient permissions')) {
      friendlyMessage =
        'Tu cuenta aún no cuenta con permisos suficientes para esta operación o tu sesión expiró. Recarga o solicita autorización al responsable de turno.';
    } else if (error.message.includes('offline') || error.message.includes('network')) {
      friendlyMessage =
        'No se detectó conexión estable con la nube. Verifica tu acceso a internet e intenta nuevamente.';
    }
    return {
      hasError: true,
      friendlyMessage,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ACE-MED ErrorBoundary:', error.message, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  Error de conexión o permisos
                </h1>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {this.state.friendlyMessage}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={this.handleReload}
              className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Recargar sistema</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
