import { useState } from 'react';
import { MessageSquare, Mic, Save, SpellCheck, X } from 'lucide-react';
import {
  EXIT_OUTCOME_OPTIONS,
  FIELD_LABELS,
  getTreatmentHeader,
} from '../config/labels';
import { appendDictatedText, useVoiceDictation } from '../hooks/useVoiceDictation';
import {
  hasReadmission,
  hasRegisteredExit,
  isExitOutcome,
  type ExitOutcome,
  type PatientRecord,
  type ReviewableFieldKey,
} from '../types/patient';
import { formatTime12h, getCurrentTime24h, normalizeTime24h } from '../utils/time';
import {
  detectDoctorTitle,
  formatDoctorName,
  formatNurseName,
  type DoctorTitle,
} from '../utils/titles';
import { TimeInput12h } from './TimeInput12h';
import { VoiceMicButton } from './VoiceMicButton';

interface DischargeModalProps {
  patient: PatientRecord;
  isSaving?: boolean;
  onClose: () => void;
  onSaveDischarge: (
    patient: PatientRecord,
    updates: {
      horaSalida: string;
      horaSegundaSalida?: string;
      estadoEgreso: ExitOutcome;
      destinoTraslado?: string;
      observacionesSalida: string;
      medico: string;
      enfermera: string;
      diagnostico: string;
    },
    openWhatsAppAfter: boolean
  ) => Promise<void> | void;
  onRequestSpellCheck: (
    fields: Partial<Record<ReviewableFieldKey, string>>,
    onApply: (corrected: Partial<Record<ReviewableFieldKey, string>>) => void
  ) => void;
}

export function DischargeModal({
  patient,
  isSaving = false,
  onClose,
  onSaveDischarge,
  onRequestSpellCheck,
}: DischargeModalProps) {
  const alreadyExited = hasRegisteredExit(patient);
  const isReadmitted = hasReadmission(patient);

  const [estadoEgreso, setEstadoEgreso] = useState<ExitOutcome>(
    isExitOutcome(patient.estadoEgreso) ? patient.estadoEgreso : 'atendido'
  );
  const [horaSalida, setHoraSalida] = useState(() => {
    const sourceTime = isReadmitted ? patient.horaSegundaSalida : patient.horaSalida;
    return sourceTime.trim() ? normalizeTime24h(sourceTime) : getCurrentTime24h();
  });

  // Requisito #8: Al registrar salida, el campo de observaciones inicia COMPLETAMENTE VACÍO.
  // Nunca copia observaciones de ingreso ni coloca textos predeterminados.
  const [observacionesSalida, setObservacionesSalida] = useState(
    alreadyExited ? patient.observacionesSalida || '' : ''
  );

  const [destinoTraslado, setDestinoTraslado] = useState(patient.destinoTraslado || '');
  const [doctorTitle, setDoctorTitle] = useState<DoctorTitle>(() =>
    detectDoctorTitle(patient.medico, 'DR.')
  );
  const [medico, setMedico] = useState(patient.medico);
  const [enfermera, setEnfermera] = useState(patient.enfermera);
  const [diagnostico, setDiagnostico] = useState(patient.diagnostico);
  const [error, setError] = useState<string | null>(null);

  const voice = useVoiceDictation();

  const formattedMedicoPreview = formatDoctorName(medico, doctorTitle);
  const formattedEnfermeraPreview = formatNurseName(enfermera);

  const handleSubmit = async (openWhatsAppAfter: boolean) => {
    voice.stopDictation();

    const finalMedico = formatDoctorName(medico, doctorTitle);
    const finalEnfermera = formatNurseName(enfermera);

    const normalizedExit = normalizeTime24h(horaSalida);

    await onSaveDischarge(
      patient,
      {
        horaSalida: isReadmitted ? patient.horaSalida : normalizedExit,
        ...(isReadmitted ? { horaSegundaSalida: normalizedExit } : {}),
        estadoEgreso,
        destinoTraslado: estadoEgreso === 'trasladado' ? destinoTraslado.trim() : '',
        observacionesSalida,
        medico: finalMedico,
        enfermera: finalEnfermera,
        diagnostico,
      },
      openWhatsAppAfter
    );
  };

  const handleSpellCheck = () => {
    const fieldsToCheck: Partial<Record<ReviewableFieldKey, string>> = {
      observacionesSalida,
      medico: formattedMedicoPreview || medico,
      enfermera: formattedEnfermeraPreview || enfermera,
      diagnostico,
    };
    if (estadoEgreso === 'trasladado' && destinoTraslado.trim()) {
      fieldsToCheck.destinoTraslado = destinoTraslado;
    }

    onRequestSpellCheck(fieldsToCheck, (corrected) => {
      if (typeof corrected.destinoTraslado === 'string') {
        setDestinoTraslado(corrected.destinoTraslado);
      }
      if (typeof corrected.observacionesSalida === 'string') {
        setObservacionesSalida(corrected.observacionesSalida);
      }
      if (typeof corrected.medico === 'string') setMedico(corrected.medico);
      if (typeof corrected.enfermera === 'string') setEnfermera(corrected.enfermera);
      if (typeof corrected.diagnostico === 'string') setDiagnostico(corrected.diagnostico);
    });
  };

  const treatmentLabel = getTreatmentHeader(patient.tratamiento);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discharge-title"
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4"
    >
      <div className="flex max-h-[94dvh] w-full max-w-2xl flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id="discharge-title" className="text-lg font-bold text-slate-900">
              {isReadmitted
                ? alreadyExited
                  ? 'Editar segunda salida del paciente'
                  : 'Registrar segunda salida del paciente'
                : alreadyExited
                  ? 'Editar formato de salida'
                  : 'Registrar salida del paciente'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {treatmentLabel}:{' '}
              <span className="font-semibold text-slate-900">
                {patient.nombre.trim() || 'Sin nombre capturado'}
              </span>{' '}
              · {isReadmitted ? '1ª Entrada' : 'Entrada'}{' '}
              <span className="font-mono tabular-nums">
                {formatTime12h(patient.horaEntrada)}
              </span>
              {isReadmitted && formatTime12h(patient.horaSalida) && (
                <>
                  {' '}
                  · 1ª Salida{' '}
                  <span className="font-mono tabular-nums">
                    {formatTime12h(patient.horaSalida)}
                  </span>
                </>
              )}
              {isReadmitted && formatTime12h(patient.horaSegundaEntrada) && (
                <>
                  {' '}
                  · 2ª Entrada{' '}
                  <span className="font-mono tabular-nums text-violet-900">
                    {formatTime12h(patient.horaSegundaEntrada)}
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
            aria-label="Cerrar ventana de salida"
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Contenido desplazable */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          {/* Indicador de micrófono activo */}
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
                className="min-h-[34px] rounded-lg bg-red-700 px-3 py-1 text-xs font-semibold text-white hover:bg-red-800 shrink-0"
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

          {/* Estado de egreso diferenciado */}
          <div>
            <span className="block text-sm font-semibold text-slate-800">
              {FIELD_LABELS.estadoEgreso}
            </span>
            <div
              role="radiogroup"
              aria-label="Seleccionar condición de salida del paciente"
              className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              {EXIT_OUTCOME_OPTIONS.map((option) => {
                const selected = estadoEgreso === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setEstadoEgreso(option.value)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? 'border-teal-700 bg-teal-50/80 text-teal-950'
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

          {/* Destino del traslado (visible solo cuando el egreso es traslado) */}
          {estadoEgreso === 'trasladado' && (
            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="modal-destinoTraslado"
                  className="block text-sm font-semibold text-slate-800"
                >
                  {FIELD_LABELS.destinoTraslado}
                </label>
                <VoiceMicButton
                  fieldLabel="Destino del traslado"
                  isActive={voice.activeFieldId === 'discharge_destino'}
                  isSupported={voice.isSupported}
                  onClick={() =>
                    voice.toggleDictation('discharge_destino', (transcript) =>
                      setDestinoTraslado((prev) => appendDictatedText(prev, transcript))
                    )
                  }
                />
              </div>
              <input
                id="modal-destinoTraslado"
                type="text"
                value={destinoTraslado}
                onChange={(e) => setDestinoTraslado(e.target.value)}
                placeholder="Ej. Hospital General, Clínica, unidad receptora (opcional)"
                autoComplete="off"
                className="mt-1.5 min-h-[46px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700"
              />
            </div>
          )}

          {/* Hora de salida */}
          <div>
            <label
              htmlFor="modal-horaSalida"
              className="block text-sm font-semibold text-slate-800"
            >
              {isReadmitted ? FIELD_LABELS.segundaSalida : FIELD_LABELS.horaSalida} (12 h)
            </label>
            <TimeInput12h
              id="modal-horaSalida"
              value={horaSalida}
              allowEmpty
              onChange={(nextVal) => {
                setHoraSalida(nextVal);
                if (error) setError(null);
              }}
            />
          </div>

          {/* Médico con generación automática de DR. / DRA. */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="modal-medico" className="block text-sm font-semibold text-slate-800">
                {FIELD_LABELS.medico}
              </label>
              <div className="flex items-center gap-2">
                <div
                  role="radiogroup"
                  aria-label="Seleccionar título DR. o DRA."
                  className="inline-grid grid-cols-2 gap-0.5 rounded-lg border border-slate-200 bg-slate-100 p-0.5"
                >
                  {(['DR.', 'DRA.'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={doctorTitle === t}
                      onClick={() => {
                        setDoctorTitle(t);
                        if (medico.trim()) {
                          setMedico(formatDoctorName(medico, t));
                        }
                      }}
                      className={`min-h-[34px] rounded-md px-3 text-xs font-bold transition-colors ${
                        doctorTitle === t
                          ? 'bg-teal-700 text-white'
                          : 'text-slate-700 hover:text-slate-950'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <VoiceMicButton
                  fieldLabel="Médico"
                  isActive={voice.activeFieldId === 'discharge_medico'}
                  isSupported={voice.isSupported}
                  onClick={() =>
                    voice.toggleDictation('discharge_medico', (transcript) =>
                      setMedico((prev) => appendDictatedText(prev, transcript))
                    )
                  }
                />
              </div>
            </div>

            <input
              id="modal-medico"
              type="text"
              value={medico}
              onChange={(e) => {
                const next = e.target.value;
                setDoctorTitle(detectDoctorTitle(next, doctorTitle));
                setMedico(next);
              }}
              onBlur={() => {
                if (medico.trim()) {
                  setMedico(formatDoctorName(medico, doctorTitle));
                }
              }}
              placeholder="Ej. Juan Pérez López (se agrega DR. o DRA. automáticamente)"
              autoComplete="off"
              className="mt-1.5 min-h-[46px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700"
            />
            {formattedMedicoPreview && (
              <p className="mt-1 text-xs font-semibold text-teal-800">
                Formato automático: {formattedMedicoPreview}
              </p>
            )}
          </div>

          {/* Personal de enfermería con generación automática de ENF. */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="modal-enfermera"
                className="block text-sm font-semibold text-slate-800"
              >
                {FIELD_LABELS.enfermera}
              </label>
              <VoiceMicButton
                fieldLabel="Personal de enfermería"
                isActive={voice.activeFieldId === 'discharge_enfermera'}
                isSupported={voice.isSupported}
                onClick={() =>
                  voice.toggleDictation('discharge_enfermera', (transcript) =>
                    setEnfermera((prev) => appendDictatedText(prev, transcript))
                  )
                }
              />
            </div>

            <input
              id="modal-enfermera"
              type="text"
              value={enfermera}
              onChange={(e) => setEnfermera(e.target.value)}
              onBlur={() => {
                if (enfermera.trim()) {
                  setEnfermera(formatNurseName(enfermera));
                }
              }}
              placeholder="Ej. Carlos Hernández López (se agrega ENF. automáticamente)"
              autoComplete="off"
              className="mt-1.5 min-h-[46px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700"
            />
            {formattedEnfermeraPreview && (
              <p className="mt-1 text-xs font-semibold text-teal-800">
                Formato automático: {formattedEnfermeraPreview}
              </p>
            )}
          </div>

          {/* Diagnóstico */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="modal-diagnostico"
                className="block text-sm font-semibold text-slate-800"
              >
                {FIELD_LABELS.diagnostico}
              </label>
              <VoiceMicButton
                fieldLabel="Diagnóstico"
                isActive={voice.activeFieldId === 'discharge_diagnostico'}
                isSupported={voice.isSupported}
                onClick={() =>
                  voice.toggleDictation('discharge_diagnostico', (transcript) =>
                    setDiagnostico((prev) => appendDictatedText(prev, transcript))
                  )
                }
              />
            </div>
            <textarea
              id="modal-diagnostico"
              rows={2}
              value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)}
              placeholder="Diagnóstico indicado por el personal médico (dejar vacío si no aplica)"
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-teal-700"
            />
            <p className="mt-1 text-xs text-slate-500">
              ACE-MED nunca sugiere ni agrega diagnósticos automáticamente.
            </p>
          </div>

          {/* Observaciones de salida: COMPLETAMENTE VACÍO por defecto, manual o dictado por voz */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="modal-observaciones"
                className="block text-sm font-semibold text-slate-800"
              >
                {FIELD_LABELS.observaciones} (salida)
              </label>
              <VoiceMicButton
                fieldLabel="Observaciones de salida"
                isActive={voice.activeFieldId === 'discharge_observaciones'}
                isSupported={voice.isSupported}
                onClick={() =>
                  voice.toggleDictation('discharge_observaciones', (transcript) =>
                    setObservacionesSalida((prev) => appendDictatedText(prev, transcript))
                  )
                }
              />
            </div>
            <textarea
              id="modal-observaciones"
              rows={3}
              value={observacionesSalida}
              onChange={(e) => setObservacionesSalida(e.target.value)}
              placeholder="Escribe o dicta las observaciones independientes de esta salida..."
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-teal-700"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={handleSpellCheck}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-teal-700/40 bg-teal-50/70 px-3.5 py-2 text-xs font-semibold text-teal-900 hover:bg-teal-100"
            >
              <SpellCheck className="h-4 w-4 text-teal-700" aria-hidden="true" />
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
