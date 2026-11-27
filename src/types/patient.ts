export type TreatmentLabel = 'paciente' | 'usuario' | 'usuaria';

export type ExitOutcome =
  | 'atendido'
  | 'no_espero_turno'
  | 'no_atendido'
  | 'trasladado'
  | 'hospitalizado';

export type PatientOutcome = 'en_atencion' | ExitOutcome;

export type HospitalizationDischargeType = '' | 'alta_medica' | 'alta_voluntaria';

export type MessageType = 'ingreso' | 'salida';

export type StaffRole = 'admin' | 'staff';

export type AuditActionType =
  | 'create_patient'
  | 'update_patient'
  | 'register_discharge'
  | 'register_readmission'
  | 'delete_patient'
  | 'delete_all_patients'
  | 'restore_backup'
  | 'migrate_local'
  | 'update_staff'
  | 'approve_access_request'
  | 'reject_access_request'
  | 'revoke_staff_access';

export type AccessRequestStatus = 'pendiente' | 'aprobada' | 'rechazada';

export interface PatientRecord {
  id: string;
  workspaceId?: string;
  createdAt: string;
  updatedAt: string;
  fechaRegistro: string;
  fechaSalida: string;
  fechaSegundaEntrada: string;
  horaEntrada: string;
  horaSalida: string;
  horaSegundaEntrada: string;
  horaSegundaSalida: string;
  reingresosCount: number;
  estadoEgreso: PatientOutcome;
  tipoAltaHospitalizacion: HospitalizationDischargeType;
  destinoTraslado: string;
  tratamiento: TreatmentLabel;
  nombre: string;
  edad: string;
  procedencia: string;
  motivoVisita: string;
  observaciones: string;
  observacionesSalida: string;
  medico: string;
  enfermera: string;
  medicoSalida: string;
  enfermeraSalida: string;
  diagnostico: string;
  version: number;
  createdByUid?: string;
  createdByEmail?: string;
  updatedByUid?: string;
  updatedByEmail?: string;
}

export interface PatientFormValues {
  fechaRegistro: string;
  horaEntrada: string;
  horaSalida: string;
  horaSegundaEntrada?: string;
  horaSegundaSalida?: string;
  estadoEgreso: PatientOutcome;
  destinoTraslado: string;
  tratamiento: TreatmentLabel;
  nombre: string;
  edad: string;
  procedencia: string;
  motivoVisita: string;
  observaciones: string;
  observacionesSalida: string;
  medico: string;
  enfermera: string;
  diagnostico: string;
}

export interface ShiftState {
  responsableGuardia: string;
  whatsappGroupUrl: string;
  incluirCamposVaciosEnMensaje: boolean;
  patients: PatientRecord[];
}

export interface ShiftConfigRecord {
  workspaceId: string;
  responsableGuardia: string;
  whatsappGroupUrl: string;
  incluirCamposVaciosEnMensaje: boolean;
  updatedAtIso?: string;
  updatedByEmail?: string;
}

export interface StaffUserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: StaffRole;
  approved: boolean;
  createdAtIso?: string;
  updatedAtIso?: string;
}

export interface AccessRequestRecord {
  uid: string;
  email: string;
  displayName: string;
  status: AccessRequestStatus;
  requestedAtIso: string;
  reviewedByUid: string;
  reviewedByEmail: string;
  reviewedAtIso: string;
  assignedRole: '' | StaffRole;
}

export interface AuditLogEntry {
  id: string;
  workspaceId: string;
  action: AuditActionType;
  actorUid: string;
  actorEmail: string;
  actorName: string;
  summary: string;
  affectedCount: number;
  patientId: string;
  createdAtIso: string;
}

export interface BackupPayload {
  app: 'ACE-MED';
  schemaVersion: 2;
  exportedAt: string;
  exportedBy: string;
  responsableGuardia: string;
  patients: PatientRecord[];
}

export interface DeleteAuthStatus {
  configured: boolean;
  source: 'env' | 'server_setup' | 'default' | 'unconfigured';
  isAdmin: boolean;
}

export type ReviewableFieldKey =
  | 'nombre'
  | 'edad'
  | 'procedencia'
  | 'motivoVisita'
  | 'observaciones'
  | 'observacionesSalida'
  | 'destinoTraslado'
  | 'medico'
  | 'enfermera'
  | 'medicoSalida'
  | 'enfermeraSalida'
  | 'diagnostico';

export interface FieldCorrectionProposal {
  field: ReviewableFieldKey;
  label: string;
  original: string;
  proposed: string;
  changed: boolean;
  reasons: string[];
}

export interface ShiftCounts {
  total: number;
  enAtencion: number;
  atendidos: number;
  noEsperoTurno: number;
  noAtendidos: number;
  trasladados: number;
  hospitalizados: number;
  reingresos: number;
  salidasTotales: number;
}

export function isExitOutcome(value: unknown): value is ExitOutcome {
  return (
    value === 'atendido' ||
    value === 'no_espero_turno' ||
    value === 'no_atendido' ||
    value === 'trasladado' ||
    value === 'hospitalizado'
  );
}

export function isHospitalizationDischargeType(
  value: unknown
): value is HospitalizationDischargeType {
  return value === '' || value === 'alta_medica' || value === 'alta_voluntaria';
}

export function hasDistinctDischargeDoctor(
  patient: Pick<PatientRecord, 'medico' | 'medicoSalida'>
): boolean {
  const outDoctor = (patient.medicoSalida || '').trim();
  if (!outDoctor) return false;
  return outDoctor.toLowerCase() !== (patient.medico || '').trim().toLowerCase();
}

export function hasDistinctDischargeNurse(
  patient: Pick<PatientRecord, 'enfermera' | 'enfermeraSalida'>
): boolean {
  const outNurse = (patient.enfermeraSalida || '').trim();
  if (!outNurse) return false;
  return outNurse.toLowerCase() !== (patient.enfermera || '').trim().toLowerCase();
}

export function hasReadmission(
  patient: Pick<PatientRecord, 'horaSegundaEntrada' | 'reingresosCount'>
): boolean {
  return (
    (typeof patient.horaSegundaEntrada === 'string' &&
      patient.horaSegundaEntrada.trim().length > 0) ||
    (typeof patient.reingresosCount === 'number' && patient.reingresosCount > 0)
  );
}

export function hasActiveReadmission(
  patient: Pick<PatientRecord, 'horaSegundaEntrada' | 'horaSegundaSalida' | 'estadoEgreso'>
): boolean {
  return (
    patient.estadoEgreso === 'en_atencion' &&
    typeof patient.horaSegundaEntrada === 'string' &&
    patient.horaSegundaEntrada.trim().length > 0 &&
    (!patient.horaSegundaSalida || patient.horaSegundaSalida.trim().length === 0)
  );
}

export function getPatientOutcome(
  patient: Pick<PatientRecord, 'horaSalida' | 'estadoEgreso'> & {
    horaSegundaEntrada?: string;
    horaSegundaSalida?: string;
  }
): PatientOutcome {
  if (isExitOutcome(patient.estadoEgreso)) {
    return patient.estadoEgreso;
  }
  if (
    patient.estadoEgreso === 'en_atencion' &&
    typeof patient.horaSegundaEntrada === 'string' &&
    patient.horaSegundaEntrada.trim().length > 0 &&
    (!patient.horaSegundaSalida || patient.horaSegundaSalida.trim().length === 0)
  ) {
    return 'en_atencion';
  }
  if (patient.horaSalida.trim().length > 0) {
    return 'atendido';
  }
  return 'en_atencion';
}

export function hasRegisteredExit(
  patient: Pick<PatientRecord, 'horaSalida' | 'estadoEgreso'> & {
    horaSegundaEntrada?: string;
    horaSegundaSalida?: string;
  }
): boolean {
  return getPatientOutcome(patient) !== 'en_atencion';
}

export function computeShiftCounts(patients: PatientRecord[]): ShiftCounts {
  const counts: ShiftCounts = {
    total: patients.length,
    enAtencion: 0,
    atendidos: 0,
    noEsperoTurno: 0,
    noAtendidos: 0,
    trasladados: 0,
    hospitalizados: 0,
    reingresos: 0,
    salidasTotales: 0,
  };

  for (const patient of patients) {
    if (hasReadmission(patient)) {
      counts.reingresos += 1;
    }

    const outcome = getPatientOutcome(patient);
    switch (outcome) {
      case 'atendido':
        counts.atendidos += 1;
        counts.salidasTotales += 1;
        break;
      case 'no_espero_turno':
        counts.noEsperoTurno += 1;
        counts.salidasTotales += 1;
        break;
      case 'no_atendido':
        counts.noAtendidos += 1;
        counts.salidasTotales += 1;
        break;
      case 'trasladado':
        counts.trasladados += 1;
        counts.salidasTotales += 1;
        break;
      case 'hospitalizado':
        counts.hospitalizados += 1;
        counts.salidasTotales += 1;
        break;
      default:
        counts.enAtencion += 1;
        break;
    }
  }

  return counts;
}
