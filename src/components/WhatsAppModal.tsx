import { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  RotateCcw,
  SpellCheck,
  Users,
  X,
} from 'lucide-react';
import type { MessageType, PatientRecord } from '../types/patient';
import {
  buildPatientMessage,
  buildWhatsAppUrl,
  getSafeWhatsAppGroupUrl,
} from '../utils/messages';
import { reviewMessageDraft } from '../utils/spellcheck';

interface WhatsAppModalProps {
  patient: PatientRecord;
  messageType: MessageType;
  whatsappGroupUrl: string;
  onClose: () => void;
}

export function WhatsAppModal({
  patient,
  messageType,
  whatsappGroupUrl,
  onClose,
}: WhatsAppModalProps) {
  const [draftText, setDraftText] = useState(() => buildPatientMessage(patient, messageType));
  const [copied, setCopied] = useState(false);
  const [copiedForGroup, setCopiedForGroup] = useState(false);
  const [spellProposal, setSpellProposal] = useState<{
    proposed: string;
    changed: boolean;
    reasons: string[];
  } | null>(null);

  useEffect(() => {
    setDraftText(buildPatientMessage(patient, messageType));
    setSpellProposal(null);
  }, [patient, messageType]);

  const handleResetTemplate = () => {
    setDraftText(buildPatientMessage(patient, messageType));
    setSpellProposal(null);
  };

  const handleRectifyDraft = () => {
    const result = reviewMessageDraft(draftText);
    setSpellProposal(result);
  };

  const handleApplyProposal = () => {
    if (spellProposal && spellProposal.changed) {
      setDraftText(spellProposal.proposed);
    }
    setSpellProposal(null);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draftText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleCopyBeforeOpenGroup = () => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard
        .writeText(draftText)
        .then(() => {
          setCopiedForGroup(true);
          window.setTimeout(() => setCopiedForGroup(false), 3000);
        })
        .catch(() => {
          setCopiedForGroup(false);
        });
    }
  };

  const whatsAppHref = buildWhatsAppUrl(draftText);
  const safeGroupUrl = getSafeWhatsAppGroupUrl(whatsappGroupUrl);
  const isIngreso = messageType === 'ingreso';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsapp-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
    >
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-xl">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id="whatsapp-modal-title" className="text-lg font-bold text-slate-900">
              {isIngreso ? 'Mensaje de ingreso para WhatsApp' : 'Mensaje de salida para WhatsApp'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Formato limpio que incluye únicamente los datos registrados en este paciente.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista previa de WhatsApp"
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
          {/* Editor del mensaje */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="whatsapp-draft"
                className="text-sm font-semibold text-slate-800"
              >
                Revisa o edita el texto antes de compartir
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleRectifyDraft}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:text-teal-950"
                >
                  <SpellCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Rectificar escritura y ortografía</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetTemplate}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Restablecer</span>
                </button>
              </div>
            </div>

            <textarea
              id="whatsapp-draft"
              rows={isIngreso ? 9 : 13}
              value={draftText}
              onChange={(e) => {
                setDraftText(e.target.value);
                if (spellProposal) setSpellProposal(null);
              }}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 font-mono text-sm leading-relaxed text-slate-900 focus:border-teal-700"
            />

            {/* Confirmación inline de rectificación ortográfica si fue solicitada */}
            {spellProposal && (
              <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50/50 p-3.5">
                {spellProposal.changed ? (
                  <>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-bold text-teal-900">
                        Propuesta rectificada ({spellProposal.reasons.join(' · ')})
                      </span>
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap rounded-md border border-teal-200 bg-white p-2.5 font-mono text-xs text-slate-900">
                      {spellProposal.proposed}
                    </pre>
                    <div className="mt-2.5 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setSpellProposal(null)}
                        className="min-h-[34px] rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Mantener original
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyProposal}
                        className="min-h-[34px] rounded-md bg-teal-700 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-800"
                      >
                        Aplicar rectificación
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-emerald-900">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                      <span>No se detectaron errores ortográficos ni de formato en el mensaje.</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSpellProposal(null)}
                      className="text-slate-600 hover:text-slate-900"
                    >
                      Ocultar
                    </button>
                  </div>
                )}
              </div>
            )}

            {copiedForGroup && (
              <p className="mt-2 text-xs font-semibold text-emerald-800">
                Mensaje copiado al portapapeles. Pega y confirma el envío dentro del grupo de
                WhatsApp.
              </p>
            )}

            <p className="mt-1.5 text-xs text-slate-500">
              “Enviar por WhatsApp” abre WhatsApp con el texto listo para elegir chat o grupo.
              “Copiar y abrir grupo” copia el mensaje y abre directamente el grupo configurado para
              que solo pegues y envíes.
            </p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-2 border-t border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                  <span>Texto copiado</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  <span>Copiar texto</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[42px] items-center justify-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cerrar
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <a
              href={safeGroupUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleCopyBeforeOpenGroup}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-emerald-700 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 transition-colors hover:bg-emerald-100"
            >
              <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Copiar y abrir grupo</span>
            </a>

            <a
              href={whatsAppHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
            >
              <span>Enviar por WhatsApp</span>
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
