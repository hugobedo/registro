/**
 * Utilidades de fecha y hora.
 * Internamente los horarios se almacenan en formato canónico "HH:mm" (00:00–23:59)
 * para garantizar un ordenamiento cronológico exacto, y se capturan y muestran
 * siempre en formato de 12 horas (a. m. / p. m.).
 */

export type Meridiem = 'AM' | 'PM';

export interface Time12hParts {
  hour12: string; // '01' - '12'
  minute: string; // '00' - '59'
  period: Meridiem;
}

export function getCurrentTime24h(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function normalizeTime24h(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const match24 = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (match24) {
    const hours = Number(match24[1]);
    const minutes = Number(match24[2]);
    if (!Number.isNaN(hours) && !Number.isNaN(minutes) && hours <= 23 && minutes <= 59) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
  }

  return trimmed;
}

export function parseTimeTo12hParts(value: string): Time12hParts | null {
  const normalized = normalizeTime24h(value);
  const match = /^(\d{2}):(\d{2})$/.exec(normalized);
  if (!match) return null;

  const hours24 = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours24) || Number.isNaN(minutes) || hours24 > 23 || minutes > 59) {
    return null;
  }

  const period: Meridiem = hours24 >= 12 ? 'PM' : 'AM';
  const hour12Num = hours24 % 12 === 0 ? 12 : hours24 % 12;

  return {
    hour12: String(hour12Num).padStart(2, '0'),
    minute: String(minutes).padStart(2, '0'),
    period,
  };
}

export function buildTime24hFrom12hParts(
  hour12: string,
  minute: string,
  period: Meridiem
): string {
  const hNum = Math.min(12, Math.max(1, Number(hour12) || 12));
  const mNum = Math.min(59, Math.max(0, Number(minute) || 0));

  let hours24 = hNum % 12;
  if (period === 'PM') {
    hours24 += 12;
  }

  return `${String(hours24).padStart(2, '0')}:${String(mNum).padStart(2, '0')}`;
}

export function formatTime12h(value: string): string {
  const parts = parseTimeTo12hParts(value);
  if (!parts) return value.trim();
  const suffix = parts.period === 'AM' ? 'a. m.' : 'p. m.';
  return `${parts.hour12}:${parts.minute} ${suffix}`;
}

export function getCurrentTime12h(date: Date = new Date()): string {
  return formatTime12h(getCurrentTime24h(date));
}

export function timeToMinutes(value: string): number {
  const normalized = normalizeTime24h(value);
  const match = /^(\d{2}):(\d{2})$/.exec(normalized);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function compareByEntryTime(
  a: { horaEntrada: string; createdAt: string },
  b: { horaEntrada: string; createdAt: string }
): number {
  const diff = timeToMinutes(a.horaEntrada) - timeToMinutes(b.horaEntrada);
  if (diff !== 0) return diff;
  return a.createdAt.localeCompare(b.createdAt);
}

export function formatReportDateEs(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatShortDateEs(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function getIsoDateFilename(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
