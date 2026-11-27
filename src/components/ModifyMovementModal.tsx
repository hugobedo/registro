import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Calendar,
  Mic,
  RotateCcw,
  Save,
  SpellCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  EXIT_OUTCOME_OPTIONS,
  FIELD_LABELS,
  HOSPITALIZATION_DISCHARGE_OPTIONS,
  getTreatmentHeader,
} from '../config/labels';
import { appendDictatedText, useVoiceDictation } from '../hooks/useVoiceDictation';
import {
  getPatientOutcome,
  hasDistinctDischargeDoctor,
  hasDistinctDischargeNurse,
  hasReadmission,
  type HospitalizationDischargeType,
  type PatientOutcome,
  type PatientRecord,
  type ReviewableFieldKey,
} from '../types/patient';
import {
  formatIsoDateEs,
  formatTime12h,
  getTodayIsoDate,
  normalizeIsoDate,
  normalizeTime24h,
} from '../utils/time';
import {
  detectDoctorTitle,
  formatDoctorName,
  formatNurseName,
  type DoctorTitle,
} from '../utils/titles';
import { TimeInput12h } from './TimeInput12h';
import { VoiceMicButton } from './VoiceMicButton';

interface ModifyMovementModalProps {
  patient: PatientRecord;
  isSaving?: boolean;
  onClose: () => void;
  onSaveMovement: (
    patient: PatientRecord,
    updates: {
      estadoEgreso: PatientOutcome;
      horaSalida: string;
      fechaSalida: string;
      tipoAltaHospitalizacion: HospitalizationDischargeType;
      destinoTraslado: string;
      removeReadmission: boolean;
      fechaSegundaEntrada: string;
      horaSegundaEntrada: string;
      horaSegundaSalida: string;
      medico: string;
      enfermera: string;
      medicoSalida: string;
      enfermeraSalida: string;
      diagnostico: string;
      observacionesSalida: string;
    }
  ) => Promise<void> | void;
  onRequestSpellCheck: (
    fields: Partial<Record<ReviewableFieldKey, string>>,
    onApply: (corrected: Partial<Record<ReviewableFieldKey, string>>) => void
  ) => void;
}

const MOVEMENT_OPTIONS: ReadonlyArray<{
  value: PatientOutcome;
  label: string;
  description: string;
}> = [
  {
    value: 'en_atencion',
    label: 'Activo (En atención)',
    description: 'Sin salida registrada. Revierte un egreso, traslado u hospitalización erróneo.',
  },
  ...EXIT_OUTCOME_OPTIONS.map((opt) => ({
    value: opt.value as PatientOutcome,
    label: opt.label,
    description: opt.description,
  })),
];

export function ModifyMovementModal({
  patient,
  isSaving = false,
  onClose,
  onSaveMovement,
  onRequestSpellCheck,
}: ModifyMovementModalProps) {
  const initialOutcome = getPatientOutcome(patient);
  const initialHasReadmission = hasReadmission(patient);
  const initialHasDistinctStaff =
    hasDistinctDischargeDoctor(patient) || hasDistinctDischargeNurse(patient);

  const [estadoEgreso, setEstadoEgreso] = useState<PatientOutcome>(initialOutcome);
  const [removeReadmission, setRemoveReadmission] = useState<boolean>(false);
  const [fechaSegundaEntrada, setFechaSegundaEntrada] = useState<string>(
    normalizeIsoDate(patient.fechaSegundaEntrada) || getTodayIsoDate()
  );
  const [horaSegundaEntrada, setHoraSegundaEntrada] = useState<string>(
    patient.horaSegundaEntrada.trim() ? normalizeTime24h(patient.horaSegundaEntrada) : ''
  );
  const [horaSegundaSalida, setHoraSegundaSalida] = useState<string>(
    patient.horaSegundaSalida.trim() ? normalizeTime24h(patient.horaSegundaSalida) : ''
  );

  const [horaSalida, setHoraSalida] = useState<string>(
    patient.horaSalida.trim() ? normalizeTime24h(patient.horaSalida) : ''
  );
  const [destinoTraslado, setDestinoTraslado] = useState<string>(patient.destinoTraslado || '');
  const [tipoAlta, setTipoAlta] = useState<HospitalizationDischargeType>(
    patient.tipoAltaHospitalizacion || ''
  );
  const [fechaSalida, setFechaSalida] = useState<string>(
    normalizeIsoDate(patient.fechaSalida) || getTodayIsoDate()
  );

  const [doctorTitle, setDoctorTitle] = useState<DoctorTitle>(() =>
    detectDoctorTitle(patient.medico, 'DR.')
  );
  const [medico, setMedico] = useState<string>(patient.medico || '');
  const [enfermera, setEnfermera] = useState<string>(patient.enfermera || '');

  const [sameStaffAsAdmission, setSameStaffAsAdmission] = useState<boolean>(
    !initialHasDistinctStaff
  );
  const [dischargeDoctorTitle, setDischargeDoctorTitle] = useState<DoctorTitle>(() =>
    detectDoctorTitle(patient.medicoSalida || patient.medico, 'DR.')
  );
  const [medicoSalida, setMedicoSalida] = useState<string>(patient.medicoSalida || '');
  const [enfermeraSalida, setEnfermeraSalida] = useState<string>(patient.enfermeraSalida || '');

  const [diagnostico, setDiagnostico] = useState<string>(patient.diagnostico || '');
  const [observacionesSalida, setObservacionesSalida] = useState<string>(
    patient.observacionesSalida || ''
  );
  const [error, setError] = useState<string | null>(null);

  const voice = useVoiceDictation();

  const keepingReadmission = initialHasReadmission && !removeReadmission;
  const showHospitalizationDischargeSection = estadoEgreso === 'atendido';
  const showDischargeStaffToggle =
    estadoEgreso === 'atendido' && (Boolean(tipoAlta) || initialHasDistinctStaff);

  const formattedMedicoPreview = formatDoctorName(medico, doctorTitle);
  const formattedEnfermeraPreview = formatNurseName(enfermera);
  const formattedMedicoSalidaPreview = formatDoctorName(medicoSalida, dischargeDoctorTitle);
  const formattedEnfermeraSalidaPreview = formatNurseName(enfermeraSalida);

  const handleToggleRemoveReadmission = () => {
    setError(null);
    setRemoveReadmission((prev) => {
      const nextRemove = !prev;
      if (nextRemove && estadoEgreso === 'en_atencion' && horaSalida.trim()) {
        setEstadoEgreso('atendido');
      }
      return nextRemove;
    });
  };

  const handleSubmit = async () => {
    voice.stopDictation();

    if (keepingReadmission && !horaSegundaEntrada.trim()) {
      setError(
        'Indica la hora de segunda entrada o marca «Eliminar reingreso erróneo» para quitar el reingreso.'
      );
      return;
    }

    const finalMedico = formatDoctorName(medico, doctorTitle);
    const finalEnfermera = formatNurseName(enfermera);

    let finalMedicoSalida = '';
    let finalEnfermeraSalida = '';
    if (showDischargeStaffToggle && tipoAlta && !sameStaffAsAdmission) {
      const candidateMedico = formatDoctorName(medicoSalida, dischargeDoctorTitle);
      const candidateEnfermera = formatNurseName(enfermeraSalida);
      if (candidateMedico && candidateMedico.toLowerCase() !== finalMedico.toLowerCase()) {
        finalMedicoSalida = candidateMedico;
      }
      if (candidateEnfermera && candidateEnfermera.toLowerCase() !== finalEnfermera.toLowerCase()) {
        finalEnfermeraSalida = candidateEnfermera;
      }
    }

    await onSaveMovement(patient, {
      estadoEgreso,
      horaSalida:
        estadoEgreso === 'en_atencion' && !keepingReadmission
          ? ''
          : normalizeTime24h(horaSalida),
      fechaSalida:
        estadoEgreso === 'atendido' && tipoAlta
          ? normalizeIsoDate(fechaSalida) || getTodayIsoDate()
          : '',
      tipoAltaHospitalizacion: estadoEgreso === 'atendido' ? tipoAlta : '',
      destinoTraslado: estadoEgreso === 'trasladado' ? destinoTraslado.trim() : '',
      removeReadmission,
      fechaSegundaEntrada: keepingReadmission
        ? normalizeIsoDate(fechaSegundaEntrada) || getTodayIsoDate()
        : '',
      horaSegundaEntrada: keepingReadmission ? normalizeTime24h(horaSegundaEntrada) : '',
      horaSegundaSalida:
        keepingReadmission && estadoEgreso !== 'en_atencion'
          ? normalizeTime24h(horaSegundaSalida)
          : '',
      medico: finalMedico,
      enfermera: finalEnfermera,
      medicoSalida: finalMedicoSalida,
      enfermeraSalida: finalEnfermeraSalida,
      diagnostico,
      observacionesSalida,
    });
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
    if (showDischargeStaffToggle && !sameStaffAsAdmission) {
      if (medicoSalida.trim()) {
        fieldsToCheck.medicoSalida = formattedMedicoSalidaPreview || medicoSalida;
      }
      if (enfermeraSalida.trim()) {
        fieldsToCheck.enfermeraSalida = formattedEnfermeraSalidaPreview || enfermeraSalida;
      }
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
      if (typeof corrected.medicoSalida === 'string') setMedicoSalida(corrected.medicoSalida);
      if (typeof corrected.enfermeraSalida === 'string') {
        setEnfermeraSalida(corrected.enfermeraSalida);
      }
      if (typeof corrected.diagnostico === 'string') setDiagnostico(corrected.diagnostico);
    });
  };

  const treatmentLabel = getTreatmentHeader(patient.tratamiento);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modify-movement-title"
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4"
    >
      <div className="flex max-h-[94dvh] w-full max-w-2xl flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-800">
              <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Corrección de movimiento</span>
            </div>
            <h2 id="modify-movement-title" className="mt-0.5 text-lg font-bold text-slate-900">
              Modificar registro
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {treatmentLabel}:{' '}
              <span className="font-semibold text-slate-900">
                {patient.nombre.trim() || 'Sin nombre capturado'}
              </span>
              {formatIsoDateEs(patient.fechaRegistro) && (
                <>
                  {' '}
                  · Fecha{' '}
                  <span className="font-mono tabular-nums">
                    {formatIsoDateEs(patient.fechaRegistro)}
                  </span>
                </>
              )}
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
            aria-label="Cerrar ventana de modificar registro"
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

          {/* 1. Corrección o eliminación de reingreso (solo si el paciente tiene reingreso registrado) */}
          {initialHasReadmission && (
            <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-1.5 text-sm font-bold text-violet-950">
                  <RotateCcw className="h-4 w-4 text-violet-700" aria-hidden="true" />
                  <span>Datos de reingreso</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleRemoveReadmission}
                  className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    removeReadmission
                      ? 'border-violet-700 bg-white text-violet-900 hover:bg-violet-100'
                      : 'border-red-300 bg-white text-red-800 hover:bg-red-50'
                  }`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {removeReadmission
                      ? 'Conservar datos de reingreso'
                      : 'Eliminar reingreso erróneo'}
                  </span>
                </button>
              </div>

              {removeReadmission ? (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                  <span>
                    Al guardar se eliminarán únicamente los datos de reingreso (2ª entrada, 2ª
                    salida y marca de reingreso), conservando el paciente y su primera visita sin
                    duplicados.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="modify-fechaSegundaEntrada"
                      className="block text-xs font-semibold text-violet-950"
                    >
                      {FIELD_LABELS.fechaSegundaEntrada}
                    </label>
                    <div className="relative mt-1">
                      <Calendar
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        id="modify-fechaSegundaEntrada"
                        type="date"
                        value={fechaSegundaEntrada}
                        onChange={(e) => {
                          const next = normalizeIsoDate(e.target.value);
                          if (next) setFechaSegundaEntrada(next);
                        }}
                        className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 font-mono text-sm text-slate-900 focus:border-violet-700"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="modify-horaSegundaEntrada"
                      className="block text-xs font-semibold text-violet-950"
                    >
                      {FIELD_LABELS.segundaEntrada} (12 h)
                    </label>
                    <TimeInput12h
                      id="modify-horaSegundaEntrada"
                      value={horaSegundaEntrada}
                      allowEmpty
                      onChange={(nextVal) => {
                        setHoraSegundaEntrada(nextVal);
                        if (error) setError(null);
                      }}
                    />
                  </div>
                  {estadoEgreso !== 'en_atencion' && (
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="modify-horaSegundaSalida"
                        className="block text-xs font-semibold text-violet-950"
                      >
                        {FIELD_LABELS.segundaSalida} (12 h)
                      </label>
                      <TimeInput12h
                        id="modify-horaSegundaSalida"
                        value={horaSegundaSalida}
                        allowEmpty
                        onChange={(nextVal) => setHoraSegundaSalida(nextVal)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 2. Selector de tipo de movimiento */}
          <div>
            <span className="block text-sm font-semibold text-slate-800">
              Tipo de movimiento / estado del paciente
            </span>
            <div
              role="radiogroup"
              aria-label="Seleccionar tipo de movimiento del paciente"
              className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              {MOVEMENT_OPTIONS.map((option) => {
                const selected = estadoEgreso === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setEstadoEgreso(option.value);
                      if (error) setError(null);
                    }}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? 'border-teal-700 bg-teal-50/80 text-teal-950 ring-2 ring-teal-700/15'
                        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-sm font-bold">{option.label}</div>
                    <div className="mt-0.5 text-xs text-slate-600">{option.description}</div>
                  </button>
                );
              })}
            </div>
            {estadoEgreso === 'en_atencion' && !keepingReadmission && (
              <p className="mt-1.5 text-xs text-amber-900">
                Al guardar como Activo se limpiarán los datos de salida, traslado o alta
                hospitalaria erróneos, conservando el ingreso original del paciente.
              </p>
            )}
          </div>

          {/* 3. Destino de traslado (si el movimiento es Trasladado) */}
          {estadoEgreso === 'trasladado' && (
            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="modify-destinoTraslado"
                  className="block text-sm font-semibold text-slate-800"
                >
                  {FIELD_LABELS.destinoTraslado}
                </label>
                <VoiceMicButton
                  fieldLabel="Destino del traslado"
                  isActive={voice.activeFieldId === 'modify_destino'}
                  isSupported={voice.isSupported}
                  onClick={() =>
                    voice.toggleDictation('modify_destino', (transcript) =>
                      setDestinoTraslado((prev) => appendDictatedText(prev, transcript))
                    )
                  }
                />
              </div>
              <input
                id="modify-destinoTraslado"
                type="text"
                value={destinoTraslado}
                onChange={(e) => setDestinoTraslado(e.target.value)}
                placeholder="Ej. Hospital General, Clínica, unidad receptora"
                autoComplete="off"
                className="mt-1.5 min-h-[46px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700"
              />
            </div>
          )}

          {/* 4. Tipo de alta y fecha de salida (cuando corresponde a Atendido tras hospitalización) */}
          {showHospitalizationDischargeSection && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div>
                <span className="block text-xs font-semibold text-slate-700">
                  {FIELD_LABELS.tipoAltaHospitalizacion} (solo si egresó de hospitalización)
                </span>
                <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setTipoAlta('')}
                    className={`min-h-[40px] rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                      tipoAlta === ''
                        ? 'border-teal-700 bg-teal-700 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Sin alta hospitalaria
                  </button>
                  {HOSPITALIZATION_DISCHARGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTipoAlta(opt.value)}
                      className={`min-h-[40px] rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                        tipoAlta === opt.value
                          ? 'border-indigo-700 bg-indigo-700 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {tipoAlta !== '' && (
                <div>
                  <label
                    htmlFor="modify-fechaSalida"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    {FIELD_LABELS.fechaSalida}
                  </label>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[180px] flex-1">
                      <Calendar
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        id="modify-fechaSalida"
                        type="date"
                        value={fechaSalida}
                        onChange={(e) => {
                          const next = normalizeIsoDate(e.target.value);
                          if (next) setFechaSalida(next);
                        }}
                        className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 font-mono text-sm text-slate-900 focus:border-indigo-700"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setFechaSalida(getTodayIsoDate())}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Hoy
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 5. Hora de salida (visible cuando el paciente tiene salida o conserva 1ª salida con reingreso) */}
          {(estadoEgreso !== 'en_atencion' || keepingReadmission) && (
            <div>
              <label
                htmlFor="modify-horaSalida"
                className="block text-sm font-semibold text-slate-800"
              >
                {keepingReadmission ? FIELD_LABELS.primeraSalida : FIELD_LABELS.horaSalida} (12 h)
              </label>
              <TimeInput12h
                id="modify-horaSalida"
                value={horaSalida}
                allowEmpty
                onChange={(nextVal) => setHoraSalida(nextVal)}
              />
            </div>
          )}

          {/* 6. Médico y enfermera */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <label
                  htmlFor="modify-medico"
                  className="block text-sm font-semibold text-slate-800"
                >
                  {showDischargeStaffToggle && !sameStaffAsAdmission
                    ? FIELD_LABELS.medicoIngreso
                    : FIELD_LABELS.medico}
                </label>
                <div className="flex items-center gap-1.5">
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
                        className={`min-h-[30px] rounded-md px-2 text-xs font-bold transition-colors ${
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
                    isActive={voice.activeFieldId === 'modify_medico'}
                    isSupported={voice.isSupported}
                    onClick={() =>
                      voice.toggleDictation('modify_medico', (transcript) =>
                        setMedico((prev) => appendDictatedText(prev, transcript))
                      )
                    }
                  />
                </div>
              </div>
              <input
                id="modify-medico"
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
                placeholder="Nombre del médico (DR. / DRA.)"
                autoComplete="off"
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-1.5">
                <label
                  htmlFor="modify-enfermera"
                  className="block text-sm font-semibold text-slate-800"
                >
                  {showDischargeStaffToggle && !sameStaffAsAdmission
                    ? FIELD_LABELS.enfermeraIngreso
                    : FIELD_LABELS.enfermera}
                </label>
                <VoiceMicButton
                  fieldLabel="Enfermera"
                  isActive={voice.activeFieldId === 'modify_enfermera'}
                  isSupported={voice.isSupported}
                  onClick={() =>
                    voice.toggleDictation('modify_enfermera', (transcript) =>
                      setEnfermera((prev) => appendDictatedText(prev, transcript))
                    )
                  }
                />
              </div>
              <input
                id="modify-enfermera"
                type="text"
                value={enfermera}
                onChange={(e) => setEnfermera(e.target.value)}
                onBlur={() => {
                  if (enfermera.trim()) {
                    setEnfermera(formatNurseName(enfermera));
                  }
                }}
                placeholder="Nombre de la enfermera (ENF.)"
                autoComplete="off"
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700"
              />
            </div>
          </div>

          {/* Responsables de salida (cuando aplica alta hospitalaria) */}
          {showDischargeStaffToggle && tipoAlta !== '' && (
            <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3.5">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-indigo-950">
                <input
                  type="checkbox"
                  checked={sameStaffAsAdmission}
                  onChange={(e) => setSameStaffAsAdmission(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-700 focus:ring-indigo-600"
                />
                <span>Mismos responsables del ingreso al dar salida</span>
              </label>

              {!sameStaffAsAdmission && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <label
                        htmlFor="modify-medicoSalida"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        {FIELD_LABELS.medicoSalida}
                      </label>
                      <div className="flex items-center gap-1">
                        <div className="inline-grid grid-cols-2 gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5">
                          {(['DR.', 'DRA.'] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => {
                                setDischargeDoctorTitle(t);
                                if (medicoSalida.trim()) {
                                  setMedicoSalida(formatDoctorName(medicoSalida, t));
                                }
                              }}
                              className={`min-h-[28px] rounded-md px-2 text-xs font-bold ${
                                dischargeDoctorTitle === t
                                  ? 'bg-indigo-700 text-white'
                                  : 'text-slate-700'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                        <VoiceMicButton
                          fieldLabel="Médico de salida"
                          isActive={voice.activeFieldId === 'modify_medicoSalida'}
                          isSupported={voice.isSupported}
                          onClick={() =>
                            voice.toggleDictation('modify_medicoSalida', (transcript) =>
                              setMedicoSalida((prev) => appendDictatedText(prev, transcript))
                            )
                          }
                        />
                      </div>
                    </div>
                    <input
                      id="modify-medicoSalida"
                      type="text"
                      value={medicoSalida}
                      onChange={(e) => {
                        const next = e.target.value;
                        setDischargeDoctorTitle(detectDoctorTitle(next, dischargeDoctorTitle));
                        setMedicoSalida(next);
                      }}
                      onBlur={() => {
                        if (medicoSalida.trim()) {
                          setMedicoSalida(formatDoctorName(medicoSalida, dischargeDoctorTitle));
                        }
                      }}
                      placeholder="Doctor responsable de la salida"
                      autoComplete="off"
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-700"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-1.5">
                      <label
                        htmlFor="modify-enfermeraSalida"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        {FIELD_LABELS.enfermeraSalida}
                      </label>
                      <VoiceMicButton
                        fieldLabel="Enfermera de salida"
                        isActive={voice.activeFieldId === 'modify_enfermeraSalida'}
                        isSupported={voice.isSupported}
                        onClick={() =>
                          voice.toggleDictation('modify_enfermeraSalida', (transcript) =>
                            setEnfermeraSalida((prev) => appendDictatedText(prev, transcript))
                          )
                        }
                      />
                    </div>
                    <input
                      id="modify-enfermeraSalida"
                      type="text"
                      value={enfermeraSalida}
                      onChange={(e) => setEnfermeraSalida(e.target.value)}
                      onBlur={() => {
                        if (enfermeraSalida.trim()) {
                          setEnfermeraSalida(formatNurseName(enfermeraSalida));
                        }
                      }}
                      placeholder="Enfermera responsable de la salida"
                      autoComplete="off"
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-700"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Diagnóstico */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="modify-diagnostico"
                className="block text-sm font-semibold text-slate-800"
              >
                {FIELD_LABELS.diagnostico}
              </label>
              <VoiceMicButton
                fieldLabel="Diagnóstico"
                isActive={voice.activeFieldId === 'modify_diagnostico'}
                isSupported={voice.isSupported}
                onClick={() =>
                  voice.toggleDictation('modify_diagnostico', (transcript) =>
                    setDiagnostico((prev) => appendDictatedText(prev, transcript))
                  )
                }
              />
            </div>
            <textarea
              id="modify-diagnostico"
              rows={2}
              value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)}
              placeholder="Diagnóstico capturado (opcional)"
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-teal-700"
            />
          </div>

          {/* Observaciones de salida */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="modify-observacionesSalida"
                className="block text-sm font-semibold text-slate-800"
              >
                {FIELD_LABELS.observacionesSalida}
              </label>
              <VoiceMicButton
                fieldLabel="Observaciones de salida"
                isActive={voice.activeFieldId === 'modify_observacionesSalida'}
                isSupported={voice.isSupported}
                onClick={() =>
                  voice.toggleDictation('modify_observacionesSalida', (transcript) =>
                    setObservacionesSalida((prev) => appendDictatedText(prev, transcript))
                  )
                }
              />
            </div>
            <textarea
              id="modify-observacionesSalida"
              rows={2}
              value={observacionesSalida}
              onChange={(e) => setObservacionesSalida(e.target.value)}
              placeholder="Observaciones del movimiento o salida (opcional)"
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
            onClick={() => void handleSubmit()}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>{isSaving ? 'Guardando...' : 'Guardar corrección'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
