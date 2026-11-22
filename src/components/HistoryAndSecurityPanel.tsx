import { useRef, useState } from 'react';
import {
  CloudUpload,
  DatabaseBackup,
  Download,
  FileDown,
  History,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Upload,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { ADMIN_EMAIL, DEFAULT_SHIFT_SUPERVISOR } from '../config/labels';
import type {
  AccessRequestRecord,
  AuditActionType,
  AuditLogEntry,
  PatientRecord,
  StaffRole,
  StaffUserProfile,
} from '../types/patient';
import { formatShortDateEs, formatTime12h } from '../utils/time';

interface HistoryAndSecurityPanelProps {
  patients: PatientRecord[];
  auditLogs: AuditLogEntry[];
  staffUsers: StaffUserProfile[];
  staffUsersError?: string | null;
  accessRequests: AccessRequestRecord[];
  accessRequestsLoading?: boolean;
  accessRequestsError?: string | null;
  currentUserEmail: string;
  isAdmin: boolean;
  isPrimaryAdmin: boolean;
  legacyLocalCount: number;
  onExportJsonBackup: () => void;
  onRestoreJsonBackup: (rawText: string) => Promise<void>;
  onMigrateLocalRecords: () => Promise<void>;
  onDownloadPdf: () => void;
  onDownloadProjectZip: () => Promise<void>;
  onOpenClearModal: () => void;
  onUpdateStaffAccess: (
    user: StaffUserProfile,
    updates: { approved: boolean; role: StaffRole }
  ) => Promise<void>;
  onRefreshAccessRequests?: () => Promise<void>;
  onApproveAccessRequest: (request: AccessRequestRecord, role: StaffRole) => Promise<void>;
  onRejectAccessRequest: (request: AccessRequestRecord) => Promise<void>;
}

function getAuditActionLabel(action: AuditActionType): string {
  switch (action) {
    case 'create_patient':
      return 'Nuevo ingreso';
    case 'update_patient':
      return 'Edición';
    case 'register_discharge':
      return 'Registro de salida';
    case 'delete_patient':
      return 'Eliminación individual';
    case 'delete_all_patients':
      return 'Eliminación total';
    case 'restore_backup':
      return 'Restauración';
    case 'migrate_local':
      return 'Migración a la nube';
    case 'update_staff':
      return 'Control de personal';
    case 'approve_access_request':
      return 'Solicitud aprobada';
    case 'reject_access_request':
      return 'Solicitud rechazada';
    case 'revoke_staff_access':
      return 'Acceso revocado';
    default:
      return 'Actividad';
  }
}

function formatAuditTimestamp(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${formatShortDateEs(date)} · ${formatTime12h(`${hh}:${mm}`)}`;
}

export function HistoryAndSecurityPanel({
  patients,
  auditLogs,
  staffUsers,
  staffUsersError = null,
  accessRequests,
  accessRequestsLoading = false,
  accessRequestsError = null,
  currentUserEmail,
  isAdmin,
  isPrimaryAdmin,
  legacyLocalCount,
  onExportJsonBackup,
  onRestoreJsonBackup,
  onMigrateLocalRecords,
  onDownloadPdf,
  onDownloadProjectZip,
  onOpenClearModal,
  onUpdateStaffAccess,
  onRefreshAccessRequests,
  onApproveAccessRequest,
  onRejectAccessRequest,
}: HistoryAndSecurityPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [panelNotice, setPanelNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(
    null
  );
  const [accessSubTab, setAccessSubTab] = useState<'requests' | 'staff'>('requests');
  const [selectedRoles, setSelectedRoles] = useState<Record<string, StaffRole>>({});

  const pendingRequests = accessRequests.filter((req) => req.status === 'pendiente');
  const authorizedStaff = staffUsers.filter((staff) => staff.approved);

  const handleApproveRequestClick = async (request: AccessRequestRecord) => {
    const role: StaffRole = selectedRoles[request.uid] ?? 'staff';
    setBusyAction(`approve_${request.uid}`);
    setPanelNotice(null);
    try {
      await onApproveAccessRequest(request, role);
      setPanelNotice({
        type: 'ok',
        text: `Solicitud aprobada: ${request.email} fue agregado como ${role === 'admin' ? 'Administrador' : 'Personal'}.`,
      });
    } catch (error) {
      setPanelNotice({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo aprobar la solicitud de acceso.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRejectRequestClick = async (request: AccessRequestRecord) => {
    setBusyAction(`reject_${request.uid}`);
    setPanelNotice(null);
    try {
      await onRejectAccessRequest(request);
      setPanelNotice({
        type: 'ok',
        text: `Solicitud rechazada para ${request.email}.`,
      });
    } catch (error) {
      setPanelNotice({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo rechazar la solicitud de acceso.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleStaffAccessChange = async (
    staff: StaffUserProfile,
    updates: { approved: boolean; role: StaffRole }
  ) => {
    setBusyAction(`staff_${staff.uid}`);
    setPanelNotice(null);
    try {
      await onUpdateStaffAccess(staff, updates);
      setPanelNotice({
        type: 'ok',
        text: !updates.approved
          ? `Se revocó el acceso de ${staff.email}.`
          : `Se actualizó el rol de ${staff.email} a ${updates.role === 'admin' ? 'Administrador' : 'Personal'}.`,
      });
    } catch (error) {
      setPanelNotice({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo actualizar el acceso de la cuenta.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusyAction('restore');
    setPanelNotice(null);
    try {
      const text = await file.text();
      await onRestoreJsonBackup(text);
      setPanelNotice({
        type: 'ok',
        text: 'Respaldo importado en la base de datos compartida sin duplicar registros.',
      });
    } catch (error) {
      setPanelNotice({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo leer el archivo de respaldo seleccionado.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleMigrateClick = async () => {
    setBusyAction('migrate');
    setPanelNotice(null);
    try {
      await onMigrateLocalRecords();
      setPanelNotice({
        type: 'ok',
        text: 'Registros locales migrados correctamente a la base de datos compartida.',
      });
    } catch {
      setPanelNotice({
        type: 'error',
        text: 'Ocurrió un problema al migrar los registros locales.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownloadZipClick = async () => {
    setBusyAction('zip');
    setPanelNotice(null);
    try {
      await onDownloadProjectZip();
      setPanelNotice({
        type: 'ok',
        text: 'Paquete completo ACE-MED-proyecto-completo.zip descargado (listo para GitHub).',
      });
    } catch (error) {
      setPanelNotice({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo descargar el paquete completo del proyecto.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-6">
      {panelNotice && (
        <div
          role={panelNotice.type === 'error' ? 'alert' : 'status'}
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            panelNotice.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          {panelNotice.text}
        </div>
      )}

      {/* Respaldo, recuperación y migración */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3 border-b border-slate-200 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <DatabaseBackup className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Respaldo y recuperación de la base de datos compartida
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Todos los registros se almacenan en la nube y se sincronizan en tiempo real entre
              computadoras, tabletas y teléfonos. Puedes generar copias de respaldo JSON, informes
              PDF o descargar el código fuente completo para GitHub.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={onExportJsonBackup}
            disabled={patients.length === 0}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-teal-700 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-900 transition-colors hover:bg-teal-100 disabled:opacity-50"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Respaldo JSON</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busyAction === 'restore'}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {busyAction === 'restore' ? 'Restaurando...' : 'Restaurar JSON'}
            </span>
          </button>

          <button
            type="button"
            onClick={onDownloadPdf}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
          >
            <FileDown className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Informe PDF</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => void handleDownloadZipClick()}
              disabled={busyAction === 'zip'}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{busyAction === 'zip' ? 'Empaquetando...' : 'Proyecto completo (.zip)'}</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {legacyLocalCount > 0 && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-amber-950">
              <p className="font-bold">
                Se detectaron {legacyLocalCount}{' '}
                {legacyLocalCount === 1 ? 'registro previo' : 'registros previos'} en este navegador
              </p>
              <p className="mt-0.5 text-xs text-amber-900">
                Súbelos a la base de datos compartida en la nube sin duplicar pacientes existentes.
              </p>
            </div>
            <button
              type="button"
              onClick={handleMigrateClick}
              disabled={busyAction === 'migrate'}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-amber-700 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
            >
              <CloudUpload className="h-4 w-4" aria-hidden="true" />
              <span>
                {busyAction === 'migrate' ? 'Migrando...' : 'Migrar registros a la nube'}
              </span>
            </button>
          </div>
        )}
      </section>

      {/* Control de personal autorizado (solo Administrador principal) */}
      {isPrimaryAdmin && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Users className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Personal autorizado (Control de acceso)
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Revisa solicitudes de acceso, asigna el rol correspondiente o revoca el acceso de
                  cuentas autorizadas.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setAccessSubTab('requests')}
                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  accessSubTab === 'requests'
                    ? 'border-teal-700 bg-teal-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>Solicitudes de acceso</span>
                <span className="font-mono">
                  (
                  {accessRequestsError
                    ? '!'
                    : accessRequestsLoading
                      ? '...'
                      : pendingRequests.length}
                  )
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAccessSubTab('staff')}
                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  accessSubTab === 'staff'
                    ? 'border-teal-700 bg-teal-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>Personal autorizado</span>
                <span className="font-mono">
                  ({staffUsersError ? '!' : authorizedStaff.length})
                </span>
              </button>
            </div>
          </div>

          {accessSubTab === 'requests' ? (
            <div className="mt-4">
              {onRefreshAccessRequests && (
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    {accessRequestsLoading
                      ? 'Consultando solicitudes pendientes en el servidor...'
                      : accessRequestsError
                        ? 'La consulta a Firestore devolvió un error.'
                        : `${pendingRequests.length} ${pendingRequests.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}`}
                  </span>
                  <button
                    type="button"
                    disabled={accessRequestsLoading}
                    onClick={() => void onRefreshAccessRequests()}
                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${accessRequestsLoading ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    <span>{accessRequestsLoading ? 'Consultando...' : 'Actualizar'}</span>
                  </button>
                </div>
              )}

              {accessRequestsError ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-bold">Error al consultar las solicitudes de acceso</p>
                      <p className="mt-1 font-mono text-xs break-words">{accessRequestsError}</p>
                    </div>
                    {onRefreshAccessRequests && (
                      <button
                        type="button"
                        disabled={accessRequestsLoading}
                        onClick={() => void onRefreshAccessRequests()}
                        className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-800 transition-colors hover:bg-red-100 disabled:opacity-60"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${accessRequestsLoading ? 'animate-spin' : ''}`}
                          aria-hidden="true"
                        />
                        <span>Reintentar</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : accessRequestsLoading && pendingRequests.length === 0 ? (
                <p role="status" className="py-3 text-sm text-slate-500">
                  Cargando solicitudes de acceso pendientes...
                </p>
              ) : pendingRequests.length === 0 ? (
                <p className="py-2 text-sm text-slate-500">
                  No hay solicitudes de acceso pendientes.
                </p>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {pendingRequests.map((req) => {
                    const chosenRole: StaffRole = selectedRoles[req.uid] ?? 'staff';
                    const isRowBusy =
                      busyAction === `approve_${req.uid}` || busyAction === `reject_${req.uid}`;

                    return (
                      <li
                        key={req.uid}
                        className="flex flex-col gap-3 py-3.5 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">
                            {req.displayName || req.email}
                          </div>
                          <p className="text-xs text-slate-600 font-mono truncate">{req.email}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Solicitado:{' '}
                            <span className="font-mono tabular-nums">
                              {formatAuditTimestamp(req.requestedAtIso)}
                            </span>
                            <span className="mx-1.5 text-slate-300">·</span>
                            <span className="font-mono text-[11px] text-slate-400">
                              UID: {req.uid}
                            </span>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <label className="sr-only" htmlFor={`role-req-${req.uid}`}>
                            Rol para {req.email}
                          </label>
                          <select
                            id={`role-req-${req.uid}`}
                            value={chosenRole}
                            disabled={isRowBusy}
                            onChange={(e) =>
                              setSelectedRoles((prev) => ({
                                ...prev,
                                [req.uid]: e.target.value === 'admin' ? 'admin' : 'staff',
                              }))
                            }
                            className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                          >
                            <option value="staff">Personal</option>
                            <option value="admin">Administrador</option>
                          </select>

                          <button
                            type="button"
                            disabled={isRowBusy}
                            onClick={() => void handleApproveRequestClick(req)}
                            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
                          >
                            <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>
                              {busyAction === `approve_${req.uid}` ? 'Aprobando...' : 'Aprobar'}
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={isRowBusy}
                            onClick={() => void handleRejectRequestClick(req)}
                            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 transition-colors hover:bg-red-100 disabled:opacity-60"
                          >
                            <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>
                              {busyAction === `reject_${req.uid}` ? 'Rechazando...' : 'Rechazar'}
                            </span>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : staffUsersError ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              <p className="font-bold">Error al consultar el personal autorizado</p>
              <p className="mt-1 font-mono text-xs break-words">{staffUsersError}</p>
            </div>
          ) : authorizedStaff.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Solo tu cuenta administradora está registrada actualmente.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-200">
              {authorizedStaff.map((staff) => {
                const isSelf = staff.email.toLowerCase() === currentUserEmail.toLowerCase();
                const isAccountPrimaryAdmin =
                  staff.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
                const isRowBusy = busyAction === `staff_${staff.uid}`;

                return (
                  <li
                    key={staff.uid}
                    className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {staff.displayName || staff.email}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          ({staff.role === 'admin' ? 'Administrador' : 'Personal'})
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-mono truncate">{staff.email}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {isAccountPrimaryAdmin || isSelf ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                          <UserCheck className="h-4 w-4" aria-hidden="true" />
                          <span>Cuenta principal activa</span>
                        </span>
                      ) : (
                        <>
                          <label className="sr-only" htmlFor={`role-staff-${staff.uid}`}>
                            Rol de {staff.email}
                          </label>
                          <select
                            id={`role-staff-${staff.uid}`}
                            value={staff.role}
                            disabled={isRowBusy}
                            onChange={(e) =>
                              void handleStaffAccessChange(staff, {
                                approved: true,
                                role: e.target.value === 'admin' ? 'admin' : 'staff',
                              })
                            }
                            className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                          >
                            <option value="staff">Personal</option>
                            <option value="admin">Administrador</option>
                          </select>

                          <button
                            type="button"
                            disabled={isRowBusy}
                            onClick={() =>
                              void handleStaffAccessChange(staff, {
                                approved: false,
                                role: staff.role,
                              })
                            }
                            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 transition-colors hover:bg-red-100 disabled:opacity-60"
                          >
                            <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Revocar acceso</span>
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Zona protegida: Eliminar todos los registros */}
      <section className="rounded-2xl border border-red-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Eliminar todos los registros del turno
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Acción protegida con contraseña validada en el servidor, doble confirmación
                obligatoria y registro en auditoría. El encargado de turno permanente (
                <strong>{DEFAULT_SHIFT_SUPERVISOR}</strong>) se conserva siempre.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenClearModal}
            disabled={patients.length === 0}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span>Eliminar todos los registros</span>
          </button>
        </div>
      </section>

      {/* Historial de auditoría */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3 border-b border-slate-200 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <History className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Historial de auditoría y modificaciones
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Bitácora inmutable de altas, egresos, restauraciones y eliminaciones totales con fecha,
              hora y usuario responsable.
            </p>
          </div>
        </div>

        {auditLogs.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Aún no hay eventos registrados en la bitácora del turno.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200">
            {auditLogs.map((log) => (
              <li
                key={log.id}
                className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs font-bold ${
                        log.action === 'delete_all_patients' || log.action === 'delete_patient'
                          ? 'text-red-800'
                          : 'text-teal-800'
                      }`}
                    >
                      {getAuditActionLabel(log.action)}
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs font-semibold text-slate-800">
                      {log.actorName || log.actorEmail}
                    </span>
                    <span className="font-mono text-xs text-slate-500">({log.actorEmail})</span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-700">{log.summary}</p>
                </div>
                <div className="whitespace-nowrap shrink-0 font-mono text-xs tabular-nums text-slate-500">
                  {formatAuditTimestamp(log.createdAtIso)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
