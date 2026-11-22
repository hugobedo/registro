import { Activity, Clock, Cloud, LogIn, LogOut, Send, ShieldCheck, UserCheck } from 'lucide-react';
import { ADMIN_EMAIL, DEFAULT_SHIFT_SUPERVISOR } from '../config/labels';
import type { AccessRequestRecord } from '../types/patient';
import { formatShortDateEs, formatTime12h } from '../utils/time';

interface AuthGateProps {
  mode: 'loading' | 'signed_out' | 'pending_approval';
  userEmail?: string | null;
  userDisplayName?: string | null;
  accessRequest?: AccessRequestRecord | null;
  isSubmittingRequest?: boolean;
  requestFeedback?: { type: 'ok' | 'error'; text: string } | null;
  authError?: string | null;
  isSigningIn?: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onSubmitAccessRequest?: () => void;
}

function formatRequestDate(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${formatShortDateEs(date)} · ${formatTime12h(`${hh}:${mm}`)}`;
}

export function AuthGate({
  mode,
  userEmail,
  userDisplayName,
  accessRequest,
  isSubmittingRequest,
  requestFeedback,
  authError,
  isSigningIn,
  onSignIn,
  onSignOut,
  onSubmitAccessRequest,
}: AuthGateProps) {
  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Activity className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-lg font-bold text-slate-900">ACE-MED</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Conectando con la base de datos clínica en la nube...
          </p>
        </div>
      </div>
    );
  }

  if (mode === 'pending_approval') {
    const hasPendingRequest = accessRequest?.status === 'pendiente';
    const wasRejected = accessRequest?.status === 'rechazada';
    const wasRevoked = accessRequest?.status === 'aprobada';

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-800">
              <UserCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                Tu acceso está pendiente de autorización
              </h1>
              <p className="text-xs font-medium text-slate-500">
                Sistema clínico compartido ACE-MED
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-2">
            <p>
              Iniciaste sesión como{' '}
              <span className="font-semibold text-slate-900">
                {userDisplayName ? `${userDisplayName} (${userEmail})` : userEmail}
              </span>
              .
            </p>
            <p className="text-xs leading-relaxed text-slate-600">
              Para proteger la privacidad de los registros de pacientes, el administrador del sistema (
              <span className="font-semibold text-slate-800">{DEFAULT_SHIFT_SUPERVISOR}</span> ·{' '}
              <span className="font-mono">{ADMIN_EMAIL}</span>) debe aprobar tu solicitud antes de
              habilitar el acceso.
            </p>
            <p className="text-xs text-slate-500">
              Mientras tu cuenta no esté autorizada, no podrás consultar, descargar, modificar ni
              eliminar registros de pacientes.
            </p>
          </div>

          {hasPendingRequest && (
            <div
              role="status"
              className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950"
            >
              <div className="flex items-center gap-2 font-bold">
                <Clock className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                <span>Solicitud de acceso enviada (pendiente)</span>
              </div>
              <p className="mt-1 text-amber-900">
                Fecha de solicitud:{' '}
                <span className="font-mono">{formatRequestDate(accessRequest.requestedAtIso)}</span>
                . En cuanto seas autorizado, esta pantalla abrirá automáticamente el sistema.
              </p>
            </div>
          )}

          {wasRejected && (
            <div
              role="status"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900"
            >
              <p className="font-bold">Tu solicitud anterior fue rechazada.</p>
              <p className="mt-1">
                Si necesitas ingresar al sistema, puedes enviar una nueva solicitud de acceso.
              </p>
            </div>
          )}

          {wasRevoked && (
            <div
              role="status"
              className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950"
            >
              <p className="font-bold">Tu acceso anterior fue revocado.</p>
              <p className="mt-1">
                Puedes volver a enviar una solicitud de acceso para que el administrador la revise.
              </p>
            </div>
          )}

          {requestFeedback && (
            <div
              role={requestFeedback.type === 'error' ? 'alert' : 'status'}
              className={`mt-4 rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
                requestFeedback.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900'
              }`}
            >
              {requestFeedback.text}
            </div>
          )}

          {!hasPendingRequest && onSubmitAccessRequest && (
            <button
              type="button"
              onClick={onSubmitAccessRequest}
              disabled={isSubmittingRequest}
              className="mt-5 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-60"
            >
              <Send className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {isSubmittingRequest
                  ? 'Enviando solicitud...'
                  : wasRejected || wasRevoked
                    ? 'Volver a solicitar acceso'
                    : 'Solicitar acceso'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onSignOut}
            className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Cambiar de cuenta</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center p-4 sm:p-6">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white">
            <Activity className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">ACE-MED</h1>
            <p className="text-xs font-semibold text-teal-800">
              Sistema de registro y control de pacientes
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-slate-600">
          Accede con tu cuenta de Google autorizada para consultar y actualizar la base de datos
          compartida en tiempo real desde computadora, tableta o teléfono celular.
        </p>

        <div className="mt-5 space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
          <div className="flex items-start gap-2.5">
            <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
            <span>
              <strong>Sincronización en la nube:</strong> todos los dispositivos comparten la misma
              base de datos sin duplicar registros.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
            <span>
              <strong>Encargado de turno:</strong> {DEFAULT_SHIFT_SUPERVISOR}
            </span>
          </div>
        </div>

        {authError && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
          >
            {authError}
          </div>
        )}

        <button
          type="button"
          onClick={onSignIn}
          disabled={isSigningIn}
          className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-60"
        >
          <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{isSigningIn ? 'Iniciando sesión...' : 'Iniciar sesión con Google'}</span>
        </button>

        <p className="mt-4 text-center text-xs text-slate-500">
          Tus registros locales previos se conservarán y podrás migrarlos a la nube al entrar.
        </p>
      </div>
    </div>
  );
}
