import {
  DEFAULT_SHIFT_SUPERVISOR,
  DEFAULT_WHATSAPP_GROUP_URL,
  FIELD_LABELS,
  getHospitalizationDischargeLabel,
  getOutcomeLabel,
  getTreatmentHeader,
} from '../config/labels';
import {
  computeShiftCounts,
  getPatientOutcome,
  hasDistinctDischargeDoctor,
  hasDistinctDischargeNurse,
  hasReadmission,
  type MessageType,
  type PatientRecord,
} from '../types/patient';
import {
  compareByRegistrationOrder,
  formatIsoDateEs,
  formatReportDateEs,
  formatTime12h,
  getCurrentTime12h,
} from './time';

interface MessageFieldLine {
  label: string;
  value: string;
}

/**
 * Da formato limpio, profesional y estructurado SIN asteriscos (*).
 * Solo incluye líneas cuyo valor fue ingresado por el usuario.
 */
function buildFilledLines(lines: MessageFieldLine[]): string[] {
  return lines
    .filter((line) => line.value.trim().length > 0)
    .map((line) => `${line.label}: ${line.value.trim()}`);
}

/**
 * Construye el mensaje de INGRESO limpio y profesional sin asteriscos (*):
 * - Encabezado exacto: REGISTRO DE USUARIOS (sin línea debajo)
 * - Comienza con Hora de entrada, Hora de salida (si fue capturada) y demás campos capturados
 * - Omite estrictamente cualquier campo vacío
 */
export function buildIngresoMessage(
  patient: PatientRecord,
  _includeEmptyFields = false
): string {
  const isReadmitted = hasReadmission(patient);
  const timeLines: MessageFieldLine[] = isReadmitted
    ? [
        { label: FIELD_LABELS.primeraEntrada, value: formatTime12h(patient.horaEntrada) },
        { label: FIELD_LABELS.primeraSalida, value: formatTime12h(patient.horaSalida) },
        { label: FIELD_LABELS.segundaEntrada, value: formatTime12h(patient.horaSegundaEntrada) },
        { label: FIELD_LABELS.segundaSalida, value: formatTime12h(patient.horaSegundaSalida) },
      ]
    : [
        { label: FIELD_LABELS.horaEntrada, value: formatTime12h(patient.horaEntrada) },
        { label: FIELD_LABELS.horaSalida, value: formatTime12h(patient.horaSalida) },
      ];

  const lines: MessageFieldLine[] = [
    ...timeLines,
    { label: 'Fecha', value: formatIsoDateEs(patient.fechaRegistro) },
    { label: getTreatmentHeader(patient.tratamiento), value: patient.nombre },
    { label: FIELD_LABELS.edad, value: patient.edad },
    { label: FIELD_LABELS.procedencia, value: patient.procedencia },
    { label: FIELD_LABELS.motivoVisita, value: patient.motivoVisita },
    { label: FIELD_LABELS.observaciones, value: patient.observaciones },
    { label: FIELD_LABELS.destinoTraslado, value: patient.destinoTraslado },
  ];

  const body = buildFilledLines(lines);
  return ['REGISTRO DE USUARIOS', ...body].join('\n');
}

/**
 * Construye el mensaje de SALIDA limpio y profesional sin asteriscos (*):
 * - Encabezado exacto: REGISTRO DE USUARIOS (sin línea debajo)
 * - Comienza con Hora de entrada, Hora de salida y demás datos capturados
 * - Omite estrictamente cualquier campo vacío (sin frases vacías ni datos inventados)
 */
export function buildSalidaMessage(
  patient: PatientRecord,
  _includeEmptyFields = false
): string {
  const outcome = getPatientOutcome(patient);
  const isReadmitted = hasReadmission(patient);
  const outcomeValue = outcome === 'en_atencion' ? '' : getOutcomeLabel(outcome);
  const dischargeTypeLabel = getHospitalizationDischargeLabel(patient.tipoAltaHospitalizacion);
  const exitDateFormatted = formatIsoDateEs(patient.fechaSalida);

  const timeLines: MessageFieldLine[] = isReadmitted
    ? [
        { label: FIELD_LABELS.primeraEntrada, value: formatTime12h(patient.horaEntrada) },
        { label: FIELD_LABELS.primeraSalida, value: formatTime12h(patient.horaSalida) },
        { label: FIELD_LABELS.segundaEntrada, value: formatTime12h(patient.horaSegundaEntrada) },
        { label: FIELD_LABELS.segundaSalida, value: formatTime12h(patient.horaSegundaSalida) },
      ]
    : [
        { label: FIELD_LABELS.horaEntrada, value: formatTime12h(patient.horaEntrada) },
        { label: FIELD_LABELS.horaSalida, value: formatTime12h(patient.horaSalida) },
      ];

  const distinctDoctor = hasDistinctDischargeDoctor(patient);
  const distinctNurse = hasDistinctDischargeNurse(patient);
  const staffLines: MessageFieldLine[] = [
    ...(distinctDoctor
      ? [
          { label: FIELD_LABELS.medicoIngreso, value: patient.medico },
          { label: FIELD_LABELS.medicoSalida, value: patient.medicoSalida },
        ]
      : [{ label: FIELD_LABELS.medico, value: patient.medico }]),
    ...(distinctNurse
      ? [
          { label: FIELD_LABELS.enfermeraIngreso, value: patient.enfermera },
          { label: FIELD_LABELS.enfermeraSalida, value: patient.enfermeraSalida },
        ]
      : [{ label: FIELD_LABELS.enfermera, value: patient.enfermera }]),
  ];

  const lines: MessageFieldLine[] = [
    ...timeLines,
    { label: 'Fecha', value: formatIsoDateEs(patient.fechaRegistro) },
    { label: FIELD_LABELS.fechaSalida, value: exitDateFormatted },
    { label: FIELD_LABELS.estadoEgreso, value: outcomeValue },
    { label: FIELD_LABELS.tipoAltaHospitalizacion, value: dischargeTypeLabel },
    { label: FIELD_LABELS.destinoTraslado, value: patient.destinoTraslado },
    { label: getTreatmentHeader(patient.tratamiento), value: patient.nombre },
    { label: FIELD_LABELS.edad, value: patient.edad },
    { label: FIELD_LABELS.procedencia, value: patient.procedencia },
    { label: FIELD_LABELS.motivoVisita, value: patient.motivoVisita },
    { label: FIELD_LABELS.observaciones, value: patient.observacionesSalida || '' },
    ...staffLines,
    { label: FIELD_LABELS.diagnostico, value: patient.diagnostico },
  ];

  const body = buildFilledLines(lines);
  return ['REGISTRO DE USUARIOS', ...body].join('\n');
}

export function buildPatientMessage(
  patient: PatientRecord,
  type: MessageType,
  _includeEmptyFields = false
): string {
  return type === 'ingreso' ? buildIngresoMessage(patient) : buildSalidaMessage(patient);
}

/**
 * Construye el informe resumido de guardia ordenado del primer registro al último
 * mostrando únicamente los campos efectivamente completados por el usuario.
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

  const sortedAll = [...patients].sort(compareByRegistrationOrder);
  const counts = computeShiftCounts(sortedAll);

  const lines: string[] = [
    'REGISTRO DE USUARIOS',
    `Informe del día: ${capitalizedDate}, ${timeText}`,
    `Encargado de turno: ${supervisor}`,
    '',
    'RESUMEN DEL TURNO',
    `Total: ${counts.total}`,
    `Activos: ${counts.enAtencion}`,
    `Atendidos: ${counts.atendidos}`,
    `No esperó: ${counts.noEsperoTurno}`,
    `No atendidos: ${counts.noAtendidos}`,
    `Trasladados: ${counts.trasladados}`,
    `Hospitalización: ${counts.hospitalizados}`,
    `Reingreso: ${counts.reingresos}`,
  ];

  if (sortedAll.length > 0) {
    lines.push('', 'PACIENTES REGISTRADOS (DEL PRIMERO AL ÚLTIMO)');
    sortedAll.forEach((patient, index) => {
      const outcome = getPatientOutcome(patient);
      const isReadmitted = hasReadmission(patient);
      const outcomeLabel = getOutcomeLabel(outcome);
      const treatment = getTreatmentHeader(patient.tratamiento);
      const dateStr = formatIsoDateEs(patient.fechaRegistro);
      const exitDateStr = formatIsoDateEs(patient.fechaSalida);
      const dischargeTypeLabel = getHospitalizationDischargeLabel(patient.tipoAltaHospitalizacion);
      const entry = formatTime12h(patient.horaEntrada);
      const exit = formatTime12h(patient.horaSalida);
      const secondEntry = formatTime12h(patient.horaSegundaEntrada);
      const secondExit = formatTime12h(patient.horaSegundaSalida);

      const headerParts: string[] = [
        `${index + 1}. [${outcomeLabel}${isReadmitted ? ' · Reingreso' : ''}]`,
      ];
      if (dateStr) headerParts.push(`Fecha: ${dateStr}`);
      if (isReadmitted) {
        if (entry) headerParts.push(`${FIELD_LABELS.primeraEntrada}: ${entry}`);
        if (exit) headerParts.push(`${FIELD_LABELS.primeraSalida}: ${exit}`);
        if (secondEntry) headerParts.push(`${FIELD_LABELS.segundaEntrada}: ${secondEntry}`);
        if (secondExit) headerParts.push(`${FIELD_LABELS.segundaSalida}: ${secondExit}`);
        if (exitDateStr) headerParts.push(`${FIELD_LABELS.fechaSalida}: ${exitDateStr}`);
      } else {
        if (entry) headerParts.push(`${FIELD_LABELS.horaEntrada}: ${entry}`);
        if (exitDateStr) headerParts.push(`${FIELD_LABELS.fechaSalida}: ${exitDateStr}`);
        if (exit) headerParts.push(`${FIELD_LABELS.horaSalida}: ${exit}`);
      }

      const detailParts: string[] = [];
      if (dischargeTypeLabel) {
        detailParts.push(`${FIELD_LABELS.tipoAltaHospitalizacion}: ${dischargeTypeLabel}`);
      }
      if (patient.nombre.trim()) {
        detailParts.push(`${treatment}: ${patient.nombre.trim()}`);
      }
      if (patient.edad.trim()) {
        detailParts.push(`${FIELD_LABELS.edad}: ${patient.edad.trim()}`);
      }
      if (patient.procedencia.trim()) {
        detailParts.push(`${FIELD_LABELS.procedencia}: ${patient.procedencia.trim()}`);
      }
      if (patient.motivoVisita.trim()) {
        detailParts.push(`${FIELD_LABELS.motivoVisita}: ${patient.motivoVisita.trim()}`);
      }
      if (patient.destinoTraslado.trim()) {
        detailParts.push(`${FIELD_LABELS.destinoTraslado}: ${patient.destinoTraslado.trim()}`);
      }
      if (patient.observaciones.trim()) {
        detailParts.push(`Obs. ingreso: ${patient.observaciones.trim()}`);
      }
      if (patient.observacionesSalida.trim()) {
        detailParts.push(`Obs. salida: ${patient.observacionesSalida.trim()}`);
      }
      if (hasDistinctDischargeDoctor(patient)) {
        if (patient.medico.trim()) {
          detailParts.push(`${FIELD_LABELS.medicoIngreso}: ${patient.medico.trim()}`);
        }
        detailParts.push(`${FIELD_LABELS.medicoSalida}: ${patient.medicoSalida.trim()}`);
      } else if (patient.medico.trim()) {
        detailParts.push(`${FIELD_LABELS.medico}: ${patient.medico.trim()}`);
      }
      if (hasDistinctDischargeNurse(patient)) {
        if (patient.enfermera.trim()) {
          detailParts.push(`${FIELD_LABELS.enfermeraIngreso}: ${patient.enfermera.trim()}`);
        }
        detailParts.push(`${FIELD_LABELS.enfermeraSalida}: ${patient.enfermeraSalida.trim()}`);
      } else if (patient.enfermera.trim()) {
        detailParts.push(`${FIELD_LABELS.enfermera}: ${patient.enfermera.trim()}`);
      }
      if (patient.diagnostico.trim()) {
        detailParts.push(`${FIELD_LABELS.diagnostico}: ${patient.diagnostico.trim()}`);
      }

      lines.push([...headerParts, ...detailParts].join(' | '));
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
