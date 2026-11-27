import { FIELD_LABELS } from '../config/labels';
import type { FieldCorrectionProposal, ReviewableFieldKey } from '../types/patient';

/**
 * Diccionario local acotado de correcciones ortográficas y tildes inequívocas en español.
 * Principios estrictos:
 * - Solo corrige errores evidentes de ortografía o acentuación.
 * - No modifica nombres propios, medicamentos ni diagnósticos por suposición.
 * - Nunca agrega palabras, síntomas ni información nueva.
 */
const SPANISH_SPELLING_MAP: Readonly<Record<string, string>> = {
  // Síntomas y motivos frecuentes
  cefalia: 'cefalea',
  sefaléa: 'cefalea',
  sefalea: 'cefalea',
  cabesa: 'cabeza',
  nauseas: 'náuseas',
  nausea: 'náusea',
  nausias: 'náuseas',
  vomito: 'vómito',
  vomitos: 'vómitos',
  bomito: 'vómito',
  bomitos: 'vómitos',
  diarea: 'diarrea',
  diareas: 'diarreas',
  toracico: 'torácico',
  toraxico: 'torácico',
  torasico: 'torácico',
  presion: 'presión',
  precion: 'presión',
  hipertension: 'hipertensión',
  hipotension: 'hipotensión',
  lesion: 'lesión',
  lesiones: 'lesiones',
  lecion: 'lesión',
  respiar: 'respirar',
  respiracion: 'respiración',
  migrana: 'migraña',
  migranas: 'migrañas',
  vertigo: 'vértigo',
  feibre: 'fiebre',
  gargata: 'garganta',
  abdomial: 'abdominal',
  adnominal: 'abdominal',
  adbominal: 'abdominal',
  intestnal: 'intestinal',
  intesinal: 'intestinal',
  estomago: 'estómago',
  gastrico: 'gástrico',
  colico: 'cólico',
  colicos: 'cólicos',
  sintoma: 'síntoma',
  sintomas: 'síntomas',
  inflamacion: 'inflamación',
  infeccion: 'infección',
  infecciones: 'infecciones',
  laceracion: 'laceración',
  contusion: 'contusión',
  luxacion: 'luxación',
  deshidratacion: 'deshidratación',
  obstruccion: 'obstrucción',
  irritacion: 'irritación',
  erupcion: 'erupción',
  reaccion: 'reacción',
  alergica: 'alérgica',
  alergico: 'alérgico',
  cronico: 'crónico',
  cronica: 'crónica',
  cardiaco: 'cardíaco',
  cardiaca: 'cardíaca',
  hepaticos: 'hepáticos',
  hepatico: 'hepático',
  hepatica: 'hepática',
  otico: 'ótico',
  oftalmico: 'oftálmico',
  oftalmica: 'oftálmica',
  dermatologico: 'dermatológico',
  dermatologica: 'dermatológica',
  neurologico: 'neurológico',
  neurologica: 'neurológica',
  ginecologico: 'ginecológico',
  ginecologica: 'ginecológica',
  pediatrico: 'pediátrico',
  pediatrica: 'pediátrica',
  traumatico: 'traumático',
  traumatica: 'traumática',
  quirurgico: 'quirúrgico',
  quirurgica: 'quirúrgica',
  diagnostico: 'diagnóstico',
  clinico: 'clínico',
  clinica: 'clínica',
  medico: 'médico',
  medica: 'médica',

  // Términos operativos, observaciones y egreso
  atencion: 'atención',
  valoracion: 'valoración',
  evaluacion: 'evaluación',
  observacion: 'observación',
  observaciones: 'observaciones',
  evolucion: 'evolución',
  revision: 'revisión',
  curacion: 'curación',
  canalizacion: 'canalización',
  hidratacion: 'hidratación',
  nebulizacion: 'nebulización',
  inyeccion: 'inyección',
  aplicacion: 'aplicación',
  administracion: 'administración',
  indicacion: 'indicación',
  medicacion: 'medicación',
  hospitalizacion: 'hospitalización',
  derivacion: 'derivación',
  acompanado: 'acompañado',
  acompanada: 'acompañada',
  acompanante: 'acompañante',
  ambulacia: 'ambulancia',
  anbulancia: 'ambulancia',
  espero: 'esperó',
  retiro: 'retiró',
  llamo: 'llamó',
  atendio: 'atendió',
  traslado: 'traslado',
  remision: 'remisión',
  decision: 'decisión',
  situacion: 'situación',
  condicion: 'condición',
  ubicacion: 'ubicación',
  informacion: 'información',
  comunicacion: 'comunicación',
  autorizacion: 'autorización',
  documentacion: 'documentación',
  identificacion: 'identificación',
  disponibilidad: 'disponibilidad',

  // Palabras comunes de tiempo, edad y redacción
  anos: 'años',
  ano: 'año',
  dias: 'días',
  dia: 'día',
  manana: 'mañana',
  despues: 'después',
  tambien: 'también',
  ademas: 'además',
  aqui: 'aquí',
  ahi: 'ahí',
  asi: 'así',
  segun: 'según',
  traves: 'través',
  numero: 'número',
  ultimo: 'último',
  ultima: 'última',
  ultimos: 'últimos',
  ultimas: 'últimas',
  sabado: 'sábado',
  miercoles: 'miércoles',
  perdida: 'pérdida',
  subito: 'súbito',
  subita: 'súbita',
  rapido: 'rápido',
  rapida: 'rápida',
  dificil: 'difícil',
  facil: 'fácil',
  unico: 'único',
  unica: 'única',
  ningun: 'ningún',
  algun: 'algún',
  estan: 'están',
  esta: 'está',
  habia: 'había',
  tenia: 'tenía',
  podia: 'podía',
  queria: 'quería',
  dolio: 'dolió',
  empezo: 'empezó',
  comenzo: 'comenzó',
  presento: 'presentó',
  acudio: 'acudió',
  refirio: 'refirió',
  ingreso: 'ingreso',
};

/**
 * Palabras ambiguas en español que NO deben tildarse automáticamente sin análisis sintáctico
 * (ej. "esta" puede ser demostrativo o verbo; "retiro" puede ser sustantivo o verbo).
 */
const AMBIGUOUS_WORDS_SKIP = new Set(['esta', 'retiro', 'espero', 'llamo', 'ingreso', 'mas']);

/**
 * Siglas y abreviaturas clínicas que deben conservar su escritura sin alterarse.
 */
const PROTECTED_UPPERCASE_TOKENS = new Set([
  'HTA',
  'DM',
  'DM1',
  'DM2',
  'EPOC',
  'IVU',
  'IRA',
  'IRC',
  'ERC',
  'ECG',
  'EKG',
  'TAC',
  'RMN',
  'RX',
  'UCI',
  'UCIN',
  'EVC',
  'IAM',
  'TEP',
  'TVP',
  'TCE',
  'SIRA',
  'SDRA',
  'VIH',
  'VPH',
  'BH',
  'QS',
  'EGO',
  'PCR',
  'FC',
  'FR',
  'TA',
  'T/A',
  'SPO2',
  'IMC',
  'MMHG',
  'IV',
  'IM',
  'VO',
  'SC',
  'SL',
  'PRN',
  'C/U',
  'S/P',
]);

/**
 * Campos de nombres propios donde NO se reemplazan palabras por diccionario
 * para evitar alterar apellidos, nombres o títulos por suposición.
 */
const PROPER_NAME_FIELDS = new Set<ReviewableFieldKey>([
  'nombre',
  'medico',
  'enfermera',
  'medicoSalida',
  'enfermeraSalida',
]);

function applyCasePattern(source: string, replacement: string): string {
  if (source === source.toUpperCase() && source.length > 1) {
    return replacement.toUpperCase();
  }
  const firstChar = source.charAt(0);
  if (firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function normalizeWhitespaceAndPunctuation(text: string): { value: string; changed: boolean } {
  const original = text;
  const value = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\s+([,.;:!?])/g, '$1')
        .replace(/([,.;:])([^\s\d/.,;:\-─])/g, '$1 $2')
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { value, changed: value !== original };
}

function capitalizeSentences(text: string): { value: string; changed: boolean } {
  const original = text;
  if (!text) return { value: text, changed: false };

  const value = text.replace(
    /(^|[.!?]\s+|\n)([a-záéíóúüñ])/g,
    (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`
  );

  return { value, changed: value !== original };
}

function applySafeSpellingCorrections(text: string): { value: string; changed: boolean } {
  const original = text;

  const tokens = text.split(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9/]+)/);
  let replacedAny = false;

  const updated = tokens.map((token) => {
    if (!token || !/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+$/.test(token)) {
      return token;
    }

    if (PROTECTED_UPPERCASE_TOKENS.has(token.toUpperCase()) && token === token.toUpperCase()) {
      return token;
    }

    const lower = token.toLowerCase();
    if (AMBIGUOUS_WORDS_SKIP.has(lower)) {
      return token;
    }

    const suggestion = SPANISH_SPELLING_MAP[lower];
    if (suggestion && suggestion !== lower) {
      replacedAny = true;
      return applyCasePattern(token, suggestion);
    }

    return token;
  });

  const value = updated.join('');
  return { value, changed: replacedAny && value !== original };
}

export function reviewFieldText(
  field: ReviewableFieldKey,
  originalText: string
): FieldCorrectionProposal {
  const label = FIELD_LABELS[field];
  if (!originalText.trim()) {
    return {
      field,
      label,
      original: originalText,
      proposed: originalText,
      changed: false,
      reasons: [],
    };
  }

  const reasons: string[] = [];
  let current = originalText;

  // 1. Espacios y puntuación básicos (aplica a todos los campos)
  const wsResult = normalizeWhitespaceAndPunctuation(current);
  if (wsResult.changed) {
    current = wsResult.value;
    reasons.push('Espaciado y puntuación normalizados');
  }

  // En nombres propios (paciente, médico, enfermera) solo se normaliza espaciado
  if (PROPER_NAME_FIELDS.has(field)) {
    return {
      field,
      label,
      original: originalText,
      proposed: current,
      changed: current !== originalText,
      reasons,
    };
  }

  // 2. Correcciones ortográficas y tildes inequívocas
  const spellResult = applySafeSpellingCorrections(current);
  if (spellResult.changed) {
    current = spellResult.value;
    reasons.push('Ortografía y acentuación rectificadas');
  }

  // 3. Mayúscula inicial de oración en campos descriptivos y procedencia
  if (
    field === 'motivoVisita' ||
    field === 'observaciones' ||
    field === 'observacionesSalida' ||
    field === 'destinoTraslado' ||
    field === 'diagnostico' ||
    field === 'procedencia'
  ) {
    const capResult = capitalizeSentences(current);
    if (capResult.changed) {
      current = capResult.value;
      reasons.push('Mayúscula inicial ajustada');
    }
  }

  return {
    field,
    label,
    original: originalText,
    proposed: current,
    changed: current !== originalText,
    reasons,
  };
}

export function reviewMultipleFields(
  fields: Partial<Record<ReviewableFieldKey, string>>
): FieldCorrectionProposal[] {
  const orderedKeys: ReviewableFieldKey[] = [
    'nombre',
    'edad',
    'procedencia',
    'motivoVisita',
    'observaciones',
    'observacionesSalida',
    'destinoTraslado',
    'medico',
    'enfermera',
    'medicoSalida',
    'enfermeraSalida',
    'diagnostico',
  ];

  const proposals: FieldCorrectionProposal[] = [];

  for (const key of orderedKeys) {
    if (typeof fields[key] === 'string' && fields[key]!.trim().length > 0) {
      proposals.push(reviewFieldText(key, fields[key]!));
    }
  }

  return proposals;
}

/**
 * Rectifica escritura y ortografía de un mensaje completo de texto plano (por ejemplo,
 * antes de enviarlo por WhatsApp) preservando las etiquetas y líneas de nombres propios.
 */
export function reviewMessageDraft(draftText: string): {
  proposed: string;
  changed: boolean;
  reasons: string[];
} {
  const original = draftText;
  const lines = draftText.replace(/\r\n/g, '\n').split('\n');
  let changedWs = false;
  let changedSpell = false;

  const properLabelPrefixes = [
    'Usuario:',
    'Usuaria:',
    'Paciente:',
    `${FIELD_LABELS.medico}:`,
    `${FIELD_LABELS.enfermera}:`,
    `${FIELD_LABELS.medicoIngreso}:`,
    `${FIELD_LABELS.medicoSalida}:`,
    `${FIELD_LABELS.enfermeraIngreso}:`,
    `${FIELD_LABELS.enfermeraSalida}:`,
  ];

  const fixedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('──') || trimmed.startsWith('REGISTRO DE ')) {
      return trimmed;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      const ws = normalizeWhitespaceAndPunctuation(line);
      if (ws.changed) changedWs = true;
      const sp = applySafeSpellingCorrections(ws.value);
      if (sp.changed) changedSpell = true;
      return sp.value;
    }

    const prefix = line.slice(0, colonIndex + 1).trim();
    const rawValue = line.slice(colonIndex + 1);
    if (!rawValue.trim()) {
      return prefix;
    }

    const ws = normalizeWhitespaceAndPunctuation(rawValue);
    if (ws.changed) changedWs = true;

    const isProperNameLine = properLabelPrefixes.some((label) => prefix === label);
    if (isProperNameLine) {
      return `${prefix} ${ws.value}`;
    }

    const sp = applySafeSpellingCorrections(ws.value);
    if (sp.changed) changedSpell = true;
    return `${prefix} ${sp.value}`;
  });

  const proposed = fixedLines.join('\n');
  const reasons: string[] = [];
  if (changedWs) reasons.push('Espaciado y puntuación normalizados');
  if (changedSpell) reasons.push('Ortografía y acentuación rectificadas');

  return {
    proposed,
    changed: proposed !== original,
    reasons,
  };
}

export interface DiffSegment {
  text: string;
  changed: boolean;
}

/**
 * Compara dos textos por palabras para resaltar visualmente las diferencias
 * en la pantalla de confirmación antes de aplicar cambios.
 */
export function computeSimpleWordDiff(
  original: string,
  proposed: string
): { originalSegments: DiffSegment[]; proposedSegments: DiffSegment[] } {
  const origWords = original.split(/(\s+)/);
  const propWords = proposed.split(/(\s+)/);

  const maxLen = Math.max(origWords.length, propWords.length);
  const originalSegments: DiffSegment[] = [];
  const proposedSegments: DiffSegment[] = [];

  for (let i = 0; i < maxLen; i++) {
    const o = origWords[i];
    const p = propWords[i];

    if (o !== undefined) {
      originalSegments.push({
        text: o,
        changed: o !== p,
      });
    }
    if (p !== undefined) {
      proposedSegments.push({
        text: p,
        changed: o !== p,
      });
    }
  }

  return { originalSegments, proposedSegments };
}
