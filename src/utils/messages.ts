import {
  DEFAULT_SHIFT_SUPERVISOR,
  DEFAULT_WHATSAPP_GROUP_URL,
  FIELD_LABELS,
  getOutcomeLabel,
  getTreatmentHeader,
} from '../config/labels';
import {
  computeShiftCounts,
  getPatientOutcome,
  hasRegisteredExit,
  type MessageType,
  type PatientRecord,
} from '../types/patient';
import {
  compareByEntryTime,
  formatReportDateEs,
  formatTime12h,
  getCurrentTime12h,
} from './time';

interface MessageFieldLine {
  label: string;
  value: string;
}

const HEADER_DIVIDER = '────────────────────────────';

/**
 * Da formato limpio, profesional y estructurado SIN asteriscos (*).
 */
function formatCleanLine(label: string, value: string): string {
  const cleanValue = value.trim();
  if (!cleanValue) {
    return `${label}:`;
  }
  return `${label}: ${cleanValue}`;
}

/**
 * Construye el mensaje de INGRESO profesional sin asteriscos (*), en formato 12 horas:
 * - Encabezado strictly: REGISTRO DE USUARIO
 * - Hora de entrada
 * - Usuario / Usuaria / Paciente
 * - Edad
 * - Procedencia
 * - Motivo de visita
 * - Observaciones (sin diagnóstico)
 */
export function buildIngresoMessage(
  patient: PatientRecord,
  includeEmptyFields: boolean
): string {
  const lines: MessageFieldLine[] = [
    { label: FIELD_LABELS.horaEntrada, value: formatTime12h(patient.horaEntrada) },
    { label: getTreatmentHeader(patient.tratamiento), value: patient.nombre },
    { label: FIELD_LABELS.edad, value: patient.edad },
    { label: FIELD_LABELS.procedencia, value: patient.procedencia },
    { label: FIELD_LABELS.motivoVisita, value: patient.motivoVisita },
    { label: FIELD_LABELS.observaciones, value: patient.observaciones },
  ];

  const body = lines
    .filter((line) => includeEmptyFields || line.value.trim().length > 0)
    .map((line) => formatCleanLine(line.label, line.value));

  return ['REGISTRO DE USUARIO', HEADER_DIVIDER, ...body].join('\n');
}

/**
 * Construye el mensaje de SALIDA profesional sin asteriscos (*), en formato 12 horas:
 * - Encabezado strictly: REGISTRO DE USUARIO
 * - Usa observacionesSalida independientes del egreso (no copia observaciones de ingreso automáticamente)
 */
export function buildSalidaMessage(
  patient: PatientRecord,
  includeEmptyFields: boolean
): string {
  const outcome = getPatientOutcome(patient);
  const outcomeValue = outcome === 'en_atencion' ? '' : getOutcomeLabel(outcome);

  const lines: MessageFieldLine[] = [
    { label: FIELD_LABELS.estadoEgreso, value: outcomeValue },
    { label: FIELD_LABELS.horaEntrada, value: formatTime12h(patient.horaEntrada) },
    { label: FIELD_LABELS.horaSalida, value: formatTime12h(patient.horaSalida) },
    { label: getTreatmentHeader(patient.tratamiento), value: patient.nombre },
    { label: FIELD_LABELS.edad, value: patient.edad },
    { label: FIELD_LABELS.procedencia, value: patient.procedencia },
    { label: FIELD_LABELS.motivoVisita, value: patient.motivoVisita },
    { label: FIELD_LABELS.observaciones, value: patient.observacionesSalida || '' },
    { label: FIELD_LABELS.medico, value: patient.medico },
    { label: FIELD_LABELS.enfermera, value: patient.enfermera },
    { label: FIELD_LABELS.diagnostico, value: patient.diagnostico },
  ];

  const body = lines
    .filter((line) => includeEmptyFields || line.value.trim().length > 0)
    .map((line) => formatCleanLine(line.label, line.value));

  return ['REGISTRO DE USUARIO', HEADER_DIVIDER, ...body].join('\n');
}

export function buildPatientMessage(
  patient: PatientRecord,
  type: MessageType,
  includeEmptyFields: boolean
): string {
  return type === 'ingreso'
    ? buildIngresoMessage(patient, includeEmptyFields)
    : buildSalidaMessage(patient, includeEmptyFields);
}

/**
 * Construye el informe resumido de guardia en formato estructurado sin asteriscos (*)
 * y hora de 12 horas para compartirlo directamente en el grupo de WhatsApp.
 */
export function buildShiftReportWhatsAppMessage(
  patients: PatientRecord[],
  responsableGuardia: string
): string {
  const now = new Date();
  const dateText = formatReportDateEs(now);
  const capitalizedDate = dateText.charAt(0).toUpperCase() + dateText.slice(1);
  const timeText = getCurrentTime12h(now);
  const supervisor = responsableGuardia.trim() || DEFAULT_SHIFT_SUPERVISOR;

  const sortedAll = [...patients].sort(compareByEntryTime);
  const exitedPatients = sortedAll.filter((p) => hasRegisteredExit(p));
  const pendingPatients = sortedAll.filter((p) => !hasRegisteredExit(p));
  const counts = computeShiftCounts(sortedAll);

  const lines: string[] = [
    'INFORME DE GUARDIA — ACE-MED',
    HEADER_DIVIDER,
    `Fecha: ${capitalizedDate}, ${timeText}`,
    `Encargado de turno: ${supervisor}`,
    '',
    'RESUMEN DEL TURNO',
    `Total de pacientes: ${counts.total}`,
    `Atendidos: ${counts.atendidos}`,
    `No esperaron turno: ${counts.noEsperoTurno}`,
    `No atendidos: ${counts.noAtendidos}`,
    `Trasladados a otra unidad: ${counts.trasladados}`,
    `Sin salida (en atención): ${counts.enAtencion}`,
  ];

  if (exitedPatients.length > 0) {
    lines.push('', 'PACIENTES CON SALIDA (ORDEN CRONOLÓGICO)');
    exitedPatients.forEach((patient, index) => {
      const outcomeLabel = getOutcomeLabel(getPatientOutcome(patient));
      const treatment = getTreatmentHeader(patient.tratamiento);
      const entry = formatTime12h(patient.horaEntrada) || '—';
      const exit = formatTime12h(patient.horaSalida);
      const schedule = exit ? `${entry} a ${exit}` : entry;
      const details: string[] = [
        `${index + 1}. [${outcomeLabel}] ${schedule}`,
        patient.nombre.trim() ? `${treatment}: ${patient.nombre.trim()}` : treatment,
      ];
      if (patient.edad.trim()) details.push(`Edad: ${patient.edad.trim()}`);
      if (patient.procedencia.trim()) {
        details.push(`${FIELD_LABELS.procedencia}: ${patient.procedencia.trim()}`);
      }
      if (patient.motivoVisita.trim()) {
        details.push(`Motivo: ${patient.motivoVisita.trim()}`);
      }
      if (patient.observaciones.trim()) {
        details.push(`Obs. ingreso: ${patient.observaciones.trim()}`);
      }
      if (patient.observacionesSalida.trim()) {
        details.push(`Obs. salida: ${patient.observacionesSalida.trim()}`);
      }
      if (patient.medico.trim()) details.push(`Médico: ${patient.medico.trim()}`);
      if (patient.enfermera.trim()) details.push(`Enfermera: ${patient.enfermera.trim()}`);
      if (patient.diagnostico.trim()) {
        details.push(`Diagnóstico: ${patient.diagnostico.trim()}`);
      }
      lines.push(details.join(' | '));
    });
  }

  if (pendingPatients.length > 0) {
    lines.push('', 'PENDIENTES SIN SALIDA REGISTRADA');
    pendingPatients.forEach((patient, index) => {
      const treatment = getTreatmentHeader(patient.tratamiento);
      const entry = formatTime12h(patient.horaEntrada) || '—';
      const details: string[] = [
        `${index + 1}. [Sin salida] Entrada ${entry}`,
        patient.nombre.trim() ? `${treatment}: ${patient.nombre.trim()}` : treatment,
      ];
      if (patient.edad.trim()) details.push(`Edad: ${patient.edad.trim()}`);
      if (patient.procedencia.trim()) {
        details.push(`${FIELD_LABELS.procedencia}: ${patient.procedencia.trim()}`);
      }
      if (patient.motivoVisita.trim()) {
        details.push(`Motivo: ${patient.motivoVisita.trim()}`);
      }
      if (patient.observaciones.trim()) {
        details.push(`Obs.: ${patient.observaciones.trim()}`);
      }
      lines.push(details.join(' | '));
    });
  }

  return lines.join('\n');
}

/**
 * Genera un enlace compatible con WhatsApp en escritorio y dispositivos móviles.
 */
export function buildWhatsAppUrl(messageText: string): string {
  return `https://wa.me/?text=${encodeURIComponent(messageText)}`;
}

/**
 * Valida que el enlace configurado corresponda a un dominio oficial de WhatsApp.
 */
export function getSafeWhatsAppGroupUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return DEFAULT_WHATSAPP_GROUP_URL;

  try {
    const parsed = new URL(trimmed);
    const allowedHosts = new Set([
      'chat.whatsapp.com',
      'wa.me',
      'api.whatsapp.com',
      'web.whatsapp.com',
    ]);
    if (parsed.protocol === 'https:' && allowedHosts.has(parsed.hostname)) {
      return parsed.toString();
    }
  } catch {
    return DEFAULT_WHATSAPP_GROUP_URL;
  }

  return DEFAULT_WHATSAPP_GROUP_URL;
}
