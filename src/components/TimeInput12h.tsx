import { Clock } from 'lucide-react';
import {
  buildTime24hFrom12hParts,
  getCurrentTime24h,
  parseTimeTo12hParts,
  type Meridiem,
} from '../utils/time';

interface TimeInput12hProps {
  id: string;
  value: string; // Formato canónico 'HH:mm' (00:00-23:59) o ''
  onChange: (value24h: string) => void;
  allowEmpty?: boolean;
  onNowClick?: () => void;
}

const HOURS_12 = Array.from({ length: 12 }, (_, idx) => String(idx + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, idx) => String(idx).padStart(2, '0'));

export function TimeInput12h({
  id,
  value,
  onChange,
  allowEmpty = false,
  onNowClick,
}: TimeInput12hProps) {
  const parts = parseTimeTo12hParts(value);

  const handleHourChange = (nextHour: string) => {
    if (!nextHour) {
      onChange('');
      return;
    }
    const minute = parts?.minute ?? '00';
    const period: Meridiem = parts?.period ?? 'AM';
    onChange(buildTime24hFrom12hParts(nextHour, minute, period));
  };

  const handleMinuteChange = (nextMinute: string) => {
    if (!nextMinute) {
      onChange('');
      return;
    }
    const hour12 = parts?.hour12 ?? '12';
    const period: Meridiem = parts?.period ?? 'AM';
    onChange(buildTime24hFrom12hParts(hour12, nextMinute, period));
  };

  const handlePeriodChange = (nextPeriod: Meridiem) => {
    const base = parts ?? parseTimeTo12hParts(getCurrentTime24h())!;
    onChange(buildTime24hFrom12hParts(base.hour12, base.minute, nextPeriod));
  };

  const handleNow = () => {
    if (onNowClick) {
      onNowClick();
    } else {
      onChange(getCurrentTime24h());
    }
  };

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <select
        id={id}
        aria-label="Hora (formato 12 horas)"
        value={parts?.hour12 ?? ''}
        onChange={(e) => handleHourChange(e.target.value)}
        className="min-h-[44px] w-[72px] rounded-lg border border-slate-300 bg-white px-2 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-teal-700"
      >
        {allowEmpty && <option value="">--</option>}
        {!allowEmpty && !parts && <option value="">--</option>}
        {HOURS_12.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>

      <span className="font-mono text-sm font-bold text-slate-500" aria-hidden="true">
        :
      </span>

      <select
        id={`${id}-min`}
        aria-label="Minutos"
        value={parts?.minute ?? ''}
        onChange={(e) => handleMinuteChange(e.target.value)}
        className="min-h-[44px] w-[72px] rounded-lg border border-slate-300 bg-white px-2 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-teal-700"
      >
        {allowEmpty && <option value="">--</option>}
        {!allowEmpty && !parts && <option value="">--</option>}
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      <div
        role="radiogroup"
        aria-label="Periodo del día (a. m. o p. m.)"
        className="inline-grid grid-cols-2 gap-0.5 rounded-lg border border-slate-300 bg-slate-100 p-0.5"
      >
        {(['AM', 'PM'] as const).map((period) => {
          const active = parts?.period === period;
          return (
            <button
              key={period}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => handlePeriodChange(period)}
              className={`min-h-[38px] whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-teal-700 text-white'
                  : 'text-slate-700 hover:bg-white hover:text-slate-900'
              }`}
            >
              {period === 'AM' ? 'a. m.' : 'p. m.'}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleNow}
        title="Usar hora actual"
        className="inline-flex min-h-[44px] items-center justify-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
      >
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Ahora</span>
      </button>
    </div>
  );
}
