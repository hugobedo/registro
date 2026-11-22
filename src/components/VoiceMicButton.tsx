import { Mic, MicOff } from 'lucide-react';

interface VoiceMicButtonProps {
  fieldLabel: string;
  isActive: boolean;
  isSupported: boolean;
  onClick: () => void;
}

export function VoiceMicButton({
  fieldLabel,
  isActive,
  isSupported,
  onClick,
}: VoiceMicButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      aria-label={
        isActive
          ? `Detener dictado por voz en ${fieldLabel}`
          : `Iniciar dictado por voz en ${fieldLabel}`
      }
      title={
        !isSupported
          ? 'Dictado por voz no compatible en este navegador'
          : isActive
            ? 'Detener dictado'
            : 'Dictar por voz (agrega texto sin borrar lo escrito)'
      }
      className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
        isActive
          ? 'border-red-700 bg-red-700 text-white hover:bg-red-800'
          : isSupported
            ? 'border-slate-300 bg-white text-slate-700 hover:border-teal-700 hover:bg-teal-50 hover:text-teal-900'
            : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
      }`}
    >
      {isActive ? (
        <>
          <MicOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Detener</span>
        </>
      ) : (
        <>
          <Mic className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Dictar</span>
        </>
      )}
    </button>
  );
}
