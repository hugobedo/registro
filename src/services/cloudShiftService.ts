import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocsFromServer,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  ADMIN_EMAIL,
  DEFAULT_SHIFT_SUPERVISOR,
  DEFAULT_WHATSAPP_GROUP_URL,
  WORKSPACE_ID,
} from '../config/labels';
import { db } from '../firebase';
import {
  isExitOutcome,
  type AccessRequestRecord,
  type AccessRequestStatus,
  type AuditActionType,
  type AuditLogEntry,
  type DeleteAuthStatus,
  type ExitOutcome,
  type PatientFormValues,
  type PatientOutcome,
  type PatientRecord,
  type ShiftConfigRecord,
  type StaffRole,
  type StaffUserProfile,
  type TreatmentLabel,
} from '../types/patient';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';
import {
  extractIsoDateFromTimestamp,
  getTodayIsoDate,
  normalizeIsoDate,
} from '../utils/time';

export class ConcurrencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConcurrencyConflictError';
  }
}

export function createSafeDocId(prefix: string): string {
  const raw =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const sanitized = `${prefix}_${raw}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return sanitized;
}

export function sanitizeDocId(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return clean || createSafeDocId('pac');
}

function clampStr(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function parseTreatment(value: unknown): TreatmentLabel {
  if (value === 'usuario' || value === 'usuaria' || value === 'paciente') return value;
  return 'paciente';
}

function parseOutcome(value: unknown, horaSalida: string): PatientOutcome {
  if (value === 'en_atencion' || isExitOutcome(value)) return value;
  return horaSalida.trim().length > 0 ? 'atendido' : 'en_atencion';
}

function mapDocToPatient(id: string, data: Record<string, unknown>): PatientRecord {
  const horaSalida = typeof data.horaSalida === 'string' ? data.horaSalida : '';
  const createdAtIso =
    typeof data.createdAtIso === 'string' && data.createdAtIso
      ? data.createdAtIso
      : new Date().toISOString();
  const updatedAtIso =
    typeof data.updatedAtIso === 'string' && data.updatedAtIso ? data.updatedAtIso : createdAtIso;

  const fechaRegistro =
    normalizeIsoDate(data.fechaRegistro) || extractIsoDateFromTimestamp(createdAtIso);

  return {
    id,
    workspaceId: typeof data.workspaceId === 'string' ? data.workspaceId : WORKSPACE_ID,
    createdAt: createdAtIso,
    updatedAt: updatedAtIso,
    fechaRegistro,
    horaEntrada: typeof data.horaEntrada === 'string' ? data.horaEntrada : '',
    horaSalida,
    estadoEgreso: parseOutcome(data.estadoEgreso, horaSalida),
    destinoTraslado: typeof data.destinoTraslado === 'string' ? data.destinoTraslado : '',
    tratamiento: parseTreatment(data.tratamiento),
    nombre: typeof data.nombre === 'string' ? data.nombre : '',
    edad: typeof data.edad === 'string' ? data.edad : '',
    procedencia: typeof data.procedencia === 'string' ? data.procedencia : '',
    motivoVisita: typeof data.motivoVisita === 'string' ? data.motivoVisita : '',
    observaciones: typeof data.observaciones === 'string' ? data.observaciones : '',
    observacionesSalida:
      typeof data.observacionesSalida === 'string' ? data.observacionesSalida : '',
    medico: typeof data.medico === 'string' ? data.medico : '',
    enfermera: typeof data.enfermera === 'string' ? data.enfermera : '',
    diagnostico: typeof data.diagnostico === 'string' ? data.diagnostico : '',
    version: typeof data.version === 'number' && data.version >= 1 ? data.version : 1,
    createdByUid: typeof data.createdByUid === 'string' ? data.createdByUid : undefined,
    createdByEmail: typeof data.createdByEmail === 'string' ? data.createdByEmail : undefined,
    updatedByUid: typeof data.updatedByUid === 'string' ? data.updatedByUid : undefined,
    updatedByEmail: typeof data.updatedByEmail === 'string' ? data.updatedByEmail : undefined,
  };
}

export async function ensureStaffUserProfile(user: User): Promise<StaffUserProfile> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const isBootstrappedAdmin =
    (user.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase() && user.emailVerified;

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      const displayName = clampStr(user.displayName || data.displayName || user.email || '', 150);
      if (displayName && displayName !== data.displayName) {
        await updateDoc(ref, {
          displayName,
          updatedAt: serverTimestamp(),
        });
      }
      return {
        uid: user.uid,
        email: String(data.email || user.email || ''),
        displayName: displayName || String(data.email || ''),
        role: data.role === 'admin' || isBootstrappedAdmin ? 'admin' : 'staff',
        approved: Boolean(data.approved) || isBootstrappedAdmin,
      };
    }

    const profilePayload = {
      uid: user.uid,
      email: clampStr(user.email || '', 200),
      displayName: clampStr(user.displayName || user.email || 'Personal clínico', 150),
      role: (isBootstrappedAdmin ? 'admin' : 'staff') as StaffRole,
      approved: isBootstrappedAdmin,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, profilePayload);

    return {
      uid: user.uid,
      email: profilePayload.email,
      displayName: profilePayload.displayName,
      role: profilePayload.role,
      approved: profilePayload.approved,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToOwnUserProfile(
  uid: string,
  onUpdate: (profile: StaffUserProfile | null) => void
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      const data = snap.data();
      onUpdate({
        uid: snap.id,
        email: String(data.email || ''),
        displayName: String(data.displayName || ''),
        role: data.role === 'admin' ? 'admin' : 'staff',
        approved: Boolean(data.approved),
      });
    },
    (error) => handleFirestoreError(error, OperationType.GET, path)
  );
}

export function subscribeToAllStaffUsers(
  onUpdate: (users: StaffUserProfile[]) => void,
  onError?: (errorMessage: string) => void
): Unsubscribe {
  const path = 'users';
  const q = query(collection(db, 'users'), where('approved', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const list: StaffUserProfile[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            uid: typeof data.uid === 'string' && data.uid.trim() ? data.uid.trim() : d.id,
            email: String(data.email || ''),
            displayName: String(data.displayName || ''),
            role: (data.role === 'admin' ? 'admin' : 'staff') as StaffRole,
            approved: Boolean(data.approved),
          };
        })
        .sort((a, b) => {
          if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
          return a.email.localeCompare(b.email);
        });
      onUpdate(list);
    },
    (error) => {
      onError?.(
        error instanceof Error
          ? error.message
          : 'No se pudo consultar el personal autorizado en Firestore.'
      );
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function updateStaffMemberAccess(
  targetUser: StaffUserProfile,
  updates: { approved: boolean; role: StaffRole },
  actor: User
): Promise<void> {
  const path = `users/${targetUser.uid}`;
  try {
    await updateDoc(doc(db, 'users', targetUser.uid), {
      approved: updates.approved,
      role: updates.role,
      updatedAt: serverTimestamp(),
    });

    const roleLabel = updates.role === 'admin' ? 'Administrador' : 'Personal';
    const action: AuditActionType = updates.approved ? 'update_staff' : 'revoke_staff_access';
    const summary = updates.approved
      ? targetUser.approved
        ? `Cambió el rol de ${targetUser.email} a ${roleLabel}`
        : `Autorizó acceso a ${targetUser.email} (${roleLabel})`
      : `Revocó el acceso de ${targetUser.email}`;

    await writeAuditLog({
      action,
      actor,
      summary,
      affectedCount: 1,
      patientId: '',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

function formatFirestoreQueryError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const maybeCode =
      'code' in error && typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code.trim()
        : '';
    const maybeMessage =
      'message' in error && typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message.trim()
        : '';
    if (maybeCode && maybeMessage) {
      return maybeMessage.includes(maybeCode) ? maybeMessage : `[${maybeCode}] ${maybeMessage}`;
    }
    if (maybeMessage) return maybeMessage;
    if (maybeCode) return `[${maybeCode}] ${fallback}`;
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  return fallback;
}

function extractAccessRequestIso(data: Record<string, unknown>): string {
  const candidates = [data.requestedAt, data.requestedAtIso];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      const date = new Date(candidate);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    if (
      candidate &&
      typeof candidate === 'object' &&
      'toDate' in candidate &&
      typeof (candidate as { toDate?: unknown }).toDate === 'function'
    ) {
      const date = (candidate as { toDate: () => Date }).toDate();
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    if (candidate && typeof candidate === 'object') {
      const rawSeconds =
        'seconds' in candidate && typeof (candidate as { seconds?: unknown }).seconds === 'number'
          ? (candidate as { seconds: number }).seconds
          : '_seconds' in candidate &&
              typeof (candidate as { _seconds?: unknown })._seconds === 'number'
            ? (candidate as { _seconds: number })._seconds
            : null;
      if (rawSeconds !== null) {
        const date = new Date(rawSeconds * 1000);
        if (!Number.isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
    }
  }
  return '';
}

function parseAccessRequestStatus(rawStatus: unknown): AccessRequestStatus | null {
  if (rawStatus === 'pendiente' || rawStatus === 'aprobada' || rawStatus === 'rechazada') {
    return rawStatus;
  }
  return null;
}

function mapDocToAccessRequest(
  docId: string,
  data: Record<string, unknown>
): AccessRequestRecord | null {
  const status = parseAccessRequestStatus(data.status);
  if (!status) return null;
  const rawRole = data.assignedRole;
  const assignedRole: '' | StaffRole =
    rawRole === 'admin' || rawRole === 'staff' ? rawRole : '';
  const uid = typeof data.uid === 'string' && data.uid.trim() ? data.uid.trim() : docId;

  return {
    uid,
    email: typeof data.email === 'string' ? data.email : '',
    displayName: typeof data.displayName === 'string' ? data.displayName : '',
    status,
    requestedAtIso: extractAccessRequestIso(data),
    reviewedByUid: String(data.reviewedByUid || ''),
    reviewedByEmail: String(data.reviewedByEmail || ''),
    reviewedAtIso: String(data.reviewedAtIso || ''),
    assignedRole,
  };
}

export function subscribeToOwnAccessRequest(
  uid: string,
  onUpdate: (request: AccessRequestRecord | null) => void
): Unsubscribe {
  const path = `access_requests/${uid}`;
  return onSnapshot(
    doc(db, 'access_requests', uid),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate(mapDocToAccessRequest(snap.id, snap.data() as Record<string, unknown>));
    },
    (error) => handleFirestoreError(error, OperationType.GET, path)
  );
}

export async function submitAccessRequest(user: User): Promise<void> {
  if (!user.email || !user.emailVerified) {
    throw new Error('Se requiere una cuenta de Google verificada para solicitar acceso.');
  }
  const path = `access_requests/${user.uid}`;
  const ref = doc(db, 'access_requests', user.uid);
  const nowIso = new Date().toISOString();
  const displayName = clampStr(user.displayName || user.email || 'Usuario', 150);

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      if (parseAccessRequestStatus(existingData.status) === 'pendiente') {
        throw new Error('Ya tienes una solicitud de acceso pendiente de revisión.');
      }
      await updateDoc(ref, {
        displayName,
        status: 'pendiente',
        requestedAt: serverTimestamp(),
        requestedAtIso: nowIso,
        updatedAt: serverTimestamp(),
        reviewedByUid: '',
        reviewedByEmail: '',
        reviewedAtIso: '',
        assignedRole: '',
      });
      return;
    }

    await setDoc(ref, {
      uid: user.uid,
      email: clampStr(user.email, 200),
      displayName,
      status: 'pendiente',
      requestedAt: serverTimestamp(),
      requestedAtIso: nowIso,
      updatedAt: serverTimestamp(),
      reviewedByUid: '',
      reviewedByEmail: '',
      reviewedAtIso: '',
      assignedRole: '',
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('solicitud de acceso pendiente')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchPendingAccessRequestsFromServer(): Promise<AccessRequestRecord[]> {
  const path = 'access_requests';
  const q = query(collection(db, 'access_requests'), where('status', '==', 'pendiente'));
  try {
    const snap = await getDocsFromServer(q);
    return snap.docs
      .map((d) => mapDocToAccessRequest(d.id, d.data() as Record<string, unknown>))
      .filter((item): item is AccessRequestRecord => item !== null && item.status === 'pendiente')
      .sort((a, b) => b.requestedAtIso.localeCompare(a.requestedAtIso));
  } catch (error) {
    const readableMessage = formatFirestoreQueryError(
      error,
      'No se pudieron consultar las solicitudes de acceso en Firestore.'
    );
    try {
      handleFirestoreError(error, OperationType.LIST, path);
    } catch {
      // El error estructurado ya quedó registrado en consola
    }
    throw new Error(readableMessage);
  }
}

export function subscribeToAccessRequests(
  onUpdate: (requests: AccessRequestRecord[], fromCache: boolean) => void,
  onError?: (errorMessage: string) => void
): Unsubscribe {
  const path = 'access_requests';
  const q = query(collection(db, 'access_requests'), where('status', '==', 'pendiente'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapDocToAccessRequest(d.id, d.data() as Record<string, unknown>))
        .filter((item): item is AccessRequestRecord => item !== null && item.status === 'pendiente')
        .sort((a, b) => b.requestedAtIso.localeCompare(a.requestedAtIso));
      onUpdate(list, snap.metadata.fromCache);
    },
    (error) => {
      const readableMessage = formatFirestoreQueryError(
        error,
        'No se pudieron consultar las solicitudes de acceso en Firestore.'
      );
      onError?.(readableMessage);
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {
        // El error estructurado ya quedó registrado en consola
      }
    }
  );
}

export async function approveAccessRequest(
  request: AccessRequestRecord,
  role: StaffRole,
  actor: User
): Promise<void> {
  const path = `access_requests/${request.uid}`;
  const nowIso = new Date().toISOString();
  const safeDisplayName = clampStr(request.displayName || request.email || 'Personal clínico', 150);
  const safeEmail = clampStr(request.email, 200);
  const roleLabel = role === 'admin' ? 'Administrador' : 'Personal';

  try {
    const userRef = doc(db, 'users', request.uid);
    const reqRef = doc(db, 'access_requests', request.uid);
    const logId = createSafeDocId('log');
    const logRef = doc(db, 'audit_logs', logId);
    const userSnap = await getDoc(userRef);

    const batch = writeBatch(db);
    if (userSnap.exists()) {
      batch.update(userRef, {
        role,
        approved: true,
        displayName: safeDisplayName,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(userRef, {
        uid: request.uid,
        email: safeEmail,
        displayName: safeDisplayName,
        role,
        approved: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.update(reqRef, {
      status: 'aprobada',
      assignedRole: role,
      reviewedByUid: actor.uid,
      reviewedByEmail: clampStr(actor.email || '', 200),
      reviewedAtIso: nowIso,
      updatedAt: serverTimestamp(),
    });

    batch.set(logRef, {
      id: logId,
      workspaceId: WORKSPACE_ID,
      action: 'approve_access_request',
      actorUid: actor.uid,
      actorEmail: clampStr(actor.email || '', 200),
      actorName: clampStr(actor.displayName || actor.email || 'Administrador', 150),
      summary: clampStr(
        `Aprobó la solicitud de acceso de ${safeEmail} con rol ${roleLabel}`,
        500
      ),
      affectedCount: 1,
      patientId: '',
      createdAt: serverTimestamp(),
      createdAtIso: nowIso,
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function rejectAccessRequest(
  request: AccessRequestRecord,
  actor: User
): Promise<void> {
  const path = `access_requests/${request.uid}`;
  const nowIso = new Date().toISOString();
  const safeEmail = clampStr(request.email, 200);

  try {
    const reqRef = doc(db, 'access_requests', request.uid);
    const logId = createSafeDocId('log');
    const logRef = doc(db, 'audit_logs', logId);

    const batch = writeBatch(db);
    batch.update(reqRef, {
      status: 'rechazada',
      assignedRole: '',
      reviewedByUid: actor.uid,
      reviewedByEmail: clampStr(actor.email || '', 200),
      reviewedAtIso: nowIso,
      updatedAt: serverTimestamp(),
    });

    batch.set(logRef, {
      id: logId,
      workspaceId: WORKSPACE_ID,
      action: 'reject_access_request',
      actorUid: actor.uid,
      actorEmail: clampStr(actor.email || '', 200),
      actorName: clampStr(actor.displayName || actor.email || 'Administrador', 150),
      summary: clampStr(`Rechazó la solicitud de acceso de ${safeEmail}`, 500),
      affectedCount: 1,
      patientId: '',
      createdAt: serverTimestamp(),
      createdAtIso: nowIso,
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToPatients(
  onUpdate: (patients: PatientRecord[], fromCache: boolean) => void
): Unsubscribe {
  const path = 'patients';
  const q = query(collection(db, 'patients'), where('workspaceId', '==', WORKSPACE_ID));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => {
      const records = snap.docs.map((d) =>
        mapDocToPatient(d.id, d.data() as Record<string, unknown>)
      );
      onUpdate(records, snap.metadata.fromCache);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeToShiftConfig(
  onUpdate: (config: ShiftConfigRecord) => void
): Unsubscribe {
  const path = 'shift_config/current';
  return onSnapshot(
    doc(db, 'shift_config', 'current'),
    (snap) => {
      if (!snap.exists()) {
        onUpdate({
          workspaceId: WORKSPACE_ID,
          responsableGuardia: DEFAULT_SHIFT_SUPERVISOR,
          whatsappGroupUrl: DEFAULT_WHATSAPP_GROUP_URL,
          incluirCamposVaciosEnMensaje: false,
        });
        return;
      }
      const data = snap.data();
      onUpdate({
        workspaceId: WORKSPACE_ID,
        responsableGuardia: DEFAULT_SHIFT_SUPERVISOR,
        whatsappGroupUrl:
          typeof data.whatsappGroupUrl === 'string' && data.whatsappGroupUrl.trim()
            ? data.whatsappGroupUrl
            : DEFAULT_WHATSAPP_GROUP_URL,
        incluirCamposVaciosEnMensaje: Boolean(data.incluirCamposVaciosEnMensaje),
        updatedByEmail: typeof data.updatedByEmail === 'string' ? data.updatedByEmail : undefined,
      });
    },
    (error) => handleFirestoreError(error, OperationType.GET, path)
  );
}

export async function saveShiftConfig(
  updates: {
    whatsappGroupUrl: string;
    incluirCamposVaciosEnMensaje: boolean;
  },
  actor: User
): Promise<void> {
  const path = 'shift_config/current';
  const ref = doc(db, 'shift_config', 'current');
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        workspaceId: WORKSPACE_ID,
        responsableGuardia: DEFAULT_SHIFT_SUPERVISOR,
        whatsappGroupUrl: clampStr(updates.whatsappGroupUrl || DEFAULT_WHATSAPP_GROUP_URL, 300),
        incluirCamposVaciosEnMensaje: Boolean(updates.incluirCamposVaciosEnMensaje),
        updatedAt: serverTimestamp(),
        updatedByUid: actor.uid,
        updatedByEmail: clampStr(actor.email || '', 200),
      });
    } else {
      await updateDoc(ref, {
        whatsappGroupUrl: clampStr(updates.whatsappGroupUrl || DEFAULT_WHATSAPP_GROUP_URL, 300),
        incluirCamposVaciosEnMensaje: Boolean(updates.incluirCamposVaciosEnMensaje),
        updatedAt: serverTimestamp(),
        updatedByUid: actor.uid,
        updatedByEmail: clampStr(actor.email || '', 200),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToAuditLogs(onUpdate: (logs: AuditLogEntry[]) => void): Unsubscribe {
  const path = 'audit_logs';
  const q = query(collection(db, 'audit_logs'), where('workspaceId', '==', WORKSPACE_ID));
  return onSnapshot(
    q,
    (snap) => {
      const entries: AuditLogEntry[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            workspaceId: String(data.workspaceId || WORKSPACE_ID),
            action: (data.action || 'update_patient') as AuditActionType,
            actorUid: String(data.actorUid || ''),
            actorEmail: String(data.actorEmail || ''),
            actorName: String(data.actorName || ''),
            summary: String(data.summary || ''),
            affectedCount: typeof data.affectedCount === 'number' ? data.affectedCount : 0,
            patientId: String(data.patientId || ''),
            createdAtIso: String(data.createdAtIso || ''),
          };
        })
        .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso))
        .slice(0, 120);
      onUpdate(entries);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function writeAuditLog(params: {
  action: AuditActionType;
  actor: User;
  summary: string;
  affectedCount: number;
  patientId?: string;
}): Promise<void> {
  const logId = createSafeDocId('log');
  const path = `audit_logs/${logId}`;
  const nowIso = new Date().toISOString();
  try {
    await setDoc(doc(db, 'audit_logs', logId), {
      id: logId,
      workspaceId: WORKSPACE_ID,
      action: params.action,
      actorUid: params.actor.uid,
      actorEmail: clampStr(params.actor.email || '', 200),
      actorName: clampStr(params.actor.displayName || params.actor.email || 'Personal', 150),
      summary: clampStr(params.summary, 500) || 'Operación registrada',
      affectedCount: Math.max(0, Math.min(10000, Math.floor(params.affectedCount))),
      patientId: clampStr(params.patientId || '', 128),
      createdAt: serverTimestamp(),
      createdAtIso: nowIso,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createPatientInCloud(
  values: PatientFormValues,
  actor: User
): Promise<PatientRecord> {
  const id = createSafeDocId('pac');
  const path = `patients/${id}`;
  const nowIso = new Date().toISOString();

  const fechaRegistro = normalizeIsoDate(values.fechaRegistro) || getTodayIsoDate();

  const payload = {
    id,
    workspaceId: WORKSPACE_ID,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
    createdByUid: actor.uid,
    createdByEmail: clampStr(actor.email || '', 200),
    updatedByUid: actor.uid,
    updatedByEmail: clampStr(actor.email || '', 200),
    version: 1,
    fechaRegistro,
    horaEntrada: clampStr(values.horaEntrada, 10),
    horaSalida: clampStr(values.horaSalida, 10),
    estadoEgreso: values.estadoEgreso,
    destinoTraslado: clampStr(values.destinoTraslado, 200),
    tratamiento: values.tratamiento,
    nombre: clampStr(values.nombre, 200),
    edad: clampStr(values.edad, 60),
    procedencia: clampStr(values.procedencia, 200),
    motivoVisita: clampStr(values.motivoVisita, 1000),
    observaciones: clampStr(values.observaciones, 1500),
    observacionesSalida: clampStr(values.observacionesSalida, 1500),
    medico: clampStr(values.medico, 200),
    enfermera: clampStr(values.enfermera, 200),
    diagnostico: clampStr(values.diagnostico, 1500),
  };

  try {
    await setDoc(doc(db, 'patients', id), payload);
    await writeAuditLog({
      action: 'create_patient',
      actor,
      summary: `Registró ingreso de ${payload.nombre || 'paciente'} (${payload.horaEntrada || 'sin hora'})`,
      affectedCount: 1,
      patientId: id,
    });

    return {
      ...payload,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePatientInCloud(
  existingPatient: PatientRecord,
  values: PatientFormValues,
  actor: User
): Promise<void> {
  const path = `patients/${existingPatient.id}`;
  const ref = doc(db, 'patients', existingPatient.id);
  const nowIso = new Date().toISOString();

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        throw new ConcurrencyConflictError(
          'Este registro ya fue eliminado desde otro dispositivo.'
        );
      }
      const currentVersion =
        typeof snap.data().version === 'number' ? (snap.data().version as number) : 1;
      if (currentVersion !== existingPatient.version) {
        throw new ConcurrencyConflictError(
          'Otro dispositivo modificó este paciente hace unos instantes. Se actualizaron los datos más recientes para evitar sobrescribir cambios.'
        );
      }

      const normalizedDate =
        normalizeIsoDate(values.fechaRegistro) ||
        normalizeIsoDate(existingPatient.fechaRegistro) ||
        extractIsoDateFromTimestamp(existingPatient.createdAt) ||
        getTodayIsoDate();

      tx.update(ref, {
        fechaRegistro: normalizedDate,
        horaEntrada: clampStr(values.horaEntrada, 10),
        horaSalida: clampStr(values.horaSalida, 10),
        estadoEgreso: values.estadoEgreso,
        destinoTraslado: clampStr(values.destinoTraslado, 200),
        tratamiento: values.tratamiento,
        nombre: clampStr(values.nombre, 200),
        edad: clampStr(values.edad, 60),
        procedencia: clampStr(values.procedencia, 200),
        motivoVisita: clampStr(values.motivoVisita, 1000),
        observaciones: clampStr(values.observaciones, 1500),
        observacionesSalida: clampStr(values.observacionesSalida, 1500),
        medico: clampStr(values.medico, 200),
        enfermera: clampStr(values.enfermera, 200),
        diagnostico: clampStr(values.diagnostico, 1500),
        updatedAt: serverTimestamp(),
        updatedAtIso: nowIso,
        updatedByUid: actor.uid,
        updatedByEmail: clampStr(actor.email || '', 200),
        version: currentVersion + 1,
      });
    });

    await writeAuditLog({
      action: 'update_patient',
      actor,
      summary: `Actualizó registro de ${values.nombre.trim() || existingPatient.nombre || 'paciente'}`,
      affectedCount: 1,
      patientId: existingPatient.id,
    });
  } catch (error) {
    if (error instanceof ConcurrencyConflictError) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function registerDischargeInCloud(
  existingPatient: PatientRecord,
  updates: {
    horaSalida: string;
    estadoEgreso: ExitOutcome;
    destinoTraslado?: string;
    observacionesSalida: string;
    medico: string;
    enfermera: string;
    diagnostico: string;
  },
  actor: User
): Promise<void> {
  const path = `patients/${existingPatient.id}`;
  const ref = doc(db, 'patients', existingPatient.id);
  const nowIso = new Date().toISOString();
  const nextDestino = clampStr(
    updates.destinoTraslado !== undefined
      ? updates.destinoTraslado
      : existingPatient.destinoTraslado || '',
    200
  );

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        throw new ConcurrencyConflictError(
          'Este registro ya fue eliminado desde otro dispositivo.'
        );
      }
      const currentVersion =
        typeof snap.data().version === 'number' ? (snap.data().version as number) : 1;
      if (currentVersion !== existingPatient.version) {
        throw new ConcurrencyConflictError(
          'Otro dispositivo actualizó este paciente hace unos instantes. Revisa la versión actualizada antes de guardar.'
        );
      }

      tx.update(ref, {
        horaSalida: clampStr(updates.horaSalida, 10),
        estadoEgreso: updates.estadoEgreso,
        destinoTraslado: nextDestino,
        observacionesSalida: clampStr(updates.observacionesSalida, 1500),
        medico: clampStr(updates.medico, 200),
        enfermera: clampStr(updates.enfermera, 200),
        diagnostico: clampStr(updates.diagnostico, 1500),
        updatedAt: serverTimestamp(),
        updatedAtIso: nowIso,
        updatedByUid: actor.uid,
        updatedByEmail: clampStr(actor.email || '', 200),
        version: currentVersion + 1,
      });
    });

    const patientLabel = existingPatient.nombre || 'paciente';
    const timeSuffix = updates.horaSalida.trim() ? ` a las ${updates.horaSalida.trim()}` : '';
    let auditSummary = `Registró salida (${updates.estadoEgreso}) de ${patientLabel}${timeSuffix}`;
    if (updates.estadoEgreso === 'hospitalizado') {
      auditSummary = `Registró hospitalización de ${patientLabel}${timeSuffix}`;
    } else if (updates.estadoEgreso === 'trasladado') {
      auditSummary = `Registró traslado de ${patientLabel}${nextDestino ? ` a ${nextDestino}` : ''}${timeSuffix}`;
    }

    await writeAuditLog({
      action: 'register_discharge',
      actor,
      summary: auditSummary,
      affectedCount: 1,
      patientId: existingPatient.id,
    });
  } catch (error) {
    if (error instanceof ConcurrencyConflictError) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSinglePatientInCloud(
  patient: PatientRecord,
  actor: User,
  verifiedByEmail?: string
): Promise<void> {
  const path = `patients/${patient.id}`;
  const verifier = verifiedByEmail || actor.email || 'administrador';
  try {
    await deleteDoc(doc(db, 'patients', patient.id));
    await writeAuditLog({
      action: 'delete_patient',
      actor,
      summary: `Eliminación individual autorizada de ${patient.nombre || 'registro'} (verificada por ${verifier})`,
      affectedCount: 1,
      patientId: patient.id,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteAllPatientsInCloud(
  patients: PatientRecord[],
  actor: User,
  verifiedByEmail: string
): Promise<number> {
  const path = 'patients';
  const totalCount = patients.length;
  try {
    const chunkSize = 400;
    for (let i = 0; i < patients.length; i += chunkSize) {
      const chunk = patients.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const patient of chunk) {
        batch.delete(doc(db, 'patients', patient.id));
      }
      await batch.commit();
    }

    await writeAuditLog({
      action: 'delete_all_patients',
      actor,
      summary: `Eliminación total autorizada de ${totalCount} registros (verificada por ${verifiedByEmail})`,
      affectedCount: totalCount,
      patientId: '',
    });

    return totalCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function importPatientsBatchToCloud(
  candidates: PatientRecord[],
  existingIds: Set<string>,
  actor: User,
  action: 'migrate_local' | 'restore_backup'
): Promise<{ imported: number; skippedDuplicates: number }> {
  const path = 'patients';
  const toImport = candidates.filter((p) => !existingIds.has(sanitizeDocId(p.id)));
  const skippedDuplicates = candidates.length - toImport.length;

  if (toImport.length === 0) {
    return { imported: 0, skippedDuplicates };
  }

  try {
    const chunkSize = 350;
    for (let i = 0; i < toImport.length; i += chunkSize) {
      const chunk = toImport.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const item of chunk) {
        const safeId = sanitizeDocId(item.id);
        const nowIso = new Date().toISOString();
        const createdAtIso = clampStr(item.createdAt || nowIso, 40) || nowIso;
        const fechaRegistro =
          normalizeIsoDate(item.fechaRegistro) ||
          extractIsoDateFromTimestamp(createdAtIso) ||
          getTodayIsoDate();
        batch.set(doc(db, 'patients', safeId), {
          id: safeId,
          workspaceId: WORKSPACE_ID,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdAtIso,
          updatedAtIso: clampStr(item.updatedAt || nowIso, 40) || nowIso,
          createdByUid: actor.uid,
          createdByEmail: clampStr(actor.email || '', 200),
          updatedByUid: actor.uid,
          updatedByEmail: clampStr(actor.email || '', 200),
          version: 1,
          fechaRegistro,
          horaEntrada: clampStr(item.horaEntrada, 10),
          horaSalida: clampStr(item.horaSalida, 10),
          estadoEgreso: parseOutcome(item.estadoEgreso, item.horaSalida),
          destinoTraslado: clampStr(item.destinoTraslado || '', 200),
          tratamiento: parseTreatment(item.tratamiento),
          nombre: clampStr(item.nombre, 200),
          edad: clampStr(item.edad, 60),
          procedencia: clampStr(item.procedencia, 200),
          motivoVisita: clampStr(item.motivoVisita, 1000),
          observaciones: clampStr(item.observaciones, 1500),
          observacionesSalida: clampStr(item.observacionesSalida || '', 1500),
          medico: clampStr(item.medico, 200),
          enfermera: clampStr(item.enfermera, 200),
          diagnostico: clampStr(item.diagnostico, 1500),
        });
      }
      await batch.commit();
    }

    await writeAuditLog({
      action,
      actor,
      summary:
        action === 'migrate_local'
          ? `Migró ${toImport.length} registros previos de almacenamiento local a la nube`
          : `Restauró ${toImport.length} registros desde copia de respaldo JSON`,
      affectedCount: toImport.length,
      patientId: '',
    });

    return { imported: toImport.length, skippedDuplicates };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ---------------------------------------------------------
// Delete Authorization API (Server-side primary + static hash fallback for GitHub Pages)
// ---------------------------------------------------------

const STATIC_DELETE_SALT = 'acemed_static_v2_4c7e1a9d3f208b65';
const STATIC_DELETE_DIGEST =
  '73533767a233d4f897538bf947530e21c37becf10645c6947c6db5be42b44c8d';

async function verifyStaticDeleteDigest(passcode: string): Promise<boolean> {
  const candidate = passcode.trim();
  if (!candidate || typeof crypto === 'undefined' || !crypto.subtle) {
    return false;
  }
  const encoded = new TextEncoder().encode(`${STATIC_DELETE_SALT}:${candidate}`);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  const hex = Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex === STATIC_DELETE_DIGEST;
}

export async function fetchDeleteAuthStatus(user: User): Promise<DeleteAuthStatus> {
  try {
    const token = await user.getIdToken();
    const res = await fetch('/api/delete-auth/status', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      return (await res.json()) as DeleteAuthStatus;
    }
  } catch {
    // Fallback for static hosting (e.g. GitHub Pages) without Express backend
  }
  return {
    configured: true,
    source: 'default',
    isAdmin: (user.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase(),
  };
}

export async function setupServerDeletePasscode(
  user: User,
  passcode: string
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const token = await user.getIdToken();
  const res = await fetch('/api/delete-auth/setup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ passcode }),
  });
  const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
  if (!res.ok) {
    return { ok: false, error: data.error || 'No se pudo configurar la contraseña.' };
  }
  return { ok: true, message: data.message };
}

export async function verifyServerDeletePasscode(
  user: User,
  passcode: string
): Promise<{
  authorized: boolean;
  verifiedAt?: string;
  verifiedByEmail?: string;
  verifiedByName?: string;
  code?: string;
  error?: string;
}> {
  try {
    const token = await user.getIdToken();
    const res = await fetch('/api/delete-auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ passcode }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = (await res.json()) as {
        authorized?: boolean;
        verifiedAt?: string;
        verifiedByEmail?: string;
        verifiedByName?: string;
        code?: string;
        error?: string;
      };
      return {
        authorized: Boolean(data.authorized && res.ok),
        verifiedAt: data.verifiedAt,
        verifiedByEmail: data.verifiedByEmail,
        verifiedByName: data.verifiedByName,
        code: data.code,
        error: data.error,
      };
    }
  } catch {
    // Static hosting fallback below
  }

  const matched = await verifyStaticDeleteDigest(passcode);
  if (!matched) {
    return {
      authorized: false,
      error: 'Contraseña incorrecta. Verifica la clave de autorización.',
    };
  }
  return {
    authorized: true,
    verifiedAt: new Date().toISOString(),
    verifiedByEmail: user.email || '',
    verifiedByName: user.displayName || user.email || 'Administrador',
  };
}

export async function downloadCompleteProjectZip(user: User): Promise<string> {
  const token = await user.getIdToken();
  const res = await fetch('/api/export-project-zip', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    let message = 'No se pudo descargar el archivo ZIP del proyecto.';
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Ignore parse errors
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const filename = 'ACE-MED-proyecto-completo.zip';
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return filename;
}

