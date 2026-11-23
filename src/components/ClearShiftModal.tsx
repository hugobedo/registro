import { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileDown,
  Lock,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { verifyServerDeletePasscode } from '../services/cloudShiftService';
import type { PatientRecord } from '../types/patient';
import { formatIsoDateEs, formatTime12h } from '../utils/time';

interface ClearShiftModalProps {
  mode: 'all' | 'single';
  targetPatient?: PatientRecord | null;
  firebaseUser: User;
  patientCount: number;
  activeCount: number;
  onGenerateReportFirst: () => void;
  onExportJsonFirst: () => void;
  onConfirmDelete: (verifiedByEmail: string) => Promise<void>;
  onClose: () => void;
}

export function ClearShiftModal({
  mode,
  targetPatient = null,
  firebaseUser,
  patientCount,
  activeCount,
  onGenerateReportFirst,
  onExportJsonFirst,
  onConfirmDelete,
  onClose,
}: ClearShiftModalProps) {
  const [step, setStep] = useState<'password' | 'confirm'>('password');
  const [passcodeInput, setPasscodeInput] = useState('');
  const [verifiedByEmail, setVerifiedByEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [downloadedBeforeClear, setDownloadedBeforeClear] = useState(false);

  const isSingleMode = mode === 'single' && targetPatient !== null;

  const targetSummary = (() => {
    if (!targetPatient) return '';
    const parts: string[] = [];
    if (targetPatient.nombre.trim()) parts.push(targetPatient.nombre.trim());
    const dateText = formatIsoDateEs(targetPatient.fechaRegistro);
    if (dateText) parts.push(dateText);
    const entryText = formatTime12h(targetPatient.horaEntrada);
    if (entryText) parts.push(`Entrada ${entryText}`);
    return parts.join(' · ') || 'Registro seleccionado';
  })();

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!passcodeInput.trim()) {
      setErrorMessage('Ingresa la contraseña de autorización.');
      return;
    }

    setIsBusy(true);
    try {
      const result = await verifyServerDeletePasscode(firebaseUser, passcodeInput.trim());
      if (!result.authorized) {
        setErrorMessage(result.error || 'Contraseña incorrecta.');
        setPasscodeInput('');
        return;
      }

      setVerifiedByEmail(result.verifiedByEmail || firebaseUser.email || '');
      setPasscodeInput('');
      setStep('confirm');
    } catch {
      setErrorMessage('No se pudo validar la contraseña. Intenta nuevamente.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleFinalConfirmDelete = async () => {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await onConfirmDelete(verifiedByEmail || firebaseUser.email || '');
    } catch {
      setErrorMessage(
        isSingleMode
          ? 'No se pudo eliminar el registro. Verifica tus permisos de administrador.'
          : 'No se pudieron eliminar los registros. Verifica tus permisos de administrador.'
      );
      setIsBusy(false);
    }
  };

  const handleDownloadPdf = () => {
    onGenerateReportFirst();
    setDownloadedBeforeClear(true);
  };

  const handleExportJson = () => {
    onExportJsonFirst();
    setDownloadedBeforeClear(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="clear-shift-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4"
    >
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700">
              {step === 'confirm' ? (
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Lock className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
            <div>
              <h2 id="clear-shift-title" className="text-lg font-bold text-slate-900">
                {isSingleMode ? 'Eliminar registro individual' : 'Eliminar todos los registros'}
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">
                {step === 'confirm'
                  ? 'Paso 2 de 2 · Confirmación definitiva'
                  : 'Paso 1 de 2 · Contraseña de administrador requerida'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          {step === 'password' ? (
            <form onSubmit={handleVerifyPassword} className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">
                  {isSingleMode
                    ? 'Eliminación de registro protegida'
                    : 'Eliminación del historial protegida'}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {isSingleMode
                    ? `Ingresa la contraseña de autorización para eliminar el registro: ${targetSummary}.`
                    : 'Ingresa la contraseña de autorización para continuar con el borrado del historial completo de pacientes.'}
                </p>
              </div>

              <div>
                <label
                  htmlFor="delete-passcode-input"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Contraseña de autorización
                </label>
                <input
                  id="delete-passcode-input"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  value={passcodeInput}
                  onChange={(e) => {
                    setPasscodeInput(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Ingresa la contraseña"
                  className="mt-1.5 min-h-[46px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base tracking-widest text-slate-900 focus:border-teal-700"
                />
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-800"
                >
                  {errorMessage}
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  <Lock className="h-4 w-4" aria-hidden="true" />
                  <span>{isBusy ? 'Validando...' : 'Validar contraseña'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Paso 2: Confirmación explícita */
            <div className="space-y-4">
              <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-950">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert
                    className="mt-0.5 h-5 w-5 shrink-0 text-red-700"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-bold">
                      {isSingleMode
                        ? 'Confirmar eliminación de registro individual'
                        : 'Advertencia: se eliminarán todos los registros'}
                    </p>
                    {isSingleMode ? (
                      <p className="mt-1 text-xs leading-relaxed text-red-900">
                        Se eliminará permanentemente: <strong>{targetSummary}</strong>. Esta acción
                        no se puede deshacer.
                      </p>
                    ) : (
                      <>
                        <p className="mt-1 text-xs leading-relaxed text-red-900 tabular-nums">
                          Se borrarán <strong>{patientCount}</strong>{' '}
                          {patientCount === 1 ? 'registro de paciente' : 'registros de pacientes'}{' '}
                          de la base de datos compartida.
                        </p>
                        {activeCount > 0 && (
                          <p className="mt-1.5 text-xs font-bold text-amber-900 tabular-nums">
                            Atención: {activeCount}{' '}
                            {activeCount === 1
                              ? 'paciente todavía no tiene'
                              : 'pacientes todavía no tienen'}{' '}
                            salida registrada.
                          </p>
                        )}
                      </>
                    )}
                    <p className="mt-1.5 text-xs text-red-800">
                      Quedará registrado en auditoría que <strong>{verifiedByEmail}</strong>{' '}
                      autorizó esta eliminación.
                    </p>
                  </div>
                </div>
              </div>

              {/* Respaldo recomendado solo en borrado masivo */}
              {!isSingleMode && (
                <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/60 p-4">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Respaldo recomendado antes de eliminar
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Descarga el informe PDF y/o una copia JSON recuperable antes de limpiar el
                      historial.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800"
                    >
                      <FileDown className="h-4 w-4" aria-hidden="true" />
                      <span>Descargar PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportJson}
                      className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-teal-700 bg-white px-3 py-2 text-xs font-semibold text-teal-900 hover:bg-teal-50"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      <span>Respaldo JSON</span>
                    </button>
                  </div>

                  {downloadedBeforeClear && (
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      <span>Respaldo descargado correctamente.</span>
                    </p>
                  )}
                </div>
              )}

              {errorMessage && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-800"
                >
                  {errorMessage}
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isBusy}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleFinalConfirmDelete()}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {isBusy
                      ? 'Eliminando...'
                      : isSingleMode
                        ? 'Sí, eliminar registro'
                        : 'Sí, confirmar eliminación definitiva'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
