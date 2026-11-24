import { jsPDF } from 'jspdf';
import {
  DEFAULT_SHIFT_SUPERVISOR,
  FIELD_LABELS,
  getHospitalizationDischargeLabel,
  getOutcomeLabel,
  getTreatmentHeader,
} from '../config/labels';
import {
  computeShiftCounts,
  getPatientOutcome,
  type PatientOutcome,
  type PatientRecord,
} from '../types/patient';
import {
  compareByRegistrationOrder,
  formatIsoDateEs,
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
    case 'hospitalizado':
      return {
        badgeText: 'HOSPITALIZACIÓN',
        textRgb: [67, 56, 202],
        fillRgb: [238, 242, 255],
        borderRgb: [165, 180, 252],
      };
    default:
      return {
        badgeText: 'ACTIVO — EN ATENCIÓN',
        textRgb: [146, 64, 14],
        fillRgb: [254, 243, 199],
        borderRgb: [252, 211, 77],
      };
  }
}

/**
 * Genera y descarga el informe del día en formato PDF (A4):
 * - Encabezado limpio con REGISTRO DE USUARIOS (sin línea debajo del título)
 * - Resumen de totales por categoría
 * - Todos los registros en orden cronológico exacto de subida: del primero al último
 * - Muestra la fecha de cada registro y únicamente los campos completados por el usuario
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

  const sortedAll = [...patients].sort(compareByRegistrationOrder);
  const counts = computeShiftCounts(sortedAll);

  let cursorY = PAGE_MARGIN_TOP;

  const ensureSpace = (neededHeight: number) => {
    if (cursorY + neededHeight > maxY) {
      doc.addPage();
      cursorY = PAGE_MARGIN_TOP;
    }
  };

  // Encabezado limpio: REGISTRO DE USUARIOS sin línea debajo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('REGISTRO DE USUARIOS', PAGE_MARGIN_X, cursorY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 118, 110);
  doc.text('ACE-MED · INFORME DEL DÍA', pageWidth - PAGE_MARGIN_X, cursorY, { align: 'right' });

  cursorY += 6.5;

  // Fecha y Responsable de guardia
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha de emisión:', PAGE_MARGIN_X, cursorY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${capitalizedDate} · ${reportTimeText}`, PAGE_MARGIN_X + 29, cursorY);

  const supervisorName = responsableGuardia.trim() || DEFAULT_SHIFT_SUPERVISOR;
  doc.setFont('helvetica', 'bold');
  doc.text('Encargado de turno:', PAGE_MARGIN_X, cursorY + 4.5);
  doc.setFont('helvetica', 'normal');
  const wrappedSupervisor = doc.splitTextToSize(supervisorName, contentWidth - 36) as string[];
  doc.text(wrappedSupervisor, PAGE_MARGIN_X + 33, cursorY + 4.5);
  cursorY += 4.5 + wrappedSupervisor.length * 4 + 2.5;

  // Cuadro superior de totales diferenciados (2 filas x 4 columnas)
  const statBoxHeight = 16;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(PAGE_MARGIN_X, cursorY, contentWidth, statBoxHeight, 1.5, 1.5, 'FD');

  const colW = contentWidth / 4;
  doc.setDrawColor(226, 232, 240);
  doc.line(PAGE_MARGIN_X + colW, cursorY + 1.5, PAGE_MARGIN_X + colW, cursorY + statBoxHeight - 1.5);
  doc.line(
    PAGE_MARGIN_X + colW * 2,
    cursorY + 1.5,
    PAGE_MARGIN_X + colW * 2,
    cursorY + statBoxHeight - 1.5
  );
  doc.line(
    PAGE_MARGIN_X + colW * 3,
    cursorY + 1.5,
    PAGE_MARGIN_X + colW * 3,
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
    { label: 'Total:', value: counts.total, rgb: [15, 23, 42], row: 0, col: 0 },
    { label: 'Activos:', value: counts.enAtencion, rgb: [146, 64, 14], row: 0, col: 1 },
    { label: 'Atendidos:', value: counts.atendidos, rgb: [4, 120, 87], row: 0, col: 2 },
    { label: 'Hospitalización:', value: counts.hospitalizados, rgb: [67, 56, 202], row: 0, col: 3 },
    { label: 'No esperó:', value: counts.noEsperoTurno, rgb: [154, 52, 18], row: 1, col: 0 },
    { label: 'No atendidos:', value: counts.noAtendidos, rgb: [185, 28, 28], row: 1, col: 1 },
    { label: 'Trasladados:', value: counts.trasladados, rgb: [29, 78, 216], row: 1, col: 2 },
  ];

  doc.setFontSize(8);
  for (const cell of statsCells) {
    const x = PAGE_MARGIN_X + cell.col * colW + 2.5;
    const y = cursorY + (cell.row === 0 ? 5.3 : 13.2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(cell.label, x, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...cell.rgb);
    doc.text(String(cell.value), PAGE_MARGIN_X + (cell.col + 1) * colW - 2.5, y, {
      align: 'right',
    });
  }

  cursorY += statBoxHeight + 6;

  // Encabezado de sección única cronológica (del primero al último)
  ensureSpace(12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Registros en orden cronológico', PAGE_MARGIN_X, cursorY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(100, 116, 139);
  doc.text('Del primer registro al último', pageWidth - PAGE_MARGIN_X, cursorY, { align: 'right' });

  cursorY += 2;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(PAGE_MARGIN_X, cursorY, pageWidth - PAGE_MARGIN_X, cursorY);
  cursorY += 4.2;

  const renderCompactPatientRow = (orderNumber: number, patient: PatientRecord) => {
    const outcome = getPatientOutcome(patient);
    const style = getOutcomePdfStyle(outcome);
    const treatmentHeader = getTreatmentHeader(patient.tratamiento);

    const recordDate = formatIsoDateEs(patient.fechaRegistro);
    const exitDate = formatIsoDateEs(patient.fechaSalida);
    const dischargeTypeLabel = getHospitalizationDischargeLabel(patient.tipoAltaHospitalizacion);
    const entryTime = formatTime12h(patient.horaEntrada);
    const exitTime = formatTime12h(patient.horaSalida);

    // Solo incluir campos efectivamente completados por el usuario
    const detailLines: string[] = [];

    const identityParts: string[] = [];
    if (patient.nombre.trim()) {
      identityParts.push(`${treatmentHeader}: ${patient.nombre.trim()}`);
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

    const clinicalParts: string[] = [];
    if (dischargeTypeLabel) {
      clinicalParts.push(`${FIELD_LABELS.tipoAltaHospitalizacion}: ${dischargeTypeLabel}`);
    }
    if (exitDate) {
      clinicalParts.push(`${FIELD_LABELS.fechaSalida}: ${exitDate}`);
    }
    if (patient.motivoVisita.trim()) {
      clinicalParts.push(`${FIELD_LABELS.motivoVisita}: ${patient.motivoVisita.trim()}`);
    }
    if (patient.destinoTraslado.trim()) {
      clinicalParts.push(`${FIELD_LABELS.destinoTraslado}: ${patient.destinoTraslado.trim()}`);
    }
    if (patient.observaciones.trim()) {
      clinicalParts.push(
        `${patient.observacionesSalida.trim() ? 'Obs. ingreso' : FIELD_LABELS.observaciones}: ${patient.observaciones.trim()}`
      );
    }
    if (patient.observacionesSalida.trim()) {
      clinicalParts.push(`Obs. salida: ${patient.observacionesSalida.trim()}`);
    }
    if (clinicalParts.length > 0) {
      detailLines.push(clinicalParts.join('  |  '));
    }

    const staffParts: string[] = [];
    if (patient.medico.trim()) {
      staffParts.push(`${FIELD_LABELS.medico}: ${patient.medico.trim()}`);
    }
    if (patient.enfermera.trim()) {
      staffParts.push(`${FIELD_LABELS.enfermera}: ${patient.enfermera.trim()}`);
    }
    if (patient.diagnostico.trim()) {
      staffParts.push(`${FIELD_LABELS.diagnostico}: ${patient.diagnostico.trim()}`);
    }
    if (staffParts.length > 0) {
      detailLines.push(staffParts.join('  |  '));
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
    const totalBoxH =
      bodyLinesCount > 0 ? headerBarH + bodyLinesCount * lineH + 3.2 : headerBarH + 0.6;

    ensureSpace(totalBoxH + 2.2);

    // Marco exterior compacto
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(0.22);
    doc.roundedRect(PAGE_MARGIN_X, cursorY, contentWidth, totalBoxH, 1.2, 1.2, 'FD');

    // Franja superior con número de registro, fecha, hora entrada/salida (si existen) y estado
    doc.setFillColor(...style.fillRgb);
    doc.setDrawColor(...style.borderRgb);
    doc.rect(PAGE_MARGIN_X + 0.2, cursorY + 0.2, contentWidth - 0.4, headerBarH, 'F');
    if (bodyLinesCount > 0) {
      doc.line(
        PAGE_MARGIN_X,
        cursorY + headerBarH,
        pageWidth - PAGE_MARGIN_X,
        cursorY + headerBarH
      );
    }

    const headerTextY = cursorY + 3.8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);

    const scheduleParts: string[] = [`#${orderNumber}`];
    if (recordDate) scheduleParts.push(recordDate);
    if (entryTime) scheduleParts.push(`Entrada ${entryTime}`);
    if (exitTime) scheduleParts.push(`Salida ${exitTime}`);
    doc.text(scheduleParts.join('  ·  '), PAGE_MARGIN_X + 3, headerTextY);

    doc.setTextColor(...style.textRgb);
    doc.text(style.badgeText, pageWidth - PAGE_MARGIN_X - 3, headerTextY, { align: 'right' });

    if (bodyLinesCount > 0) {
      let textY = cursorY + headerBarH + 3.6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);

      for (const wrapped of wrappedRows) {
        doc.text(wrapped, PAGE_MARGIN_X + 3, textY);
        textY += wrapped.length * lineH;
      }
    }

    cursorY += totalBoxH + 2.4;
  };

  if (sortedAll.length === 0) {
    ensureSpace(8);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('No hay registros al momento de generar este informe.', PAGE_MARGIN_X, cursorY);
    cursorY += 7;
  } else {
    sortedAll.forEach((patient, index) => {
      renderCompactPatientRow(index + 1, patient);
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
      `ACE-MED · ${getOutcomeLabel('atendido')}: ${counts.atendidos} | Hosp.: ${counts.hospitalizados} | No esperó: ${counts.noEsperoTurno} | No atend.: ${counts.noAtendidos} | Trasl.: ${counts.trasladados} | Activos: ${counts.enAtencion}`,
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
