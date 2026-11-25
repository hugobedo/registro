import { useState } from 'react';
import { Ambulance, MessageSquare, Mic, Save, SpellCheck, X } from 'lucide-react';
import { FIELD_LABELS, getTreatmentHeader } from '../config/labels';
import { appendDictatedText, useVoiceDictation } from '../hooks/useVoiceDictation';
import {
  getPatientOutcome,
  hasReadmission,
  type PatientRecord,
  type ReviewableFieldKey,
} from '../types/patient';
import { formatTime12h, getCurrentTime24h, normalizeTime24h } from '../utils/time';
import {
  detectDoctorTitle,
  formatDoctorName,
  type DoctorTitle,
} from '../utils/titles';
import { TimeInput12h } from './TimeInput12h';
import { VoiceMicButton } from './VoiceMicButton';

interface TransferModalProps {
  patient: PatientRecord;
  isSaving?: boolean;
  onClose: () => void;
  onSaveTransfer: (
    patient: PatientRecord,
    updates: {
      destinoTraslado: string;
      horaSalida: string;
      horaSegundaSalida?: string;
      medico: string;
      observacionesSalida: string;
    },
    openWhatsAppAfter: boolean
  ) => Promise<void> | void;
  onRequestSpellCheck: (
    fields: Partial<Record<ReviewableFieldKey, string>>,
    onApply: (corrected: Partial<Record<ReviewableFieldKey, string>>) => void
  ) => void;
}

export function TransferModal({
  patient,
  isSaving = false,
  onClose,
  onSaveTransfer,
  onRequestSpellCheck,
}: TransferModalProps) {
  const isAlreadyTransferred = getPatientOutcome(patient) === 'trasladado';
  const isReadmitted = hasReadmission(patient);

  const [destinoTraslado, setDestinoTraslado] = useState(patient.destinoTraslado || '');
  const [horaSalida, setHoraSalida] = useState(() => {
    const sourceTime = isReadmitted ? patient.horaSegundaSalida : patient.horaSalida;
    return sourceTime.trim() ? normalizeTime24h(sourceTime) : getCurrentTime24h();
  });
  const [doctorTitle, setDoctorTitle] = useState<DoctorTitle>(() =>
    detectDoctorTitle(patient.medico, 'DR.')
  );
  const [medico, setMedico] = useState(patient.medico);
  const [observacionesSalida, setObservacionesSalida] = useState(
    patient.observacionesSalida || ''
  );

  const voice = useVoiceDictation();

  const formattedMedicoPreview = formatDoctorName(medico, doctorTitle);

  const handleSubmit = async (openWhatsAppAfter: boolean) => {
    voice.stopDictation();

    const finalMedico = medico.trim() ? formatDoctorName(medico, doctorTitle) : '';
    const normalizedExit = normalizeTime24h(horaSalida);

    await onSaveTransfer(
      patient,
      {
        destinoTraslado: destinoTraslado.trim(),
        horaSalida: isReadmitted ? patient.horaSalida : normalizedExit,
        ...(isReadmitted ? { horaSegundaSalida: normalizedExit } : {}),
        medico: finalMedico,
        observacionesSalida,
      },
      openWhatsAppAfter
    );
  };

  const handleSpellCheck = () => {
    onRequestSpellCheck(
      {
        destinoTraslado,
        medico: formattedMedicoPreview || medico,
        observacionesSalida,
      },
      (corrected) => {
        if (typeof corrected.destinoTraslado === 'string') {
          setDestinoTraslado(corrected.destinoTraslado);
        }
        if (typeof corrected.medico === 'string') setMedico(corrected.medico);
        if (typeof corrected.observacionesSalida === 'string') {
          setObservacionesSalida(corrected.observacionesSalida);
        }
      }
    );
  };

  const treatmentLabel = getTreatmentHeader(patient.tratamiento);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-title"
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4"
    >
      <div className="flex max-h-[94dvh] w-full max-w-2xl flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-800">
              <Ambulance className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Traslado</span>
            </div>
            <h2 id="transfer-title" className="mt-0.5 text-lg font-bold text-slate-900">
              {isAlreadyTransferred
                ? 'Editar datos de traslado'
                : 'Registrar traslado del paciente'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {treatmentLabel}:{' '}
              <span className="font-semibold text-slate-900">
                {patient.nombre.trim() || 'Sin nombre capturado'}
              </span>
              {formatTime12h(patient.horaEntrada) && (
                <>
                  {' '}
                  · Entrada{' '}
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
            aria-label="Cerrar ventana de traslado"
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

          {/* Destino del traslado */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="transfer-destino"
                className="block text-sm font-semibold text-slate-800"
              >
                {FIELD_LABELS.destinoTraslado}
              </label>
              <VoiceMicButton
                fieldLabel="Destino del traslado"
                isActive={voice.activeFieldId === 'transfer_destino'}
                isSupported={voice.isSupported}
                onClick={() =>
                  voice.toggleDictation('transfer_destino', (transcript) =>
                    setDestinoTraslado((prev) => appendDictatedText(prev, transcript))
                  )
                }
              />
            </div>

            <input
              id="transfer-destino"
              type="text"
              value={destinoTraslado}
              onChange={(e) => setDestinoTraslado(e.target.value)}
              placeholder="Ej. Hospital General, Clínica, unidad receptora..."
              autoComplete="off"
              className="mt-1.5 min-h-[46px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700"
            />
            <p className="mt-1 text-xs text-slate-500">
              Se mostrará en el formato del paciente y reportes únicamente si fue ingresado.
            </p>
          </div>

          {/* Hora de salida */}
          <div>
            <label
              htmlFor="transfer-horaSalida"
              className="block text-sm font-semibold text-slate-800"
            >
              {isReadmitted ? FIELD_LABELS.segundaSalida : FIELD_LABELS.horaSalida} (12 h)
            </label>
            <TimeInput12h
              id="transfer-horaSalida"
              value={horaSalida}
              allowEmpty
              onChange={setHoraSalida}
            />
          </div>

          {/* Médico con generación automática de DR. / DRA. */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="transfer-medico"
                className="block text-sm font-semibold text-slate-800"
              >
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
                          ? 'bg-blue-700 text-white'
                          : 'text-slate-700 hover:text-slate-950'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <VoiceMicButton
                  fieldLabel="Médico"
                  isActive={voice.activeFieldId === 'transfer_medico'}
                  isSupported={voice.isSupported}
                  onClick={() =>
                    voice.toggleDictation('transfer_medico', (transcript) =>
                      setMedico((prev) => appendDictatedText(prev, transcript))
                    )
                  }
                />
              </div>
            </div>

            <input
              id="transfer-medico"
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
              placeholder="Ej. Juan Pérez López (opcional)"
              autoComplete="off"
              className="mt-1.5 min-h-[46px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700"
            />
            {formattedMedicoPreview && (
              <p className="mt-1 text-xs font-semibold text-blue-800">
                Formato automático: {formattedMedicoPreview}
              </p>
            )}
          </div>

          {/* Observaciones */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="transfer-observaciones"
                className="block text-sm font-semibold text-slate-800"
              >
                {FIELD_LABELS.observaciones}
              </label>
              <VoiceMicButton
                fieldLabel="Observaciones"
                isActive={voice.activeFieldId === 'transfer_observaciones'}
                isSupported={voice.isSupported}
                onClick={() =>
                  voice.toggleDictation('transfer_observaciones', (transcript) =>
                    setObservacionesSalida((prev) => appendDictatedText(prev, transcript))
                  )
                }
              />
            </div>
            <textarea
              id="transfer-observaciones"
              rows={3}
              value={observacionesSalida}
              onChange={(e) => setObservacionesSalida(e.target.value)}
              placeholder="Observaciones del traslado (opcional)"
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-700"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={handleSpellCheck}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-blue-700/40 bg-blue-50/70 px-3.5 py-2 text-xs font-semibold text-blue-900 hover:bg-blue-100"
            >
              <SpellCheck className="h-4 w-4 text-blue-700" aria-hidden="true" />
              <span>Rectificar escritura y ortografía</span>
            </button>
          </div>
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
            className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>{isSaving ? 'Guardando...' : 'Guardar traslado'}</span>
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
