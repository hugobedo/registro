import { useState } from 'react';
import { Building2, Calendar, MessageSquare, Mic, Save, SpellCheck, X } from 'lucide-react';
import {
  FIELD_LABELS,
  HOSPITALIZATION_DISCHARGE_OPTIONS,
  getTreatmentHeader,
} from '../config/labels';
import { appendDictatedText, useVoiceDictation } from '../hooks/useVoiceDictation';
import {
  hasReadmission,
  type HospitalizationDischargeType,
  type PatientRecord,
  type ReviewableFieldKey,
} from '../types/patient';
import {
  formatIsoDateEs,
  formatTime12h,
  getCurrentTime24h,
  getTodayIsoDate,
  normalizeIsoDate,
  normalizeTime24h,
} from '../utils/time';
import { TimeInput12h } from './TimeInput12h';
import { VoiceMicButton } from './VoiceMicButton';

interface HospitalizedDischargeModalProps {
  patient: PatientRecord;
  isSaving?: boolean;
  onClose: () => void;
  onSaveHospitalizedDischarge: (
    patient: PatientRecord,
    updates: {
      tipoAltaHospitalizacion: Exclude<HospitalizationDischargeType, ''>;
      fechaSalida: string;
      horaSalida: string;
      horaSegundaSalida?: string;
      observacionesSalida: string;
    },
    openWhatsAppAfter: boolean
  ) => Promise<void> | void;
  onRequestSpellCheck: (
    fields: Partial<Record<ReviewableFieldKey, string>>,
    onApply: (corrected: Partial<Record<ReviewableFieldKey, string>>) => void
  ) => void;
}

export function HospitalizedDischargeModal({
  patient,
  isSaving = false,
  onClose,
  onSaveHospitalizedDischarge,
  onRequestSpellCheck,
}: HospitalizedDischargeModalProps) {
  const isReadmitted = hasReadmission(patient);
  const [tipoAlta, setTipoAlta] = useState<HospitalizationDischargeType>(
    patient.tipoAltaHospitalizacion || ''
  );
  const [fechaSalida, setFechaSalida] = useState<string>(
    normalizeIsoDate(patient.fechaSalida) || getTodayIsoDate()
  );
  const [horaSalida, setHoraSalida] = useState<string>(() => {
    const sourceTime = isReadmitted ? patient.horaSegundaSalida : patient.horaSalida;
    return sourceTime.trim() ? normalizeTime24h(sourceTime) : getCurrentTime24h();
  });
  const [observacionesSalida, setObservacionesSalida] = useState<string>(
    patient.observacionesSalida || ''
  );
  const [error, setError] = useState<string | null>(null);

  const voice = useVoiceDictation();

  const handleSubmit = async (openWhatsAppAfter: boolean) => {
    voice.stopDictation();

    if (tipoAlta !== 'alta_medica' && tipoAlta !== 'alta_voluntaria') {
      setError('Selecciona si corresponde a Alta médica o Alta voluntaria.');
      return;
    }

    const normalizedDate = normalizeIsoDate(fechaSalida) || getTodayIsoDate();
    const normalizedExit = normalizeTime24h(horaSalida);

    await onSaveHospitalizedDischarge(
      patient,
      {
        tipoAltaHospitalizacion: tipoAlta,
        fechaSalida: normalizedDate,
        horaSalida: isReadmitted ? patient.horaSalida : normalizedExit,
        ...(isReadmitted ? { horaSegundaSalida: normalizedExit } : {}),
        observacionesSalida,
      },
      openWhatsAppAfter
    );
  };

  const handleSpellCheck = () => {
    onRequestSpellCheck({ observacionesSalida }, (corrected) => {
      if (typeof corrected.observacionesSalida === 'string') {
        setObservacionesSalida(corrected.observacionesSalida);
      }
    });
  };

  const treatmentLabel = getTreatmentHeader(patient.tratamiento);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hospitalized-discharge-title"
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4"
    >
      <div className="flex max-h-[94dvh] w-full max-w-2xl flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-800">
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Hospitalización</span>
            </div>
            <h2
              id="hospitalized-discharge-title"
              className="mt-0.5 text-lg font-bold text-slate-900"
            >
              Salida del hospitalizado
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {treatmentLabel}:{' '}
              <span className="font-semibold text-slate-900">
                {patient.nombre.trim() || 'Sin nombre capturado'}
              </span>
              {formatIsoDateEs(patient.fechaRegistro) && (
                <>
                  {' '}
                  · Ingreso{' '}
                  <span className="font-mono tabular-nums">
                    {formatIsoDateEs(patient.fechaRegistro)}
                  </span>
                </>
              )}
              {formatTime12h(patient.horaEntrada) && (
                <>
                  {' '}
                  <span className="font-mono tabular-nums">
                    {formatTime12h(patient.horaEntrada)}
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              voice.stopDictation();
              onClose();
            }}
            aria-label="Cerrar ventana de salida del hospitalizado"
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Contenido desplazable */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          {voice.activeFieldId && (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-2 text-xs text-red-900">
                <Mic className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                <div>
                  <strong>Dictado por voz activo:</strong> el texto se añade al final sin borrar lo
                  escrito.
                  {voice.interimText && (
                    <p className="mt-0.5 italic text-red-800">“{voice.interimText}”</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={voice.stopDictation}
                className="min-h-[34px] shrink-0 rounded-lg bg-red-700 px-3 py-1 text-xs font-semibold text-white hover:bg-red-800"
              >
                Detener
              </button>
            </div>
          )}

          {voice.statusMessage && (
            <div
              role="status"
              className="flex items-start justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-950"
            >
              <span>{voice.statusMessage}</span>
              <button
                type="button"
                onClick={voice.clearStatusMessage}
                className="shrink-0 font-bold underline"
              >
                Cerrar
              </button>
            </div>
          )}

          {/* Tipo de alta (Alta médica / Alta voluntaria) */}
          <div>
            <span className="block text-sm font-semibold text-slate-800">
              {FIELD_LABELS.tipoAltaHospitalizacion}
            </span>
            <div
              role="radiogroup"
              aria-label="Seleccionar tipo de alta del hospitalizado"
              className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              {HOSPITALIZATION_DISCHARGE_OPTIONS.map((option) => {
                const selected = tipoAlta === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setTipoAlta(option.value);
                      if (error) setError(null);
                    }}
                    className={`rounded-xl border p-3.5 text-left transition-colors ${
                      selected
                        ? 'border-indigo-700 bg-indigo-50/80 text-indigo-950 ring-2 ring-indigo-700/15'
                        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-sm font-bold">{option.label}</div>
                    <div className="mt-0.5 text-xs text-slate-600">{option.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fecha de salida editable (hoy por defecto) */}
          <div>
            <label
              htmlFor="hosp-discharge-fechaSalida"
              className="block text-sm font-semibold text-slate-800"
            >
              {FIELD_LABELS.fechaSalida}
            </label>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Calendar
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="hosp-discharge-fechaSalida"
                  type="date"
                  value={fechaSalida}
                  onChange={(e) => {
                    const nextDate = normalizeIsoDate(e.target.value);
                    if (nextDate) {
                      setFechaSalida(nextDate);
                    }
                  }}
                  className="min-h-[46px] w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3.5 font-mono text-sm text-slate-900 focus:border-indigo-700"
                />
              </div>
              <button
                type="button"
                onClick={() => setFechaSalida(getTodayIsoDate())}
                className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
              >
                Hoy
              </button>
            </div>
          </div>

          {/* Hora de salida (12 h) */}
          <div>
            <label
              htmlFor="hosp-discharge-horaSalida"
              className="block text-sm font-semibold text-slate-800"
            >
              {isReadmitted ? FIELD_LABELS.segundaSalida : FIELD_LABELS.horaSalida} (12 h)
            </label>
            <TimeInput12h
              id="hosp-discharge-horaSalida"
              value={horaSalida}
              allowEmpty
              onChange={(nextVal) => setHoraSalida(nextVal)}
            />
          </div>

          {/* Observaciones */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="hosp-discharge-observaciones"
                className="block text-sm font-semibold text-slate-800"
              >
                {FIELD_LABELS.observaciones}
              </label>
              <VoiceMicButton
                fieldLabel="Observaciones"
                isActive={voice.activeFieldId === 'hosp_discharge_observaciones'}
                isSupported={voice.isSupported}
                onClick={() =>
                  voice.toggleDictation('hosp_discharge_observaciones', (transcript) =>
                    setObservacionesSalida((prev) => appendDictatedText(prev, transcript))
                  )
                }
              />
            </div>
            <textarea
              id="hosp-discharge-observaciones"
              rows={3}
              value={observacionesSalida}
              onChange={(e) => setObservacionesSalida(e.target.value)}
              placeholder="Registra novedades u observaciones de la salida (opcional)"
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-indigo-700"
            />
            <p className="mt-1 text-xs text-slate-500">
              Al guardar, el paciente saldrá del conteo de Hospitalización y se sumará a Atendidos,
              conservando su tipo de alta, fecha de salida y observaciones en el historial.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={handleSpellCheck}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-indigo-700/40 bg-indigo-50/70 px-3.5 py-2 text-xs font-semibold text-indigo-900 hover:bg-indigo-100"
            >
              <SpellCheck className="h-4 w-4 text-indigo-700" aria-hidden="true" />
              <span>Rectificar escritura y ortografía</span>
            </button>
          </div>

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
            onClick={() => {
              voice.stopDictation();
              onClose();
            }}
            className="inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSubmit(false)}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>{isSaving ? 'Guardando...' : 'Guardar salida'}</span>
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
