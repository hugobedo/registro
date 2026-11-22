import {
  Activity,
  ClipboardPlus,
  FileDown,
  LogOut,
  ShieldCheck,
  Users,
} from 'lucide-react';

export type ActiveWorkspaceView = 'pacientes' | 'entrada' | 'seguridad';

interface HeaderProps {
  activeView: ActiveWorkspaceView;
  patientCount: number;
  userEmail: string;
  isSyncingFromCache: boolean;
  onSelectView: (view: ActiveWorkspaceView) => void;
  onOpenReport: () => void;
  onSignOut: () => void;
}

export function Header({
  activeView,
  patientCount,
  userEmail,
  isSyncingFromCache,
  onSelectView,
  onOpenReport,
  onSignOut,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-15 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Zona 1: Marca institucional */}
        <button
          type="button"
          onClick={() => onSelectView('pacientes')}
          className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 text-left"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white">
            <Activity className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="font-[var(--font-display)] text-lg font-bold tracking-tight text-slate-900">
            ACE-MED
          </span>
        </button>

        {/* Zona 2: Navegación principal (escritorio y tableta) */}
        <nav
          aria-label="Navegación principal"
          className="hidden md:flex items-center gap-1.5"
        >
          <button
            type="button"
            onClick={() => onSelectView('pacientes')}
            aria-current={activeView === 'pacientes' ? 'page' : undefined}
            className={`inline-flex min-h-[40px] items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold tabular-nums transition-colors ${
              activeView === 'pacientes'
                ? 'bg-teal-700 text-white'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
            }`}
          >
            <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Pacientes ({patientCount})</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectView('entrada')}
            aria-current={activeView === 'entrada' ? 'page' : undefined}
            className={`inline-flex min-h-[40px] items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              activeView === 'entrada'
                ? 'bg-teal-700 text-white'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
            }`}
          >
            <ClipboardPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Formato de entrada</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectView('seguridad')}
            aria-current={activeView === 'seguridad' ? 'page' : undefined}
            className={`inline-flex min-h-[40px] items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              activeView === 'seguridad'
                ? 'bg-teal-700 text-white'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
            }`}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Respaldos y auditoría</span>
          </button>
        </nav>

        {/* Zona 3: Acción principal + sesión */}
        <div className="flex items-center gap-2 shrink-0">
          {isSyncingFromCache && (
            <span className="hidden xl:inline text-xs font-medium text-amber-800">
              Sincronizando...
            </span>
          )}

          <button
            type="button"
            onClick={onOpenReport}
            className="inline-flex min-h-[40px] items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-teal-700 bg-teal-50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-teal-900 transition-colors hover:bg-teal-100"
          >
            <FileDown className="h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
            <span className="hidden sm:inline">Informe PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>

          <button
            type="button"
            onClick={onSignOut}
            title={`Cerrar sesión (${userEmail})`}
            aria-label={`Cerrar sesión de ${userEmail}`}
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="hidden lg:inline">Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
}
