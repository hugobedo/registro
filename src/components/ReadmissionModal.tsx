import { useState } from 'react';
import { Calendar, Clock, MessageSquare, RotateCcw, Save, UserCheck, X } from 'lucide-react';
import {
  FIELD_LABELS,
  getHospitalizationDischargeLabel,
  getOutcomeLabel,
  getTreatmentHeader,
} from '../config/labels';
import { getPatientOutcome, type PatientRecord } from '../types/patient';
import {
  formatIsoDateEs,
  formatTime12h,
  getCurrentTime24h,
  getTodayIsoDate,
  normalizeIsoDate,
  normalizeTime24h,
} from '../utils/time';
import { TimeInput12h } from './TimeInput12h';

interface ReadmissionModalProps {
  patient: PatientRecord;
  isSaving?: boolean;
  onClose: () => void;
  onSaveReadmission: (
    patient: PatientRecord,
    updates: {
      horaSegundaEntrada: string;
      fechaSegundaEntrada: string;
    },
    openWhatsAppAfter: boolean
  ) => Promise<void> | void;
}

export function ReadmissionModal({
  patient,
  isSaving = false,
  onClose,
  onSaveReadmission,
}: ReadmissionModalProps) {
  const [horaSegundaEntrada, setHoraSegundaEntrada] = useState<string>(() =>
    patient.horaSegundaEntrada.trim() && patient.estadoEgreso === 'en_atencion'
      ? normalizeTime24h(patient.horaSegundaEntrada)
      : getCurrentTime24h()
  );
  const [fechaSegundaEntrada, setFechaSegundaEntrada] = useState<string>(() =>
    normalizeIsoDate(patient.fechaSegundaEntrada) && patient.estadoEgreso === 'en_atencion'
      ? normalizeIsoDate(patient.fechaSegundaEntrada)
      : getTodayIsoDate()
  );
  const [error, setError] = useState<string | null>(null);

  const treatmentLabel = getTreatmentHeader(patient.tratamiento);
  const firstEntryFormatted = formatTime12h(patient.horaEntrada);
  const firstExitFormatted = formatTime12h(patient.horaSalida);
  const firstDateFormatted = formatIsoDateEs(patient.fechaRegistro);
  const firstExitDateFormatted = formatIsoDateEs(patient.fechaSalida);
  const previousOutcome = getPatientOutcome(patient);
  const dischargeTypeLabel = getHospitalizationDischargeLabel(patient.tipoAltaHospitalizacion);

  const existingDetails: Array<{ label: string; value: string; fullWidth?: boolean }> = [
    { label: treatmentLabel, value: patient.nombre.trim() },
    { label: FIELD_LABELS.edad, value: patient.edad.trim() },
    { label: FIELD_LABELS.procedencia, value: patient.procedencia.trim() },
    { label: FIELD_LABELS.estadoEgreso + ' previo', value: getOutcomeLabel(previousOutcome) },
    { label: FIELD_LABELS.tipoAltaHospitalizacion, value: dischargeTypeLabel },
    { label: FIELD_LABELS.motivoVisita, value: patient.motivoVisita.trim(), fullWidth: true },
    { label: FIELD_LABELS.destinoTraslado, value: patient.destinoTraslado.trim(), fullWidth: true },
    { label: 'Observaciones de ingreso', value: patient.observaciones.trim(), fullWidth: true },
    { label: FIELD_LABELS.medico, value: patient.medico.trim() },
    { label: FIELD_LABELS.enfermera, value: patient.enfermera.trim() },
    { label: FIELD_LABELS.diagnostico, value: patient.diagnostico.trim(), fullWidth: true },
    {
      label: FIELD_LABELS.observacionesSalida,
      value: patient.observacionesSalida.trim(),
      fullWidth: true,
    },
  ].filter((item) => item.value.length > 0);

  const handleSubmit = async (openWhatsAppAfter: boolean) => {
    const normalizedTime = normalizeTime24h(horaSegundaEntrada);
    if (!normalizedTime) {
      setError('Selecciona una hora válida para la segunda entrada.');
      return;
    }
    const normalizedDate = normalizeIsoDate(fechaSegundaEntrada) || getTodayIsoDate();

    await onSaveReadmission(
      patient,
      {
        horaSegundaEntrada: normalizedTime,
        fechaSegundaEntrada: normalizedDate,
      },
      openWhatsAppAfter
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="readmission-title"
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4"
    >
      <div className="flex max-h-[94dvh] w-full max-w-2xl flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet-800">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reingreso</span>
            </div>
            <h2 id="readmission-title" className="mt-0.5 text-lg font-bold text-slate-900">
              Reingreso de paciente
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Vincula la nueva visita al expediente existente sin duplicar al paciente ni alterar el
              total real.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de reingreso"
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Contenido desplazable en el orden exacto: 1. Primera entrada -> 2. Segunda entrada -> 3. Datos del paciente */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          {/* 1. Primera entrada */}
          <section
            aria-labelledby="readmission-first-visit"
            className="rounded-xl border border-slate-200 bg-slate-50/80 p-4"
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Clock className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <h3 id="readmission-first-visit">1. Primera entrada (visita anterior)</h3>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
                <div className="text-xs font-semibold text-slate-500">
                  {FIELD_LABELS.horaEntrada}
                </div>
                <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-slate-900">
                  {firstEntryFormatted || 'Sin hora registrada'}
                </div>
                {firstDateFormatted && (
                  <div className="mt-0.5 font-mono text-xs tabular-nums text-slate-500">
                    Fecha: {firstDateFormatted}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
                <div className="text-xs font-semibold text-slate-500">
                  {FIELD_LABELS.horaSalida}
                </div>
                <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-teal-900">
                  {firstExitFormatted || 'Sin salida registrada'}
                </div>
                {firstExitDateFormatted && (
                  <div className="mt-0.5 font-mono text-xs tabular-nums text-slate-500">
                    Fecha de salida: {firstExitDateFormatted}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 2. Segunda entrada */}
          <section
            aria-labelledby="readmission-second-visit"
            className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-3.5"
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-900">
              <RotateCcw className="h-3.5 w-3.5 text-violet-700" aria-hidden="true" />
              <h3 id="readmission-second-visit">2. Segunda entrada (nuevo ingreso)</h3>
            </div>

            <div>
              <label
                htmlFor="readmission-horaSegundaEntrada"
                className="block text-sm font-semibold text-slate-800"
              >
                {FIELD_LABELS.segundaEntrada} (12 h)
              </label>
              <TimeInput12h
                id="readmission-horaSegundaEntrada"
                value={horaSegundaEntrada}
                onChange={(nextVal) => {
                  setHoraSegundaEntrada(nextVal);
                  if (error) setError(null);
                }}
              />
            </div>

            <div>
              <label
                htmlFor="readmission-fechaSegundaEntrada"
                className="block text-xs font-semibold text-slate-700"
              >
                {FIELD_LABELS.fechaSegundaEntrada}
              </label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <div className="relative min-w-[190px] flex-1">
                  <Calendar
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="readmission-fechaSegundaEntrada"
                    type="date"
                    value={fechaSegundaEntrada}
                    onChange={(e) => {
                      const nextDate = normalizeIsoDate(e.target.value);
                      if (nextDate) {
                        setFechaSegundaEntrada(nextDate);
                      }
                    }}
                    className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 font-mono text-sm text-slate-900 focus:border-violet-700"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setFechaSegundaEntrada(getTodayIsoDate())}
                  className="inline-flex min-h-[42px] items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                >
                  Hoy
                </button>
              </div>
            </div>

            <p className="text-xs text-violet-950/80">
              Al guardar, el paciente pasará a <strong>Activos</strong> hasta registrar su segunda
              salida y se conservarán intactas su primera entrada y primera salida.
            </p>
          </section>

          {/* 3. Datos del paciente (conservados intactos) */}
          <section
            aria-labelledby="readmission-patient-data"
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <UserCheck className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
              <h3 id="readmission-patient-data">3. Datos del paciente (conservados)</h3>
            </div>

            {existingDetails.length > 0 ? (
              <dl className="mt-3 grid grid-cols-1 gap-2.5 text-sm sm:grid-cols-2">
                {existingDetails.map((item) => (
                  <div key={item.label} className={item.fullWidth ? 'sm:col-span-2' : undefined}>
                    <dt className="text-xs font-semibold text-slate-500">{item.label}</dt>
                    <dd className="mt-0.5 font-medium text-slate-900 break-words">{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                Este expediente no tiene datos adicionales capturados todavía.
              </p>
            )}
          </section>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-800"
            >
              {error}
            </div>
          )}
        </div>

        {/* Pie de acciones */}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSubmit(false)}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-60"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>{isSaving ? 'Guardando...' : 'Guardar reingreso'}</span>
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSubmit(true)}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            <span>Guardar y abrir WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
}
