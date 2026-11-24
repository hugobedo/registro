import type {
  ExitOutcome,
  HospitalizationDischargeType,
  PatientOutcome,
  TreatmentLabel,
} from '../types/patient';

/**
 * Identificador único del espacio compartido en la nube.
 */
export const WORKSPACE_ID = 'acemed_guardia';

/**
 * Correo del responsable administrador inicial.
 */
export const ADMIN_EMAIL = 'hugoac.bedo@gmail.com';

/**
 * Encargado de turno permanente (no se borra ni se altera accidentalmente).
 */
export const DEFAULT_SHIFT_SUPERVISOR = 'HUGO ALBERTO ACEBEDO CRUZ';

/**
 * Enlace predeterminado del grupo de WhatsApp para enviar mensajes e informes de guardia.
 */
export const DEFAULT_WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/JuLkCeZy7AU5m6rybWy3Jr';

/**
 * Etiqueta visible del campo de lugar de origen del paciente.
 */
export const PROCEDENCIA_LABEL = 'Procedencia';

export const FIELD_LABELS = {
  horaEntrada: 'Hora de entrada',
  horaSalida: 'Hora de salida',
  fechaSalida: 'Fecha de salida',
  estadoEgreso: 'Estado de egreso',
  tipoAltaHospitalizacion: 'Tipo de alta',
  destinoTraslado: 'Destino del traslado',
  nombre: 'Nombre',
  edad: 'Edad',
  procedencia: PROCEDENCIA_LABEL,
  motivoVisita: 'Motivo de visita',
  observaciones: 'Observaciones',
  observacionesSalida: 'Observaciones de salida',
  medico: 'Médico que lo atendió',
  enfermera: 'Enfermera que lo atendió',
  diagnostico: 'Diagnóstico',
} as const;

export const TREATMENT_OPTIONS: ReadonlyArray<{
  value: TreatmentLabel;
  label: string;
  helper: string;
}> = [
  { value: 'paciente', label: 'Paciente', helper: 'Sin especificar sexo' },
  { value: 'usuario', label: 'Usuario', helper: 'Masculino' },
  { value: 'usuaria', label: 'Usuaria', helper: 'Femenino' },
];

export function getTreatmentHeader(treatment: TreatmentLabel): string {
  switch (treatment) {
    case 'usuario':
      return 'Usuario';
    case 'usuaria':
      return 'Usuaria';
    default:
      return 'Paciente';
  }
}

export const EXIT_OUTCOME_OPTIONS: ReadonlyArray<{
  value: ExitOutcome;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    value: 'atendido',
    label: 'Atendido',
    shortLabel: 'Atendido',
    description: 'Recibió valoración o atención y registró salida.',
  },
  {
    value: 'no_espero_turno',
    label: 'No esperó turno',
    shortLabel: 'No esperó turno',
    description: 'Se retiró antes de pasar a consulta o valoración.',
  },
  {
    value: 'no_atendido',
    label: 'No atendido',
    shortLabel: 'No atendido',
    description: 'No fue posible brindarle atención en esta unidad.',
  },
  {
    value: 'trasladado',
    label: 'Trasladado a otra unidad',
    shortLabel: 'Trasladado',
    description: 'Referido o trasladado a otro centro o nivel de atención.',
  },
  {
    value: 'hospitalizado',
    label: 'Hospitalización',
    shortLabel: 'Hospitalización',
    description: 'Ingresado a hospitalización bajo valoración médica.',
  },
];

export function getOutcomeLabel(outcome: PatientOutcome): string {
  switch (outcome) {
    case 'atendido':
      return 'Atendido';
    case 'no_espero_turno':
      return 'No esperó turno';
    case 'no_atendido':
      return 'No atendido';
    case 'trasladado':
      return 'Trasladado a otra unidad';
    case 'hospitalizado':
      return 'Hospitalización';
    default:
      return 'En atención (sin salida)';
  }
}

export const HOSPITALIZATION_DISCHARGE_OPTIONS: ReadonlyArray<{
  value: Exclude<HospitalizationDischargeType, ''>;
  label: string;
  description: string;
}> = [
  {
    value: 'alta_medica',
    label: 'Alta médica',
    description: 'Egreso autorizado por el personal médico al concluir su hospitalización.',
  },
  {
    value: 'alta_voluntaria',
    label: 'Alta voluntaria',
    description: 'Egreso solicitado por decisión propia del paciente o su responsable.',
  },
];

export function getHospitalizationDischargeLabel(
  type: HospitalizationDischargeType | undefined
): string {
  switch (type) {
    case 'alta_medica':
      return 'Alta médica';
    case 'alta_voluntaria':
      return 'Alta voluntaria';
    default:
      return '';
  }
}

/**
 * Sugerencias seleccionables para agilizar la captura del "Motivo de visita".
 * Se insertan únicamente cuando el usuario hace clic sobre ellas y nunca se
 * presentan ni registran como diagnóstico.
 */
export const MOTIVO_SUGGESTIONS: ReadonlyArray<string> = [
  'Cefalea',
  'Dolor abdominal',
  'Dolor intestinal',
  'Fiebre',
  'Tos',
  'Dificultad para respirar',
  'Náuseas',
  'Vómito',
  'Diarrea',
  'Mareo',
  'Dolor torácico',
  'Dolor de garganta',
  'Lesión o herida',
  'Control de presión arterial',
  'Otro',
];

/**
 * Sugerencias seleccionables para "Observaciones" en el formato de ENTRADA (sin diagnóstico).
 * Solo notas operativas o de recepción; se insertan únicamente al hacer clic.
 */
export const OBSERVACIONES_ENTRADA_SUGGESTIONS: ReadonlyArray<string> = [
  'Acude por propio pie',
  'Acude acompañado por familiar',
  'Sin acompañante',
  'Ingresa en silla de ruedas',
  'Ingresa en ambulancia',
  'Trae estudios o receta previa',
  'En espera de valoración',
  'Sin diagnóstico al ingreso',
];
