import { DEFAULT_SHIFT_SUPERVISOR, DEFAULT_WHATSAPP_GROUP_URL } from '../config/labels';
import {
  isExitOutcome,
  isHospitalizationDischargeType,
  type BackupPayload,
  type PatientOutcome,
  type PatientRecord,
  type ShiftState,
  type TreatmentLabel,
} from '../types/patient';
import {
  extractIsoDateFromTimestamp,
  getIsoDateFilename,
  normalizeIsoDate,
} from './time';

const STORAGE_KEY = 'ace_med_turno_v1';
const MIGRATION_FLAG_KEY = 'ace_med_cloud_migrated_v2';

const DEFAULT_SHIFT_STATE: ShiftState = {
  responsableGuardia: DEFAULT_SHIFT_SUPERVISOR,
  whatsappGroupUrl: DEFAULT_WHATSAPP_GROUP_URL,
  incluirCamposVaciosEnMensaje: false,
  patients: [],
};

function isValidTreatment(value: unknown): value is TreatmentLabel {
  return value === 'paciente' || value === 'usuario' || value === 'usuaria';
}

function resolveStoredOutcome(
  rawOutcome: unknown,
  horaSalida: string,
  horaSegundaEntrada: string,
  horaSegundaSalida: string
): PatientOutcome {
  if (isExitOutcome(rawOutcome)) {
    return rawOutcome;
  }
  if (rawOutcome === 'en_atencion') {
    if (horaSegundaEntrada.trim().length > 0 && horaSegundaSalida.trim().length === 0) {
      return 'en_atencion';
    }
    return 'en_atencion';
  }
  return horaSalida.trim().length > 0 ? 'atendido' : 'en_atencion';
}

export function sanitizePatientRecord(raw: unknown): PatientRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;

  if (typeof item.id !== 'string' || !item.id.trim()) return null;

  const horaSalida = typeof item.horaSalida === 'string' ? item.horaSalida : '';
  const horaSegundaEntrada =
    typeof item.horaSegundaEntrada === 'string' ? item.horaSegundaEntrada : '';
  const horaSegundaSalida =
    typeof item.horaSegundaSalida === 'string' ? item.horaSegundaSalida : '';
  const rawReingresos =
    typeof item.reingresosCount === 'number' && Number.isFinite(item.reingresosCount)
      ? Math.max(0, Math.min(100, Math.floor(item.reingresosCount)))
      : horaSegundaEntrada.trim().length > 0
        ? 1
        : 0;
  const createdAt = typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString();
  const fechaRegistro =
    normalizeIsoDate(item.fechaRegistro) || extractIsoDateFromTimestamp(createdAt);

  return {
    id: item.id,
    createdAt,
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : createdAt,
    fechaRegistro,
    fechaSalida: normalizeIsoDate(item.fechaSalida),
    fechaSegundaEntrada: normalizeIsoDate(item.fechaSegundaEntrada),
    horaEntrada: typeof item.horaEntrada === 'string' ? item.horaEntrada : '',
    horaSalida,
    horaSegundaEntrada,
    horaSegundaSalida,
    reingresosCount: rawReingresos,
    estadoEgreso: resolveStoredOutcome(
      item.estadoEgreso,
      horaSalida,
      horaSegundaEntrada,
      horaSegundaSalida
    ),
    tipoAltaHospitalizacion: isHospitalizationDischargeType(item.tipoAltaHospitalizacion)
      ? item.tipoAltaHospitalizacion
      : '',
    destinoTraslado: typeof item.destinoTraslado === 'string' ? item.destinoTraslado : '',
    tratamiento: isValidTreatment(item.tratamiento) ? item.tratamiento : 'paciente',
    nombre: typeof item.nombre === 'string' ? item.nombre : '',
    edad: typeof item.edad === 'string' ? item.edad : '',
    procedencia: typeof item.procedencia === 'string' ? item.procedencia : '',
    motivoVisita: typeof item.motivoVisita === 'string' ? item.motivoVisita : '',
    observaciones: typeof item.observaciones === 'string' ? item.observaciones : '',
    observacionesSalida:
      typeof item.observacionesSalida === 'string' ? item.observacionesSalida : '',
    medico: typeof item.medico === 'string' ? item.medico : '',
    enfermera: typeof item.enfermera === 'string' ? item.enfermera : '',
    diagnostico: typeof item.diagnostico === 'string' ? item.diagnostico : '',
    version: typeof item.version === 'number' && item.version >= 1 ? item.version : 1,
  };
}

export function loadLegacyLocalPatients(): PatientRecord[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<ShiftState>;
    if (!Array.isArray(parsed.patients)) return [];
    return parsed.patients
      .map(sanitizePatientRecord)
      .filter((entry): entry is PatientRecord => entry !== null);
  } catch {
    return [];
  }
}

export function hasPendingLocalMigration(): boolean {
  try {
    if (window.localStorage.getItem(MIGRATION_FLAG_KEY) === 'done') return false;
    return loadLegacyLocalPatients().length > 0;
  } catch {
    return false;
  }
}

export function markLocalMigrationCompleted(): void {
  try {
    window.localStorage.setItem(MIGRATION_FLAG_KEY, 'done');
  } catch {
    // Ignore storage restriction
  }
}

export function loadShiftState(): ShiftState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SHIFT_STATE, patients: [] };

    const parsed = JSON.parse(raw) as Partial<ShiftState>;
    const patients = Array.isArray(parsed.patients)
      ? parsed.patients
          .map(sanitizePatientRecord)
          .filter((entry): entry is PatientRecord => entry !== null)
      : [];

    const storedGroupUrl =
      typeof parsed.whatsappGroupUrl === 'string' ? parsed.whatsappGroupUrl.trim() : '';

    return {
      responsableGuardia: DEFAULT_SHIFT_SUPERVISOR,
      whatsappGroupUrl: storedGroupUrl || DEFAULT_WHATSAPP_GROUP_URL,
      incluirCamposVaciosEnMensaje: Boolean(parsed.incluirCamposVaciosEnMensaje),
      patients,
    };
  } catch {
    return { ...DEFAULT_SHIFT_STATE, patients: [] };
  }
}

export function exportPatientsBackupJson(
  patients: PatientRecord[],
  exportedBy: string
): string {
  const payload: BackupPayload = {
    app: 'ACE-MED',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    exportedBy,
    responsableGuardia: DEFAULT_SHIFT_SUPERVISOR,
    patients,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const filename = `ACE-MED_Respaldo_${getIsoDateFilename(new Date())}.json`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return filename;
}

export function parsePatientsBackupJson(rawText: string): PatientRecord[] {
  const parsed = JSON.parse(rawText) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('El archivo de respaldo no tiene un formato JSON válido.');
  }

  const candidateList = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { patients?: unknown }).patients)
      ? ((parsed as { patients: unknown[] }).patients)
      : null;

  if (!candidateList) {
    throw new Error('No se encontró la lista de pacientes dentro del archivo de respaldo.');
  }

  return candidateList
    .map(sanitizePatientRecord)
    .filter((entry): entry is PatientRecord => entry !== null);
}
