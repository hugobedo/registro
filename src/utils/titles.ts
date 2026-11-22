export type DoctorTitle = 'DR.' | 'DRA.';

const DOCTOR_PREFIX_REGEX = /^(?:(?:dra?|doctora|doctor)\.?\s+)+/i;
const NURSE_PREFIX_REGEX = /^(?:(?:lic\.?\s*)?(?:enf|enfermero|enfermera)\.?\s+)+/i;

/**
 * Detecta si el nombre capturado ya indica explícitamente "DRA." / "Doctora".
 */
export function detectDoctorTitle(raw: string, fallback: DoctorTitle = 'DR.'): DoctorTitle {
  const trimmed = raw.trim();
  if (/^(?:dra\.?|doctora)\s+/i.test(trimmed)) {
    return 'DRA.';
  }
  if (/^(?:dr\.?|doctor)\s+/i.test(trimmed)) {
    return 'DR.';
  }
  return fallback;
}

/**
 * Elimina cualquier prefijo médico repetido o previo para evitar duplicados (ej. "DR. DR.").
 */
export function stripDoctorPrefix(raw: string): string {
  return raw
    .trim()
    .replace(DOCTOR_PREFIX_REGEX, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Elimina cualquier prefijo de enfermería previo para evitar duplicados (ej. "ENF. ENF.").
 */
export function stripNursePrefix(raw: string): string {
  return raw
    .trim()
    .replace(NURSE_PREFIX_REGEX, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Formatea automáticamente el nombre del médico o médica con el título abreviado correcto:
 * - Médico hombre: DR. JUAN PÉREZ LÓPEZ
 * - Médica mujer: DRA. MARÍA FERNÁNDEZ GÓMEZ
 * Devuelve cadena vacía si no se capturó nombre.
 */
export function formatDoctorName(raw: string, selectedTitle: DoctorTitle): string {
  const resolvedTitle = detectDoctorTitle(raw, selectedTitle);
  const cleanName = stripDoctorPrefix(raw);
  if (!cleanName) return '';
  return `${resolvedTitle} ${cleanName.toLocaleUpperCase('es-MX')}`;
}

/**
 * Formatea automáticamente el nombre del personal de enfermería con el prefijo "ENF.":
 * - Ejemplo: ENF. CARLOS HERNÁNDEZ LÓPEZ
 * Evita duplicar abreviaturas y devuelve cadena vacía si no se capturó nombre.
 */
export function formatNurseName(raw: string): string {
  const cleanName = stripNursePrefix(raw);
  if (!cleanName) return '';
  return `ENF. ${cleanName.toLocaleUpperCase('es-MX')}`;
}
