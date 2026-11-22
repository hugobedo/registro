import { jsPDF } from 'jspdf';
import {
  DEFAULT_SHIFT_SUPERVISOR,
  FIELD_LABELS,
  getOutcomeLabel,
  getTreatmentHeader,
} from '../config/labels';
import {
  computeShiftCounts,
  getPatientOutcome,
  hasRegisteredExit,
  type PatientOutcome,
  type PatientRecord,
} from '../types/patient';
import {
  compareByEntryTime,
  formatReportDateEs,
  formatTime12h,
  getCurrentTime12h,
  getIsoDateFilename,
} from './time';

interface ReportOptions {
  patients: PatientRecord[];
  responsableGuardia: string;
}

const PAGE_MARGIN_X = 14;
const PAGE_MARGIN_TOP = 15;
const PAGE_MARGIN_BOTTOM = 15;

interface OutcomeVisualStyle {
  badgeText: string;
  textRgb: [number, number, number];
  fillRgb: [number, number, number];
  borderRgb: [number, number, number];
}

function getOutcomePdfStyle(outcome: PatientOutcome): OutcomeVisualStyle {
  switch (outcome) {
    case 'atendido':
      return {
        badgeText: 'ATENDIDO',
        textRgb: [4, 120, 87],
        fillRgb: [236, 253, 245],
        borderRgb: [167, 243, 208],
      };
    case 'no_espero_turno':
      return {
        badgeText: 'NO ESPERÓ TURNO',
        textRgb: [154, 52, 18],
        fillRgb: [255, 247, 237],
        borderRgb: [253, 186, 116],
      };
    case 'no_atendido':
      return {
        badgeText: 'NO ATENDIDO',
        textRgb: [185, 28, 28],
        fillRgb: [254, 242, 242],
        borderRgb: [252, 165, 165],
      };
    case 'trasladado':
      return {
        badgeText: 'TRASLADADO A OTRA UNIDAD',
        textRgb: [29, 78, 216],
        fillRgb: [239, 246, 255],
        borderRgb: [147, 197, 253],
      };
    default:
      return {
        badgeText: 'SIN SALIDA — EN ATENCIÓN',
        textRgb: [146, 64, 14],
        fillRgb: [254, 243, 199],
        borderRgb: [252, 211, 77],
      };
  }
}

/**
 * Genera y descarga el informe de guardia compacto en formato PDF (A4) en el navegador.
 * - Arriba incluye totales diferenciados: total de pacientes, atendidos, no esperaron turno,
 *   no atendidos, trasladados a otra unidad y pendientes sin salida.
 * - Formato compacto por paciente con entrada y salida integradas y todos los datos disponibles,
 *   ordenado cronológicamente desde el primero que entró hasta el último.
 * - Al final agrupa claramente a los pacientes que quedan sin salida registrada.
 */
export function generateShiftPdfReport({ patients, responsableGuardia }: ReportOptions): string {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN_X * 2;
  const maxY = pageHeight - PAGE_MARGIN_BOTTOM;

  const now = new Date();
  const reportDateText = formatReportDateEs(now);
  const reportTimeText = getCurrentTime12h(now);
  const capitalizedDate = reportDateText.charAt(0).toUpperCase() + reportDateText.slice(1);

  const sortedAll = [...patients].sort(compareByEntryTime);
  const exitedPatients = sortedAll.filter((p) => hasRegisteredExit(p));
  const pendingExitPatients = sortedAll.filter((p) => !hasRegisteredExit(p));
  const counts = computeShiftCounts(sortedAll);

  let cursorY = PAGE_MARGIN_TOP;

  const ensureSpace = (neededHeight: number) => {
    if (cursorY + neededHeight > maxY) {
      doc.addPage();
      cursorY = PAGE_MARGIN_TOP;
    }
  };

  // Encabezado compacto y profesional
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text('ACE-MED', PAGE_MARGIN_X, cursorY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 118, 110);
  doc.text('INFORME DE GUARDIA CLÍNICA', pageWidth - PAGE_MARGIN_X, cursorY, { align: 'right' });

  cursorY += 3.5;
  doc.setDrawColor(15, 118, 110);
  doc.setLineWidth(0.5);
  doc.line(PAGE_MARGIN_X, cursorY, pageWidth - PAGE_MARGIN_X, cursorY);
  cursorY += 5.5;

  // Fecha y Responsable de guardia
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha:', PAGE_MARGIN_X, cursorY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${capitalizedDate} · ${reportTimeText}`, PAGE_MARGIN_X + 13, cursorY);

  const supervisorName = responsableGuardia.trim() || DEFAULT_SHIFT_SUPERVISOR;
  doc.setFont('helvetica', 'bold');
  doc.text('Responsable de guardia:', PAGE_MARGIN_X, cursorY + 4.5);
  doc.setFont('helvetica', 'normal');
  const wrappedSupervisor = doc.splitTextToSize(supervisorName, contentWidth - 40) as string[];
  doc.text(wrappedSupervisor, PAGE_MARGIN_X + 38, cursorY + 4.5);
  cursorY += 4.5 + wrappedSupervisor.length * 4 + 2.5;

  // Cuadro superior de totales diferenciados (2 filas x 3 columnas)
  const statBoxHeight = 16;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(PAGE_MARGIN_X, cursorY, contentWidth, statBoxHeight, 1.5, 1.5, 'FD');

  const colW = contentWidth / 3;
  // Divisores sutiles internos
  doc.setDrawColor(226, 232, 240);
  doc.line(PAGE_MARGIN_X + colW, cursorY + 1.5, PAGE_MARGIN_X + colW, cursorY + statBoxHeight - 1.5);
  doc.line(
    PAGE_MARGIN_X + colW * 2,
    cursorY + 1.5,
    PAGE_MARGIN_X + colW * 2,
    cursorY + statBoxHeight - 1.5
  );
  doc.line(
    PAGE_MARGIN_X + 2,
    cursorY + statBoxHeight / 2,
    pageWidth - PAGE_MARGIN_X - 2,
    cursorY + statBoxHeight / 2
  );

  const statsCells: Array<{
    label: string;
    value: number;
    rgb: [number, number, number];
    row: number;
    col: number;
  }> = [
    { label: 'Total de pacientes:', value: counts.total, rgb: [15, 23, 42], row: 0, col: 0 },
    { label: 'Atendidos:', value: counts.atendidos, rgb: [4, 120, 87], row: 0, col: 1 },
    {
      label: 'No esperaron turno:',
      value: counts.noEsperoTurno,
      rgb: [154, 52, 18],
      row: 0,
      col: 2,
    },
    { label: 'No atendidos:', value: counts.noAtendidos, rgb: [185, 28, 28], row: 1, col: 0 },
    {
      label: 'Trasladados a otra unidad:',
      value: counts.trasladados,
      rgb: [29, 78, 216],
      row: 1,
      col: 1,
    },
    {
      label: 'Sin salida (en atención):',
      value: counts.enAtencion,
      rgb: [146, 64, 14],
      row: 1,
      col: 2,
    },
  ];

  doc.setFontSize(8.2);
  for (const cell of statsCells) {
    const x = PAGE_MARGIN_X + cell.col * colW + 3;
    const y = cursorY + (cell.row === 0 ? 5.3 : 13.2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(cell.label, x, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...cell.rgb);
    doc.text(String(cell.value), PAGE_MARGIN_X + (cell.col + 1) * colW - 3.5, y, {
      align: 'right',
    });
  }

  cursorY += statBoxHeight + 6;

  const renderSectionHeader = (title: string, subtitle: string) => {
    ensureSpace(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(title, PAGE_MARGIN_X, cursorY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, pageWidth - PAGE_MARGIN_X, cursorY, { align: 'right' });

    cursorY += 2;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(PAGE_MARGIN_X, cursorY, pageWidth - PAGE_MARGIN_X, cursorY);
    cursorY += 4.2;
  };

  /**
   * Dibuja una ficha compacta por paciente con todos sus datos disponibles en pocas líneas,
   * evitando desperdicio de espacio vertical.
   */
  const renderCompactPatientRow = (
    orderNumber: number,
    patient: PatientRecord,
    includeExitFields: boolean
  ) => {
    const outcome = getPatientOutcome(patient);
    const style = getOutcomePdfStyle(outcome);
    const treatmentHeader = getTreatmentHeader(patient.tratamiento);

    const entryTime = formatTime12h(patient.horaEntrada) || '—';
    const exitTime = formatTime12h(patient.horaSalida);

    // Construir líneas compactas combinando campos cortos en la misma línea
    const detailLines: string[] = [];

    // Línea 1: Identificación + Edad + Procedencia
    const identityParts: string[] = [];
    if (patient.nombre.trim()) {
      identityParts.push(`${treatmentHeader}: ${patient.nombre.trim()}`);
    } else {
      identityParts.push(`${treatmentHeader}`);
    }
    if (patient.edad.trim()) {
      identityParts.push(`${FIELD_LABELS.edad}: ${patient.edad.trim()}`);
    }
    if (patient.procedencia.trim()) {
      identityParts.push(`${FIELD_LABELS.procedencia}: ${patient.procedencia.trim()}`);
    }
    if (identityParts.length > 0) {
      detailLines.push(identityParts.join('  |  '));
    }

    // Línea 2: Motivo de visita + Observaciones de ingreso/salida
    const intakeParts: string[] = [];
    if (patient.motivoVisita.trim()) {
      intakeParts.push(`${FIELD_LABELS.motivoVisita}: ${patient.motivoVisita.trim()}`);
    }
    if (patient.observaciones.trim()) {
      intakeParts.push(
        `${includeExitFields ? 'Obs. ingreso' : FIELD_LABELS.observaciones}: ${patient.observaciones.trim()}`
      );
    }
    if (includeExitFields && patient.observacionesSalida.trim()) {
      intakeParts.push(`Obs. salida: ${patient.observacionesSalida.trim()}`);
    }
    if (intakeParts.length > 0) {
      detailLines.push(intakeParts.join('  |  '));
    }

    // Línea 3 (solo si es registro con salida): Médico + Enfermera + Diagnóstico
    if (includeExitFields) {
      const staffParts: string[] = [];
      if (patient.medico.trim()) {
        staffParts.push(`Médico: ${patient.medico.trim()}`);
      }
      if (patient.enfermera.trim()) {
        staffParts.push(`Enfermera: ${patient.enfermera.trim()}`);
      }
      if (patient.diagnostico.trim()) {
        staffParts.push(`${FIELD_LABELS.diagnostico}: ${patient.diagnostico.trim()}`);
      }
      if (staffParts.length > 0) {
        detailLines.push(staffParts.join('  |  '));
      }
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const textMaxWidth = contentWidth - 6;
    const wrappedRows = detailLines.map(
      (line) => doc.splitTextToSize(line, textMaxWidth) as string[]
    );

    const headerBarH = 5.4;
    const lineH = 3.6;
    const bodyLinesCount = wrappedRows.reduce((sum, lines) => sum + lines.length, 0);
    const totalBoxH = headerBarH + bodyLinesCount * lineH + 3.2;

    ensureSpace(totalBoxH + 2.2);

    // Marco exterior compacto
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(0.22);
    doc.roundedRect(PAGE_MARGIN_X, cursorY, contentWidth, totalBoxH, 1.2, 1.2, 'FD');

    // Franja superior compacta con número, horario entrada/salida y estado diferenciado
    doc.setFillColor(...style.fillRgb);
    doc.setDrawColor(...style.borderRgb);
    doc.rect(PAGE_MARGIN_X + 0.2, cursorY + 0.2, contentWidth - 0.4, headerBarH, 'F');
    doc.line(PAGE_MARGIN_X, cursorY + headerBarH, pageWidth - PAGE_MARGIN_X, cursorY + headerBarH);

    const headerTextY = cursorY + 3.8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);

    const scheduleLabel =
      includeExitFields && exitTime
        ? `#${orderNumber}  ·  Entrada ${entryTime}  ->  Salida ${exitTime}`
        : `#${orderNumber}  ·  Entrada ${entryTime}`;

    doc.text(scheduleLabel, PAGE_MARGIN_X + 3, headerTextY);

    doc.setTextColor(...style.textRgb);
    doc.text(style.badgeText, pageWidth - PAGE_MARGIN_X - 3, headerTextY, { align: 'right' });

    // Contenido compacto
    let textY = cursorY + headerBarH + 3.6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);

    for (const wrapped of wrappedRows) {
      doc.text(wrapped, PAGE_MARGIN_X + 3, textY);
      textY += wrapped.length * lineH;
    }

    cursorY += totalBoxH + 2.4;
  };

  // SECCIÓN 1: REGISTROS DE ENTRADA Y SALIDA EN ORDEN CRONOLÓGICO
  renderSectionHeader(
    '1. Registro cronológico de pacientes con salida',
    'Ordenados del primer ingreso al último (atendidos, no esperaron turno, no atendidos y trasladados)'
  );

  if (exitedPatients.length === 0) {
    ensureSpace(8);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('No hay salidas registradas al momento de generar este informe.', PAGE_MARGIN_X, cursorY);
    cursorY += 7;
  } else {
    exitedPatients.forEach((patient, index) => {
      renderCompactPatientRow(index + 1, patient, true);
    });
  }

  cursorY += 3;

  // SECCIÓN 2 (AL FINAL): PACIENTES QUE QUEDAN SIN DARLE SALIDA
  renderSectionHeader(
    '2. Pacientes pendientes sin salida registrada',
    'Ordenados por hora de entrada · Permanecen en atención'
  );

  if (pendingExitPatients.length === 0) {
    ensureSpace(8);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('No quedan pacientes pendientes sin salida al corte del informe.', PAGE_MARGIN_X, cursorY);
    cursorY += 7;
  } else {
    pendingExitPatients.forEach((patient, index) => {
      renderCompactPatientRow(index + 1, patient, false);
    });
  }

  // Pie de página con paginación
  const totalPages = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    doc.setPage(pageNumber);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(PAGE_MARGIN_X, pageHeight - 10, pageWidth - PAGE_MARGIN_X, pageHeight - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `ACE-MED · Responsable: ${supervisorName} · ${getOutcomeLabel('atendido')}: ${counts.atendidos} | No esperó: ${counts.noEsperoTurno} | No atendido: ${counts.noAtendidos} | Trasladado: ${counts.trasladados} | Sin salida: ${counts.enAtencion}`,
      PAGE_MARGIN_X,
      pageHeight - 6
    );
    doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - PAGE_MARGIN_X, pageHeight - 6, {
      align: 'right',
    });
  }

  const filename = `ACE-MED_Informe_Guardia_${getIsoDateFilename(now)}.pdf`;
  doc.save(filename);
  return filename;
}
