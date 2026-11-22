import { useEffect, useState } from 'react';
import { Check, CheckCircle2, Info, X } from 'lucide-react';
import type { FieldCorrectionProposal, ReviewableFieldKey } from '../types/patient';
import { computeSimpleWordDiff } from '../utils/spellcheck';

interface SpellCheckModalProps {
  proposals: FieldCorrectionProposal[];
  onClose: () => void;
  onApply: (correctedFields: Partial<Record<ReviewableFieldKey, string>>) => void;
}

export function SpellCheckModal({ proposals, onClose, onApply }: SpellCheckModalProps) {
  const changedProposals = proposals.filter((p) => p.changed);

  const [selectedFields, setSelectedFields] = useState<Set<ReviewableFieldKey>>(
    () => new Set(changedProposals.map((p) => p.field))
  );

  useEffect(() => {
    setSelectedFields(new Set(proposals.filter((p) => p.changed).map((p) => p.field)));
  }, [proposals]);

  const toggleField = (field: ReviewableFieldKey) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const result: Partial<Record<ReviewableFieldKey, string>> = {};
    for (const item of changedProposals) {
      if (selectedFields.has(item.field)) {
        result[item.field] = item.proposed;
      }
    }
    onApply(result);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="spellcheck-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-xl">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id="spellcheck-title" className="text-lg font-bold text-slate-900">
              Rectificar escritura y ortografía
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Revisa las correcciones propuestas localmente y confirma únicamente los cambios que
              deseas aplicar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de revisión"
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Aviso clínico */}
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 sm:px-6">
          <div className="flex items-start gap-2.5 text-xs text-slate-700">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
            <p>
              Esta revisión se ejecuta localmente en tu navegador. Corrige ortografía evidente,
              tildes y espacios sin alterar nombres propios, medicamentos, siglas ni agregar
              información clínica nueva. No sustituye el criterio del personal de salud.
            </p>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {proposals.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-600">
              No hay texto escrito en los campos para revisar.
            </p>
          ) : changedProposals.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-700" aria-hidden="true" />
              <h3 className="mt-3 text-base font-bold text-slate-900">
                No se detectaron errores ortográficos ni de formato evidentes
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                El texto capturado se mantiene intacto. Puedes editar cualquier campo manualmente si
                necesitas ajustar algún detalle.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {changedProposals.map((item) => {
                const isChecked = selectedFields.has(item.field);
                const { originalSegments, proposedSegments } = computeSimpleWordDiff(
                  item.original,
                  item.proposed
                );

                return (
                  <div
                    key={item.field}
                    className={`rounded-lg border p-4 transition-colors ${
                      isChecked
                        ? 'border-teal-600 bg-teal-50/25'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <label className="flex cursor-pointer items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleField(item.field)}
                          className="h-4 w-4 rounded border-slate-400 text-teal-700 focus:ring-teal-700"
                        />
                        <span className="text-sm font-bold text-slate-900">{item.label}</span>
                      </div>
                      <span className="text-xs text-slate-600">{item.reasons.join(' · ')}</span>
                    </label>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs font-semibold text-slate-600">Texto original</div>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-900">
                          {originalSegments.map((seg, idx) => (
                            <span
                              key={idx}
                              className={
                                seg.changed
                                  ? 'rounded bg-amber-100 px-0.5 text-slate-950 underline decoration-amber-700'
                                  : ''
                              }
                            >
                              {seg.text}
                            </span>
                          ))}
                        </p>
                      </div>

                      <div className="rounded-md border border-teal-200 bg-white p-3">
                        <div className="text-xs font-semibold text-teal-800">
                          Propuesta corregida
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-900">
                          {proposedSegments.map((seg, idx) => (
                            <span
                              key={idx}
                              className={
                                seg.changed
                                  ? 'rounded bg-emerald-100 px-0.5 font-semibold text-emerald-950'
                                  : ''
                              }
                            >
                              {seg.text}
                            </span>
                          ))}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pie de acciones */}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            {changedProposals.length === 0 ? 'Cerrar' : 'Mantener original'}
          </button>

          {changedProposals.length > 0 && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedFields.size === 0}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              <span>
                Aplicar {selectedFields.size}{' '}
                {selectedFields.size === 1 ? 'corrección' : 'correcciones'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
