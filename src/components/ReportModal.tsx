import { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  Lock,
  MessageSquare,
  Users,
  X,
} from 'lucide-react';
import { DEFAULT_SHIFT_SUPERVISOR } from '../config/labels';
import type { PatientRecord, ShiftCounts } from '../types/patient';
import {
  buildShiftReportWhatsAppMessage,
  buildWhatsAppUrl,
  getSafeWhatsAppGroupUrl,
} from '../utils/messages';
import { formatReportDateEs } from '../utils/time';

interface ReportModalProps {
  patients: PatientRecord[];
  counts: ShiftCounts;
  whatsappGroupUrl: string;
  onChangeWhatsappGroupUrl: (value: string) => void;
  onDownloadPdf: () => void;
  onExportJsonBackup: () => void;
  onClose: () => void;
}

export function ReportModal({
  patients,
  counts,
  whatsappGroupUrl,
  onChangeWhatsappGroupUrl,
  onDownloadPdf,
  onExportJsonBackup,
  onClose,
}: ReportModalProps) {
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [showTextPreview, setShowTextPreview] = useState(false);

  const reportDate = formatReportDateEs(new Date());
  const formattedDate = reportDate.charAt(0).toUpperCase() + reportDate.slice(1);

  const shiftSummaryText = useMemo(
    () => buildShiftReportWhatsAppMessage(patients, DEFAULT_SHIFT_SUPERVISOR),
    [patients]
  );

  const safeGroupUrl = getSafeWhatsAppGroupUrl(whatsappGroupUrl);
  const whatsAppShareUrl = buildWhatsAppUrl(shiftSummaryText);

  const handleCopySummary = () => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard
        .writeText(shiftSummaryText)
        .then(() => {
          setCopiedSummary(true);
          window.setTimeout(() => setCopiedSummary(false), 3000);
        })
        .catch(() => {
          setCopiedSummary(false);
        });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4"
    >
      <div className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id="report-modal-title" className="text-lg font-bold text-slate-900">
              Informe de guardia (PDF, respaldo y WhatsApp)
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Descarga el informe PDF A4 ordenado del primer registro al último (solo con datos
              completados) o compártelo en el grupo de WhatsApp.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de informe"
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="text-xs font-semibold text-slate-600">Fecha del informe</div>
            <div className="mt-0.5 font-semibold text-slate-900">{formattedDate}</div>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-slate-200 pt-3 text-xs font-semibold tabular-nums sm:grid-cols-3">
              <div className="text-slate-900">Total: {counts.total}</div>
              <div className="text-amber-800">Activos: {counts.enAtencion}</div>
              <div className="text-emerald-800">Atendidos: {counts.atendidos}</div>
              <div className="text-orange-800">No esperó: {counts.noEsperoTurno}</div>
              <div className="text-red-800">No atendidos: {counts.noAtendidos}</div>
              <div className="text-blue-800">Trasladados: {counts.trasladados}</div>
              <div className="text-indigo-800">Hospitalización: {counts.hospitalizados}</div>
            </div>
          </div>

          {/* Encargado de turno permanente protegido */}
          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-900">
              <Lock className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
              <span>Encargado de turno permanente</span>
            </div>
            <div className="mt-1 text-sm font-bold text-slate-900">
              {DEFAULT_SHIFT_SUPERVISOR}
            </div>
          </div>

          {/* Grupo de WhatsApp para envío de informes */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
            <div>
              <label
                htmlFor="report-whatsapp-group"
                className="block text-sm font-semibold text-slate-900"
              >
                Grupo de WhatsApp para enviar informes
              </label>
              <input
                id="report-whatsapp-group"
                type="url"
                value={whatsappGroupUrl}
                onChange={(e) => onChangeWhatsappGroupUrl(e.target.value)}
                placeholder="https://chat.whatsapp.com/..."
                className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-teal-700"
              />
              <p className="mt-1 text-xs text-slate-600">
                Descarga el PDF para adjuntarlo en el grupo, o copia el informe estructurado en
                texto y abre el grupo directamente.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <a
                href={safeGroupUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleCopySummary}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-800"
              >
                <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Copiar informe y abrir grupo</span>
              </a>

              <a
                href={whatsAppShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-emerald-700 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-900 transition-colors hover:bg-emerald-50"
              >
                <MessageSquare className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Enviar resumen por WhatsApp</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:text-teal-950"
              >
                {copiedSummary ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                    <span>Informe copiado (listo para pegar en el grupo)</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copiar texto del informe</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowTextPreview((prev) => !prev)}
                className="text-xs font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900"
              >
                {showTextPreview ? 'Ocultar vista previa' : 'Ver texto del informe'}
              </button>
            </div>

            {showTextPreview && (
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-white p-3 font-mono text-xs leading-relaxed text-slate-900">
                {shiftSummaryText}
              </pre>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button
            type="button"
            onClick={onExportJsonBackup}
            disabled={patients.length === 0}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Respaldo JSON</span>
          </button>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={onDownloadPdf}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
            >
              <FileDown className="h-4 w-4" aria-hidden="true" />
              <span>Descargar PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
