import { useEffect, useRef, useState } from 'react';
import { Calendar, Mic, RotateCcw, Save, SpellCheck, X } from 'lucide-react';
import {
  EXIT_OUTCOME_OPTIONS,
  FIELD_LABELS,
  MOTIVO_SUGGESTIONS,
  OBSERVACIONES_ENTRADA_SUGGESTIONS,
  TREATMENT_OPTIONS,
} from '../config/labels';
import { appendDictatedText, useVoiceDictation } from '../hooks/useVoiceDictation';
import {
  getPatientOutcome,
  type PatientFormValues,
  type PatientOutcome,
  type PatientRecord,
  type ReviewableFieldKey,
} from '../types/patient';
import {
  extractIsoDateFromTimestamp,
  formatIsoDateEs,
  getCurrentTime24h,
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

interface PatientFormProps {
  editingPatient: PatientRecord | null;
  isSaving?: boolean;
  onSave: (values: PatientFormValues, openWhatsAppAfterSave: boolean) => Promise<void> | void;
  onCancel: () => void;
  onRequestSpellCheck: (
    fields: Partial<Record<ReviewableFieldKey, string>>,
    onApply: (corrected: Partial<Record<ReviewableFieldKey, string>>) => void
  ) => void;
}

function createEmptyFormValues(): PatientFormValues {
  return {
    fechaRegistro: getTodayIsoDate(),
    horaEntrada: getCurrentTime24h(),
    horaSalida: '',
    estadoEgreso: 'en_atencion',
    tratamiento: 'paciente',
    nombre: '',
    edad: '',
    procedencia: '',
    motivoVisita: '',
    observaciones: '',
    observacionesSalida: '',
    medico: '',
    enfermera: '',
    diagnostico: '',
  };
}

function mapPatientToFormValues(patient: PatientRecord): PatientFormValues {
  return {
    fechaRegistro:
      normalizeIsoDate(patient.fechaRegistro) ||
      extractIsoDateFromTimestamp(patient.createdAt) ||
      getTodayIsoDate(),
    horaEntrada: normalizeTime24h(patient.horaEntrada),
    horaSalida: normalizeTime24h(patient.horaSalida),
    estadoEgreso: getPatientOutcome(patient),
    tratamiento: patient.tratamiento,
    nombre: patient.nombre,
    edad: patient.edad,
    procedencia: patient.procedencia,
    motivoVisita: patient.motivoVisita,
    observaciones: patient.observaciones,
    observacionesSalida: patient.observacionesSalida || '',
    medico: patient.medico,
    enfermera: patient.enfermera,
    diagnostico: patient.diagnostico,
  };
}

function appendSuggestion(currentText: string, suggestion: string): string {
  const current = currentText.trim();
  if (!current) {
    return suggestion;
  }
  if (current.toLowerCase().includes(suggestion.toLowerCase())) {
    return currentText;
  }
  const separator = current.endsWith(',') || current.endsWith('.') ? ' ' : ', ';
  return `${current}${separator}${suggestion.charAt(0).toLowerCase()}${suggestion.slice(1)}`;
}

export function PatientForm({
  editingPatient,
  isSaving = false,
  onSave,
  onCancel,
  onRequestSpellCheck,
}: PatientFormProps) {
  const [values, setValues] = useState<PatientFormValues>(() =>
    editingPatient ? mapPatientToFormValues(editingPatient) : createEmptyFormValues()
  );
  const [doctorTitle, setDoctorTitle] = useState<DoctorTitle>(() =>
    editingPatient ? detectDoctorTitle(editingPatient.medico, 'DR.') : 'DR.'
  );
  const [editingDate, setEditingDate] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const motivoTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const voice = useVoiceDictation();

  useEffect(() => {
    if (editingPatient) {
      setValues(mapPatientToFormValues(editingPatient));
      setDoctorTitle(detectDoctorTitle(editingPatient.medico, 'DR.'));
    } else {
      setValues(createEmptyFormValues());
      setDoctorTitle('DR.');
    }
    setEditingDate(false);
    setValidationError(null);
    voice.stopDictation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPatient]);

  const updateField = <K extends keyof PatientFormValues>(
    field: K,
    value: PatientFormValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (validationError) setValidationError(null);
  };

  const handleVoiceForField = (
    field:
      | 'nombre'
      | 'edad'
      | 'procedencia'
      | 'motivoVisita'
      | 'observaciones'
      | 'observacionesSalida'
      | 'medico'
      | 'enfermera'
      | 'diagnostico'
  ) => {
    voice.toggleDictation(`form_${field}`, (transcript) => {
      setValues((prev) => ({
        ...prev,
        [field]: appendDictatedText(prev[field], transcript),
      }));
      if (validationError) setValidationError(null);
    });
  };

  const handleInsertMotivoSuggestion = (suggestion: string) => {
    if (suggestion === 'Otro') {
      motivoTextareaRef.current?.focus();
      return;
    }

    setValues((prev) => ({
      ...prev,
      motivoVisita: appendSuggestion(prev.motivoVisita, suggestion),
    }));

    if (validationError) setValidationError(null);
  };

  const handleInsertObservacionSuggestion = (suggestion: string) => {
    setValues((prev) => ({
      ...prev,
      observaciones: appendSuggestion(prev.observaciones, suggestion),
    }));

    if (validationError) setValidationError(null);
  };

  const handleOutcomeChange = (outcome: PatientOutcome) => {
    setValues((prev) => ({
      ...prev,
      estadoEgreso: outcome,
      horaSalida:
        outcome === 'en_atencion'
          ? ''
          : prev.horaSalida.trim()
            ? prev.horaSalida
            : getCurrentTime24h(),
    }));
  };

  const handleSpellCheck = () => {
    const fieldsToReview: Partial<Record<ReviewableFieldKey, string>> = {
      nombre: values.nombre,
      edad: values.edad,
      procedencia: values.procedencia,
      motivoVisita: values.motivoVisita,
      observaciones: values.observaciones,
    };

    if (editingPatient) {
      fieldsToReview.observacionesSalida = values.observacionesSalida;
      fieldsToReview.medico = values.medico;
      fieldsToReview.enfermera = values.enfermera;
      fieldsToReview.diagnostico = values.diagnostico;
    }

    onRequestSpellCheck(fieldsToReview, (corrected) => {
      setValues((prev) => ({
        ...prev,
        ...corrected,
      }));
    });
  };

  const handleSubmit = async (openWhatsAppAfterSave: boolean) => {
    voice.stopDictation();

    const normalizedHoraSalida =
      values.estadoEgreso === 'en_atencion' ? '' : normalizeTime24h(values.horaSalida);

    const resolvedOutcome: PatientOutcome =
      normalizedHoraSalida && values.estadoEgreso === 'en_atencion'
        ? 'atendido'
        : values.estadoEgreso;

    const formattedMedico = values.medico.trim()
      ? formatDoctorName(values.medico, doctorTitle)
      : '';
    const formattedEnfermera = values.enfermera.trim()
      ? formatNurseName(values.enfermera)
      : '';

    await onSave(
      {
        ...values,
        fechaRegistro: normalizeIsoDate(values.fechaRegistro) || getTodayIsoDate(),
        horaEntrada: normalizeTime24h(values.horaEntrada),
        horaSalida: normalizedHoraSalida,
        estadoEgreso: resolvedOutcome,
        medico: formattedMedico,
        enfermera: formattedEnfermera,
      },
      openWhatsAppAfterSave
    );

    if (!editingPatient) {
      setValues(createEmptyFormValues());
      setDoctorTitle('DR.');
      setEditingDate(false);
    }
  };

  const handleClearForm = () => {
    voice.stopDictation();
    setValues(createEmptyFormValues());
    setDoctorTitle('DR.');
    setEditingDate(false);
    setValidationError(null);
  };

  const showExitFields = Boolean(editingPatient);

  return (
    <section
      id="captura"
      aria-labelledby="form-heading"
      className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs"
    >
      <div className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="form-heading" className="text-xl font-bold text-slate-900">
            {editingPatient ? 'Editar registro de paciente' : 'REGISTRO DE USUARIOS'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {editingPatient
              ? 'Actualiza la información del paciente. Los cambios se sincronizarán en todos los dispositivos.'
              : 'Captura los datos de ingreso del paciente. Puedes escribir manualmente o usar el micrófono para dictar por voz.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            voice.stopDictation();
            onCancel();
          }}
          className="inline-flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          <span>Cancelar y volver</span>
        </button>
      </div>

      {/* Estado de micrófono / dictado por voz */}
      {voice.activeFieldId && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5 text-sm text-red-900">
            <Mic className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
            <div>
              <span className="font-bold">Micrófono activo:</span> habla con claridad. El texto se
              agregará sin borrar lo que ya escribiste.
              {voice.interimText && (
                <p className="mt-1 text-xs italic text-red-800">“{voice.interimText}”</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={voice.stopDictation}
            className="inline-flex min-h-[38px] items-center justify-center rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 shrink-0"
          >
            Detener dictado
          </button>
        </div>
      )}

      {voice.statusMessage && (
        <div
          role="status"
          className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-950"
        >
          <span>{voice.statusMessage}</span>
          <button
            type="button"
            onClick={voice.clearStatusMessage}
            className="shrink-0 font-bold text-amber-900 underline"
          >
            Cerrar
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit(false);
        }}
        className="mt-5 space-y-5"
        noValidate
      >
        {/* Fecha del registro con botón Modificar fecha */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-teal-700">
                <Calendar className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-600">Fecha de registro</div>
                <div className="font-mono text-sm font-bold tabular-nums text-slate-900">
                  {formatIsoDateEs(values.fechaRegistro) || formatIsoDateEs(getTodayIsoDate())}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setEditingDate((prev) => !prev)}
              aria-expanded={editingDate}
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-teal-700/40 bg-white px-3.5 py-1.5 text-xs font-semibold text-teal-900 transition-colors hover:bg-teal-50"
            >
              <Calendar className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
              <span>{editingDate ? 'Cerrar fecha' : 'Modificar fecha'}</span>
            </button>
          </div>

          {editingDate && (
            <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
              <div className="min-w-[190px] flex-1">
                <label
                  htmlFor="fechaRegistro"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Selecciona la fecha del registro
                </label>
                <input
                  id="fechaRegistro"
                  type="date"
                  value={values.fechaRegistro}
                  onChange={(e) => {
                    const nextDate = normalizeIsoDate(e.target.value);
                    if (nextDate) {
                      updateField('fechaRegistro', nextDate);
                    }
                  }}
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-700"
                />
              </div>

              <button
                type="button"
                onClick={() => updateField('fechaRegistro', getTodayIsoDate())}
                className="inline-flex min-h-[42px] items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
              >
                Hoy
              </button>

              <button
                type="button"
                onClick={() => setEditingDate(false)}
                className="inline-flex min-h-[42px] items-center justify-center rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-800"
              >
                Listo
              </button>
            </div>
          )}
        </div>

        {/* Hora de entrada + Encabezado en mensaje */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label
              htmlFor="horaEntrada"
              className="block text-sm font-semibold text-slate-800"
            >
              {FIELD_LABELS.horaEntrada} (12 h)
            </label>
            <TimeInput12h
              id="horaEntrada"
              value={values.horaEntrada}
              allowEmpty
              onChange={(nextVal) => updateField('horaEntrada', nextVal)}
            />
          </div>

          <div>
            <span className="block text-sm font-semibold text-slate-800">
              Encabezado en mensaje
            </span>
            <div
              role="radiogroup"
              aria-label="Seleccionar encabezado Usuario, Usuaria o Paciente"
              className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1"
            >
              {TREATMENT_OPTIONS.map((option) => {
                const isSelected = values.tratamiento === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => updateField('tratamiento', option.value)}
                    className={`min-h-[38px] whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-semibold transition-colors ${
                      isSelected
                        ? 'bg-white text-teal-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Se elige manualmente; nunca se deduce por el nombre.
            </p>
          </div>
        </div>

        {/* Nombre con dictado por voz */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="nombre" className="block text-sm font-semibold text-slate-800">
              {FIELD_LABELS.nombre} y apellidos
            </label>
            <VoiceMicButton
              fieldLabel="Nombre y apellidos"
              isActive={voice.activeFieldId === 'form_nombre'}
              isSupported={voice.isSupported}
              onClick={() => handleVoiceForField('nombre')}
            />
          </div>
          <input
            id="nombre"
            type="text"
            value={values.nombre}
            onChange={(e) => updateField('nombre', e.target.value)}
            placeholder="Nombre completo y apellidos del paciente"
            autoComplete="off"
            className="mt-1.5 min-h-[46px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700"
          />
        </div>

        {/* Edad + Procedencia */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="edad" className="block text-sm font-semibold text-slate-800">
                {FIELD_LABELS.edad}
              </label>
              <VoiceMicButton
                fieldLabel="Edad"
                isActive={voice.activeFieldId === 'form_edad'}
                isSupported={voice.isSupported}
                onClick={() => handleVoiceForField('edad')}
              />
            </div>
            <input
              id="edad"
              type="text"
              value={values.edad}
              onChange={(e) => updateField('edad', e.target.value)}
              placeholder="Ej. 34 años, 8 meses"
              autoComplete="off"
              className="mt-1.5 min-h-[46px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="procedencia"
                className="block text-sm font-semibold text-slate-800"
              >
                {FIELD_LABELS.procedencia}
              </label>
              <VoiceMicButton
                fieldLabel={FIELD_LABELS.procedencia}
                isActive={voice.activeFieldId === 'form_procedencia'}
                isSupported={voice.isSupported}
                onClick={() => handleVoiceForField('procedencia')}
              />
            </div>
            <input
              id="procedencia"
              type="text"
              value={values.procedencia}
              onChange={(e) => updateField('procedencia', e.target.value)}
              placeholder="Lugar de origen o localidad"
              autoComplete="off"
              className="mt-1.5 min-h-[46px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700"
            />
          </div>
        </div>

        {/* Motivo de visita + dictado + sugerencias seleccionables */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="motivoVisita"
              className="block text-sm font-semibold text-slate-800"
            >
              {FIELD_LABELS.motivoVisita}
            </label>
            <VoiceMicButton
              fieldLabel="Motivo de visita"
              isActive={voice.activeFieldId === 'form_motivoVisita'}
              isSupported={voice.isSupported}
              onClick={() => handleVoiceForField('motivoVisita')}
            />
          </div>
          <textarea
            ref={motivoTextareaRef}
            id="motivoVisita"
            rows={2}
            value={values.motivoVisita}
            onChange={(e) => updateField('motivoVisita', e.target.value)}
            placeholder="Describe el motivo referido por el paciente"
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-teal-700"
          />

          <div className="mt-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                Sugerencias para motivo de visita
              </span>
              <span className="text-xs text-slate-500">
                Solo al seleccionar · No son diagnóstico
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {MOTIVO_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleInsertMotivoSuggestion(suggestion)}
                  className="min-h-[36px] rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 transition-colors hover:border-teal-600 hover:bg-teal-50 hover:text-teal-900"
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Observaciones de entrada (sin diagnóstico) + dictado + sugerencias */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="observaciones"
              className="block text-sm font-semibold text-slate-800"
            >
              {FIELD_LABELS.observaciones} (sin diagnóstico)
            </label>
            <VoiceMicButton
              fieldLabel="Observaciones de entrada"
              isActive={voice.activeFieldId === 'form_observaciones'}
              isSupported={voice.isSupported}
              onClick={() => handleVoiceForField('observaciones')}
            />
          </div>
          <textarea
            id="observaciones"
            rows={2}
            value={values.observaciones}
            onChange={(e) => updateField('observaciones', e.target.value)}
            placeholder="Notas de ingreso o recepción (acompañante, traslado, situación operativa; sin diagnóstico)"
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-teal-700"
          />

          <div className="mt-2.5">
            <span className="block text-xs font-semibold text-slate-700">
              Sugerencias para observaciones de entrada
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {OBSERVACIONES_ENTRADA_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleInsertObservacionSuggestion(suggestion)}
                  className="min-h-[36px] rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 transition-colors hover:border-teal-600 hover:bg-teal-50 hover:text-teal-900"
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Campos de salida visibles únicamente al editar un registro existente */}
        {showExitFields && (
          <div className="space-y-4 border-t border-slate-200 pt-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Datos de atención y formato de salida
              </h3>
              <p className="mt-0.5 text-xs text-slate-600">
                Al guardar, los nombres del médico y personal de enfermería reciben automáticamente
                su abreviatura (DR., DRA., ENF.) sin duplicarse.
              </p>
            </div>

            <div>
              <span className="block text-sm font-semibold text-slate-800">
                {FIELD_LABELS.estadoEgreso}
              </span>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => handleOutcomeChange('en_atencion')}
                  className={`min-h-[40px] rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    values.estadoEgreso === 'en_atencion'
                      ? 'border-amber-600 bg-amber-50 text-amber-900'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Sin salida
                </button>
                {EXIT_OUTCOME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleOutcomeChange(option.value)}
                    className={`min-h-[40px] rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      values.estadoEgreso === option.value
                        ? 'border-teal-700 bg-teal-50 text-teal-900'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {option.shortLabel}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="horaSalida"
                className="block text-sm font-semibold text-slate-800"
              >
                {FIELD_LABELS.horaSalida} (12 h)
              </label>
              <TimeInput12h
                id="horaSalida"
                value={values.horaSalida}
                allowEmpty
                onChange={(nextTime) => {
                  setValues((prev) => ({
                    ...prev,
                    horaSalida: nextTime,
                    estadoEgreso:
                      nextTime.trim() && prev.estadoEgreso === 'en_atencion'
                        ? 'atendido'
                        : prev.estadoEgreso,
                  }));
                }}
                onNowClick={() => {
                  setValues((prev) => ({
                    ...prev,
                    horaSalida: getCurrentTime24h(),
                    estadoEgreso:
                      prev.estadoEgreso === 'en_atencion' ? 'atendido' : prev.estadoEgreso,
                  }));
                }}
              />
            </div>

            {/* Médico con selector DR. / DRA. + voz */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="medico"
                  className="block text-sm font-semibold text-slate-800"
                >
                  {FIELD_LABELS.medico}
                </label>
                <div className="flex items-center gap-2">
                  <div
                    role="radiogroup"
                    aria-label="Título del médico"
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
                          if (values.medico.trim()) {
                            updateField('medico', formatDoctorName(values.medico, t));
                          }
                        }}
                        className={`min-h-[32px] rounded-md px-2.5 text-xs font-bold transition-colors ${
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
                    isActive={voice.activeFieldId === 'form_medico'}
                    isSupported={voice.isSupported}
                    onClick={() => handleVoiceForField('medico')}
                  />
                </div>
              </div>
              <input
                id="medico"
                type="text"
                value={values.medico}
                onChange={(e) => {
                  const next = e.target.value;
                  setDoctorTitle(detectDoctorTitle(next, doctorTitle));
                  updateField('medico', next);
                }}
                onBlur={() => {
                  if (values.medico.trim()) {
                    updateField('medico', formatDoctorName(values.medico, doctorTitle));
                  }
                }}
                placeholder="Nombre y apellidos del médico o médica"
                autoComplete="off"
                className="mt-1.5 min-h-[46px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700"
              />
            </div>

            {/* Enfermera con prefijo automático ENF. + voz */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="enfermera"
                  className="block text-sm font-semibold text-slate-800"
                >
                  {FIELD_LABELS.enfermera} (prefijo automático ENF.)
                </label>
                <VoiceMicButton
                  fieldLabel="Enfermería"
                  isActive={voice.activeFieldId === 'form_enfermera'}
                  isSupported={voice.isSupported}
                  onClick={() => handleVoiceForField('enfermera')}
                />
              </div>
              <input
                id="enfermera"
                type="text"
                value={values.enfermera}
                onChange={(e) => updateField('enfermera', e.target.value)}
                onBlur={() => {
                  if (values.enfermera.trim()) {
                    updateField('enfermera', formatNurseName(values.enfermera));
                  }
                }}
                placeholder="Nombre y apellidos de enfermería"
                autoComplete="off"
                className="mt-1.5 min-h-[46px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="diagnostico"
                  className="block text-sm font-semibold text-slate-800"
                >
                  {FIELD_LABELS.diagnostico}
                </label>
                <VoiceMicButton
                  fieldLabel="Diagnóstico"
                  isActive={voice.activeFieldId === 'form_diagnostico'}
                  isSupported={voice.isSupported}
                  onClick={() => handleVoiceForField('diagnostico')}
                />
              </div>
              <textarea
                id="diagnostico"
                rows={2}
                value={values.diagnostico}
                onChange={(e) => updateField('diagnostico', e.target.value)}
                placeholder="Diagnóstico indicado por el personal médico"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-teal-700"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="observacionesSalida"
                  className="block text-sm font-semibold text-slate-800"
                >
                  {FIELD_LABELS.observacionesSalida}
                </label>
                <VoiceMicButton
                  fieldLabel="Observaciones de salida"
                  isActive={voice.activeFieldId === 'form_observacionesSalida'}
                  isSupported={voice.isSupported}
                  onClick={() => handleVoiceForField('observacionesSalida')}
                />
              </div>
              <textarea
                id="observacionesSalida"
                rows={2}
                value={values.observacionesSalida}
                onChange={(e) => updateField('observacionesSalida', e.target.value)}
                placeholder="Observaciones independientes del egreso (opcional)"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-teal-700"
              />
            </div>
          </div>
        )}

        {validationError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
          >
            {validationError}
          </div>
        )}

        {/* Barra de acciones responsiva */}
        <div className="flex flex-col gap-3 border-t border-slate-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleSpellCheck}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-teal-700/40 bg-teal-50/70 px-4 py-2 text-sm font-semibold text-teal-900 transition-colors hover:bg-teal-100"
            >
              <SpellCheck className="h-4 w-4 text-teal-700" aria-hidden="true" />
              <span>Rectificar escritura y ortografía</span>
            </button>

            {!editingPatient && (
              <button
                type="button"
                onClick={handleClearForm}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Limpiar campos</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-60"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              <span>
                {isSaving
                  ? 'Guardando en la nube...'
                  : editingPatient
                    ? 'Guardar cambios'
                    : 'Guardar ingreso'}
              </span>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSubmit(true)}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-emerald-700 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-900 transition-colors hover:bg-emerald-100 disabled:opacity-60"
            >
              <span>
                {editingPatient ? 'Guardar y abrir WhatsApp' : 'Guardar y preparar WhatsApp'}
              </span>
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
