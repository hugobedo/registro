import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPlus,
  Cloud,
  FileDown,
  Lock,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { AuthGate } from './components/AuthGate';
import { ClearShiftModal } from './components/ClearShiftModal';
import { DischargeModal } from './components/DischargeModal';
import { Header, type ActiveWorkspaceView } from './components/Header';
import { HistoryAndSecurityPanel } from './components/HistoryAndSecurityPanel';
import { PatientForm } from './components/PatientForm';
import { PatientList, type OutcomeFilter } from './components/PatientList';
import { ReportModal } from './components/ReportModal';
import { SpellCheckModal } from './components/SpellCheckModal';
import { WhatsAppModal } from './components/WhatsAppModal';
import {
  ADMIN_EMAIL,
  DEFAULT_SHIFT_SUPERVISOR,
  DEFAULT_WHATSAPP_GROUP_URL,
  WORKSPACE_ID,
} from './config/labels';
import { auth, googleProvider } from './firebase';
import {
  ConcurrencyConflictError,
  approveAccessRequest,
  createPatientInCloud,
  deleteAllPatientsInCloud,
  deleteSinglePatientInCloud,
  downloadCompleteProjectZip,
  ensureStaffUserProfile,
  fetchPendingAccessRequestsFromServer,
  importPatientsBatchToCloud,
  registerDischargeInCloud,
  rejectAccessRequest,
  sanitizeDocId,
  saveShiftConfig,
  submitAccessRequest,
  subscribeToAccessRequests,
  subscribeToAllStaffUsers,
  subscribeToAuditLogs,
  subscribeToOwnAccessRequest,
  subscribeToOwnUserProfile,
  subscribeToPatients,
  subscribeToShiftConfig,
  updatePatientInCloud,
  updateStaffMemberAccess,
} from './services/cloudShiftService';
import {
  computeShiftCounts,
  hasRegisteredExit,
  type AccessRequestRecord,
  type AuditLogEntry,
  type ExitOutcome,
  type FieldCorrectionProposal,
  type MessageType,
  type PatientFormValues,
  type PatientRecord,
  type ReviewableFieldKey,
  type ShiftConfigRecord,
  type StaffRole,
  type StaffUserProfile,
} from './types/patient';
import { generateShiftPdfReport } from './utils/pdfReport';
import { reviewMultipleFields } from './utils/spellcheck';
import {
  exportPatientsBackupJson,
  hasPendingLocalMigration,
  loadLegacyLocalPatients,
  markLocalMigrationCompleted,
  parsePatientsBackupJson,
} from './utils/storage';
import { formatReportDateEs } from './utils/time';

interface SpellCheckSession {
  proposals: FieldCorrectionProposal[];
  onApply: (corrected: Partial<Record<ReviewableFieldKey, string>>) => void;
}

interface WhatsAppSession {
  patientId: string;
  type: MessageType;
}

export default function App() {
  // Estado de autenticación y control de acceso
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffUserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Datos sincronizados en tiempo real desde Firestore
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [patientsLoaded, setPatientsLoaded] = useState(false);
  const [isSyncingFromCache, setIsSyncingFromCache] = useState(false);
  const [shiftConfig, setShiftConfig] = useState<ShiftConfigRecord>({
    workspaceId: WORKSPACE_ID,
    responsableGuardia: DEFAULT_SHIFT_SUPERVISOR,
    whatsappGroupUrl: DEFAULT_WHATSAPP_GROUP_URL,
    incluirCamposVaciosEnMensaje: false,
  });
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUserProfile[]>([]);
  const [staffUsersError, setStaffUsersError] = useState<string | null>(null);
  const [accessRequests, setAccessRequests] = useState<AccessRequestRecord[]>([]);
  const [accessRequestsLoading, setAccessRequestsLoading] = useState(false);
  const [accessRequestsError, setAccessRequestsError] = useState<string | null>(null);
  const [ownAccessRequest, setOwnAccessRequest] = useState<AccessRequestRecord | null>(null);
  const [isSubmittingAccessRequest, setIsSubmittingAccessRequest] = useState(false);
  const [accessRequestFeedback, setAccessRequestFeedback] = useState<{
    type: 'ok' | 'error';
    text: string;
  } | null>(null);

  // Navegación principal: Pacientes | Formato de entrada | Respaldos y auditoría
  const [activeView, setActiveView] = useState<ActiveWorkspaceView>('pacientes');
  const [selectedCategory, setSelectedCategory] = useState<OutcomeFilter>('todos');
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [dischargePatientId, setDischargePatientId] = useState<string | null>(null);
  const [whatsAppSession, setWhatsAppSession] = useState<WhatsAppSession | null>(null);
  const [spellCheckSession, setSpellCheckSession] = useState<SpellCheckSession | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    null | { mode: 'all' } | { mode: 'single'; patient: PatientRecord }
  >(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isSavingRecord, setIsSavingRecord] = useState(false);

  // Avisos, conflictos de concurrencia y migración local
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);
  const [legacyLocalCount, setLegacyLocalCount] = useState<number>(() =>
    hasPendingLocalMigration() ? loadLegacyLocalPatients().length : 0
  );

  const toastTimerRef = useRef<number | null>(null);
  const autoMigrationAttemptedRef = useRef(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3600);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // 1. Escuchar sesión de Firebase Authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      setAuthError(null);
      if (!user) {
        setStaffProfile(null);
        setPatients([]);
        setPatientsLoaded(false);
        setAuditLogs([]);
        setStaffUsers([]);
        setStaffUsersError(null);
        setAccessRequests([]);
        setAccessRequestsError(null);
        setOwnAccessRequest(null);
        setAccessRequestFeedback(null);
        autoMigrationAttemptedRef.current = false;
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Asegurar perfil en /users/{uid} y escuchar cambios de aprobación en tiempo real
  useEffect(() => {
    if (!firebaseUser) return;
    let active = true;
    let unsubProfile: (() => void) | null = null;
    setProfileLoading(true);

    ensureStaffUserProfile(firebaseUser)
      .then((initialProfile) => {
        if (!active) return;
        setStaffProfile(initialProfile);
        setProfileLoading(false);
        unsubProfile = subscribeToOwnUserProfile(firebaseUser.uid, (liveProfile) => {
          if (liveProfile) {
            setStaffProfile(liveProfile);
          }
        });
      })
      .catch(() => {
        if (!active) return;
        setProfileLoading(false);
        setAuthError(
          'No se pudo inicializar tu perfil en la base de datos. Intenta recargar la página.'
        );
      });

    return () => {
      active = false;
      if (unsubProfile) unsubProfile();
    };
  }, [firebaseUser]);

  const isBootstrappedAdmin = Boolean(
    firebaseUser?.email &&
      firebaseUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
      firebaseUser.emailVerified
  );
  const isPrimaryAdmin = isBootstrappedAdmin;
  const isAdmin = Boolean(isBootstrappedAdmin || (staffProfile?.role === 'admin' && staffProfile.approved));
  const isAuthorized = Boolean(isBootstrappedAdmin || staffProfile?.approved);

  // 2b. Escuchar únicamente la solicitud propia cuando el usuario aún no está autorizado
  useEffect(() => {
    if (!firebaseUser || isAuthorized) {
      setOwnAccessRequest(null);
      return;
    }
    const unsubOwnReq = subscribeToOwnAccessRequest(firebaseUser.uid, (req) => {
      setOwnAccessRequest(req);
    });
    return () => unsubOwnReq();
  }, [firebaseUser, isAuthorized]);

  // 3. Suscripciones en tiempo real a Firestore SOLO cuando el usuario está autenticado y autorizado
  useEffect(() => {
    if (!firebaseUser || !isAuthorized) {
      setPatients([]);
      setPatientsLoaded(false);
      setAuditLogs([]);
      setStaffUsers([]);
      setStaffUsersError(null);
      setAccessRequests([]);
      setAccessRequestsLoading(false);
      setAccessRequestsError(null);
      return;
    }

    let active = true;

    const unsubPatients = subscribeToPatients((records, fromCache) => {
      setPatients(records);
      setIsSyncingFromCache(fromCache);
      setPatientsLoaded(true);
    });

    const unsubConfig = subscribeToShiftConfig((config) => {
      setShiftConfig(config);
    });

    const unsubLogs = subscribeToAuditLogs((logs) => {
      setAuditLogs(logs);
    });

    let unsubStaff: (() => void) | null = null;
    let unsubRequests: (() => void) | null = null;
    if (isPrimaryAdmin) {
      setStaffUsersError(null);
      setAccessRequestsError(null);
      setAccessRequestsLoading(true);
      unsubStaff = subscribeToAllStaffUsers(
        (users) => {
          if (!active) return;
          setStaffUsers(users);
          setStaffUsersError(null);
        },
        (errorMessage) => {
          if (!active) return;
          setStaffUsersError(errorMessage);
        }
      );
      unsubRequests = subscribeToAccessRequests(
        (requests, fromCache) => {
          if (!active) return;
          setAccessRequests(requests);
          setAccessRequestsError(null);
          if (!fromCache || requests.length > 0) {
            setAccessRequestsLoading(false);
          }
        },
        (errorMessage) => {
          if (!active) return;
          setAccessRequestsError(errorMessage);
          setAccessRequestsLoading(false);
        }
      );
      void fetchPendingAccessRequestsFromServer()
        .then((requests) => {
          if (!active) return;
          setAccessRequests(requests);
          setAccessRequestsError(null);
          setAccessRequestsLoading(false);
        })
        .catch((error) => {
          if (!active) return;
          setAccessRequestsError(
            error instanceof Error
              ? error.message
              : 'No se pudieron consultar las solicitudes de acceso en Firestore.'
          );
          setAccessRequestsLoading(false);
        });
    } else {
      setAccessRequests([]);
      setAccessRequestsLoading(false);
      setAccessRequestsError(null);
    }

    return () => {
      active = false;
      unsubPatients();
      unsubConfig();
      unsubLogs();
      if (unsubStaff) unsubStaff();
      if (unsubRequests) unsubRequests();
    };
  }, [firebaseUser, isAuthorized, isPrimaryAdmin]);

  // 4. Migración automática segura de registros locales previos (conserva datos sin duplicar)
  useEffect(() => {
    if (
      !firebaseUser ||
      !isAuthorized ||
      !patientsLoaded ||
      autoMigrationAttemptedRef.current ||
      !hasPendingLocalMigration()
    ) {
      return;
    }

    autoMigrationAttemptedRef.current = true;
    const legacyRecords = loadLegacyLocalPatients();
    if (legacyRecords.length === 0) {
      markLocalMigrationCompleted();
      setLegacyLocalCount(0);
      return;
    }

    const existingIds = new Set(patients.map((p) => sanitizeDocId(p.id)));
    importPatientsBatchToCloud(legacyRecords, existingIds, firebaseUser, 'migrate_local')
      .then(({ imported }) => {
        markLocalMigrationCompleted();
        setLegacyLocalCount(0);
        if (imported > 0) {
          showToast(
            `Se conservaron y migraron ${imported} ${imported === 1 ? 'registro previo' : 'registros previos'} a la nube.`
          );
        }
      })
      .catch(() => {
        // Si falla temporalmente, se conserva el botón manual en Respaldos y auditoría
        setLegacyLocalCount(legacyRecords.length);
      });
  }, [firebaseUser, isAuthorized, patientsLoaded, patients]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('popup-closed-by-user')) {
        setAuthError('Se cerró la ventana de inicio de sesión antes de completar el acceso.');
      } else if (msg.includes('popup-blocked')) {
        setAuthError(
          'El navegador bloqueó la ventana de Google. Permite ventanas emergentes e intenta nuevamente.'
        );
      } else {
        setAuthError('No se pudo iniciar sesión con Google. Intenta de nuevo.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const editingPatient = useMemo(
    () => patients.find((p) => p.id === editingPatientId) ?? null,
    [patients, editingPatientId]
  );

  const dischargePatient = useMemo(
    () => patients.find((p) => p.id === dischargePatientId) ?? null,
    [patients, dischargePatientId]
  );

  const whatsAppPatient = useMemo(
    () =>
      whatsAppSession
        ? patients.find((p) => p.id === whatsAppSession.patientId) ?? null
        : null,
    [patients, whatsAppSession]
  );

  const counts = useMemo(() => computeShiftCounts(patients), [patients]);

  const todayDisplay = useMemo(() => {
    const formatted = formatReportDateEs(new Date());
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, []);

  const handleRequestSpellCheck = (
    fields: Partial<Record<ReviewableFieldKey, string>>,
    onApply: (corrected: Partial<Record<ReviewableFieldKey, string>>) => void
  ) => {
    const proposals = reviewMultipleFields(fields);
    setSpellCheckSession({ proposals, onApply });
  };

  const handleSavePatient = async (
    formValues: PatientFormValues,
    openWhatsAppAfterSave: boolean
  ) => {
    if (!firebaseUser) return;
    setIsSavingRecord(true);
    setConflictNotice(null);

    try {
      if (editingPatient) {
        await updatePatientInCloud(editingPatient, formValues, firebaseUser);
        const targetId = editingPatient.id;
        const willBeSalida = hasRegisteredExit(formValues);
        setEditingPatientId(null);
        setActiveView('pacientes');
        showToast('Registro actualizado y sincronizado en la nube.');

        if (openWhatsAppAfterSave) {
          setWhatsAppSession({
            patientId: targetId,
            type: willBeSalida ? 'salida' : 'ingreso',
          });
        }
        return;
      }

      const created = await createPatientInCloud(formValues, firebaseUser);
      setActiveView('pacientes');
      showToast('Paciente registrado y sincronizado en todos los dispositivos.');

      if (openWhatsAppAfterSave) {
        setWhatsAppSession({ patientId: created.id, type: 'ingreso' });
      }
    } catch (error) {
      if (error instanceof ConcurrencyConflictError) {
        setConflictNotice(error.message);
        setEditingPatientId(null);
        setActiveView('pacientes');
      } else {
        throw error;
      }
    } finally {
      setIsSavingRecord(false);
    }
  };

  const handleSaveDischarge = async (
    targetPatient: PatientRecord,
    updates: {
      horaSalida: string;
      estadoEgreso: ExitOutcome;
      observacionesSalida: string;
      medico: string;
      enfermera: string;
      diagnostico: string;
    },
    openWhatsAppAfter: boolean
  ) => {
    if (!firebaseUser) return;
    setIsSavingRecord(true);
    setConflictNotice(null);

    try {
      await registerDischargeInCloud(targetPatient, updates, firebaseUser);
      setDischargePatientId(null);
      showToast('Salida registrada y sincronizada en tiempo real.');

      if (openWhatsAppAfter) {
        setWhatsAppSession({ patientId: targetPatient.id, type: 'salida' });
      }
    } catch (error) {
      if (error instanceof ConcurrencyConflictError) {
        setConflictNotice(error.message);
        setDischargePatientId(null);
      } else {
        throw error;
      }
    } finally {
      setIsSavingRecord(false);
    }
  };

  const handleRequestDeletePatient = (patient: PatientRecord) => {
    if (!firebaseUser || !isAdmin) return;
    setDeleteTarget({ mode: 'single', patient });
  };

  const handleGeneratePdf = () => {
    const filename = generateShiftPdfReport({
      patients,
      responsableGuardia: DEFAULT_SHIFT_SUPERVISOR,
    });
    showToast(`Informe descargado: ${filename}`);
  };

  const handleDownloadProjectZip = async () => {
    if (!firebaseUser) return;
    const filename = await downloadCompleteProjectZip(firebaseUser);
    showToast(`Proyecto completo descargado: ${filename}`);
  };

  const handleExportJsonBackup = () => {
    const filename = exportPatientsBackupJson(
      patients,
      firebaseUser?.email || DEFAULT_SHIFT_SUPERVISOR
    );
    showToast(`Respaldo guardado: ${filename}`);
  };

  const handleRestoreJsonBackup = async (rawText: string) => {
    if (!firebaseUser) return;
    const parsedPatients = parsePatientsBackupJson(rawText);
    if (parsedPatients.length === 0) {
      throw new Error('El archivo seleccionado no contiene pacientes válidos.');
    }
    const existingIds = new Set(patients.map((p) => sanitizeDocId(p.id)));
    const { imported, skippedDuplicates } = await importPatientsBatchToCloud(
      parsedPatients,
      existingIds,
      firebaseUser,
      'restore_backup'
    );
    showToast(
      `Restauración completada: ${imported} agregados${skippedDuplicates > 0 ? ` (${skippedDuplicates} duplicados omitidos)` : ''}.`
    );
  };

  const handleManualMigrateLocal = async () => {
    if (!firebaseUser) return;
    const legacyRecords = loadLegacyLocalPatients();
    if (legacyRecords.length === 0) {
      markLocalMigrationCompleted();
      setLegacyLocalCount(0);
      return;
    }
    const existingIds = new Set(patients.map((p) => sanitizeDocId(p.id)));
    const { imported } = await importPatientsBatchToCloud(
      legacyRecords,
      existingIds,
      firebaseUser,
      'migrate_local'
    );
    markLocalMigrationCompleted();
    setLegacyLocalCount(0);
    showToast(`Migración completada: ${imported} registros sincronizados.`);
  };

  const handleConfirmProtectedDelete = async (verifiedByEmail: string) => {
    if (!firebaseUser || !isAdmin || !deleteTarget) return;

    if (deleteTarget.mode === 'single') {
      const target = deleteTarget.patient;
      await deleteSinglePatientInCloud(target, firebaseUser, verifiedByEmail);
      if (editingPatientId === target.id) {
        setEditingPatientId(null);
      }
      if (dischargePatientId === target.id) {
        setDischargePatientId(null);
      }
      if (whatsAppSession?.patientId === target.id) {
        setWhatsAppSession(null);
      }
      setDeleteTarget(null);
      showToast('Registro eliminado y registrado en auditoría.');
      return;
    }

    const deletedCount = await deleteAllPatientsInCloud(patients, firebaseUser, verifiedByEmail);
    setEditingPatientId(null);
    setDischargePatientId(null);
    setWhatsAppSession(null);
    setDeleteTarget(null);
    setSelectedCategory('todos');
    setActiveView('pacientes');
    showToast(
      `Se eliminaron ${deletedCount} registros y quedó registrado en la bitácora de auditoría.`
    );
  };

  const handleSelectSummaryCard = (category: OutcomeFilter) => {
    setEditingPatientId(null);
    setActiveView('pacientes');
    setSelectedCategory((prev) =>
      category !== 'todos' && prev === category && activeView === 'pacientes' ? 'todos' : category
    );
  };

  const handleUpdateShiftConfig = async (updates: {
    whatsappGroupUrl?: string;
    incluirCamposVaciosEnMensaje?: boolean;
  }) => {
    if (!firebaseUser) return;
    const nextConfig: ShiftConfigRecord = {
      ...shiftConfig,
      whatsappGroupUrl: updates.whatsappGroupUrl ?? shiftConfig.whatsappGroupUrl,
      incluirCamposVaciosEnMensaje:
        updates.incluirCamposVaciosEnMensaje ?? shiftConfig.incluirCamposVaciosEnMensaje,
    };
    setShiftConfig(nextConfig);
    await saveShiftConfig(
      {
        whatsappGroupUrl: nextConfig.whatsappGroupUrl,
        incluirCamposVaciosEnMensaje: nextConfig.incluirCamposVaciosEnMensaje,
      },
      firebaseUser
    );
  };

  const handleSubmitAccessRequest = async () => {
    if (!firebaseUser) return;
    setIsSubmittingAccessRequest(true);
    setAccessRequestFeedback(null);
    try {
      await submitAccessRequest(firebaseUser);
      setAccessRequestFeedback({
        type: 'ok',
        text: 'Tu solicitud de acceso fue enviada correctamente. Espera la autorización del administrador.',
      });
    } catch (error) {
      setAccessRequestFeedback({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo enviar tu solicitud de acceso. Intenta nuevamente.',
      });
    } finally {
      setIsSubmittingAccessRequest(false);
    }
  };

  const handleRefreshAccessRequests = async () => {
    if (!firebaseUser || !isPrimaryAdmin) return;
    setAccessRequestsLoading(true);
    setAccessRequestsError(null);
    try {
      const requests = await fetchPendingAccessRequestsFromServer();
      setAccessRequests(requests);
      setAccessRequestsError(null);
    } catch (error) {
      setAccessRequestsError(
        error instanceof Error
          ? error.message
          : 'No se pudieron consultar las solicitudes de acceso en Firestore.'
      );
    } finally {
      setAccessRequestsLoading(false);
    }
  };

  const handleApproveAccessRequest = async (request: AccessRequestRecord, role: StaffRole) => {
    if (!firebaseUser || !isPrimaryAdmin) return;
    await approveAccessRequest(request, role, firebaseUser);
    showToast(
      `Solicitud aprobada para ${request.email} (${role === 'admin' ? 'Administrador' : 'Personal'}).`
    );
  };

  const handleRejectAccessRequest = async (request: AccessRequestRecord) => {
    if (!firebaseUser || !isPrimaryAdmin) return;
    await rejectAccessRequest(request, firebaseUser);
    showToast(`Solicitud rechazada para ${request.email}.`);
  };

  const handleUpdateStaffAccess = async (
    targetUser: StaffUserProfile,
    updates: { approved: boolean; role: StaffRole }
  ) => {
    if (!firebaseUser || !isPrimaryAdmin) return;
    await updateStaffMemberAccess(targetUser, updates, firebaseUser);
    showToast(
      !updates.approved
        ? `Acceso revocado para ${targetUser.email}.`
        : `Rol actualizado para ${targetUser.email} (${updates.role === 'admin' ? 'Administrador' : 'Personal'}).`
    );
  };

  const handleSelectView = (view: ActiveWorkspaceView) => {
    if (view === 'entrada' && activeView !== 'entrada') {
      setEditingPatientId(null);
    }
    if (view !== 'entrada') {
      setEditingPatientId(null);
    }
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Pantallas de autenticación / espera de autorización
  if (!authReady || (firebaseUser && profileLoading && !isBootstrappedAdmin)) {
    return (
      <AuthGate
        mode="loading"
        onSignIn={() => void handleSignIn()}
        onSignOut={() => void handleSignOut()}
      />
    );
  }

  if (!firebaseUser) {
    return (
      <AuthGate
        mode="signed_out"
        authError={authError}
        isSigningIn={isSigningIn}
        onSignIn={() => void handleSignIn()}
        onSignOut={() => void handleSignOut()}
      />
    );
  }

  if (!isAuthorized) {
    return (
      <AuthGate
        mode="pending_approval"
        userEmail={firebaseUser.email}
        userDisplayName={firebaseUser.displayName}
        accessRequest={ownAccessRequest}
        isSubmittingRequest={isSubmittingAccessRequest}
        requestFeedback={accessRequestFeedback}
        onSignIn={() => void handleSignIn()}
        onSignOut={() => void handleSignOut()}
        onSubmitAccessRequest={() => void handleSubmitAccessRequest()}
      />
    );
  }

  return (
    <div id="inicio" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col pb-20 md:pb-0">
      <Header
        activeView={activeView}
        patientCount={counts.total}
        userEmail={firebaseUser.email || ''}
        isSyncingFromCache={isSyncingFromCache}
        onSelectView={handleSelectView}
        onOpenReport={() => setShowReportModal(true)}
        onSignOut={() => void handleSignOut()}
      />

      <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-5 sm:px-6 lg:px-8">
        {/* Encabezado clínico institucional + Encargado permanente + Botón de borrado protegido */}
        <section
          aria-label="Resumen de guardia clínica"
          className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-teal-800">
                <Cloud className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {isSyncingFromCache
                    ? 'Sincronizando base de datos compartida...'
                    : 'Base de datos compartida · Sincronizada en tiempo real'}
                </span>
              </div>
              <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Control de guardia clínica
              </h1>
              <p className="mt-0.5 text-sm text-slate-600">{todayDisplay}</p>
            </div>

            {/* Encargado de turno permanente (bloqueado contra borrado o modificación accidental) */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
              <div className="rounded-xl border border-teal-200 bg-teal-50/60 px-4 py-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-teal-800">
                  <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>Encargado de turno</span>
                </div>
                <div className="mt-0.5 text-sm font-bold text-slate-900">
                  {DEFAULT_SHIFT_SUPERVISOR}
                </div>
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setDeleteTarget({ mode: 'all' })}
                  disabled={patients.length === 0}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-800 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span>Eliminar todos los registros</span>
                </button>
              )}
            </div>
          </div>

          {/* Tarjetas de resumen interactivas para filtrar pacientes por categoría */}
          <div
            role="group"
            aria-label="Resumen por categoría de pacientes"
            className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6"
          >
            {(
              [
                {
                  id: 'todos' as OutcomeFilter,
                  label: 'Total',
                  count: counts.total,
                  baseClass: 'border-slate-200 bg-slate-50/70 hover:border-slate-400 hover:bg-slate-100/80',
                  activeClass: 'border-slate-800 bg-slate-900 text-white ring-2 ring-slate-900/20',
                  labelClass: 'text-slate-600',
                  valueClass: 'text-slate-900',
                },
                {
                  id: 'en_atencion' as OutcomeFilter,
                  label: 'Activos',
                  count: counts.enAtencion,
                  baseClass: 'border-amber-200 bg-amber-50/50 hover:border-amber-400 hover:bg-amber-50',
                  activeClass: 'border-amber-700 bg-amber-600 text-white ring-2 ring-amber-600/25',
                  labelClass: 'text-amber-900',
                  valueClass: 'text-amber-900',
                },
                {
                  id: 'atendido' as OutcomeFilter,
                  label: 'Atendidos',
                  count: counts.atendidos,
                  baseClass: 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-400 hover:bg-emerald-50',
                  activeClass: 'border-emerald-700 bg-emerald-700 text-white ring-2 ring-emerald-700/25',
                  labelClass: 'text-emerald-900',
                  valueClass: 'text-emerald-800',
                },
                {
                  id: 'no_espero_turno' as OutcomeFilter,
                  label: 'No esperó',
                  count: counts.noEsperoTurno,
                  baseClass: 'border-orange-200 bg-orange-50/50 hover:border-orange-400 hover:bg-orange-50',
                  activeClass: 'border-orange-700 bg-orange-600 text-white ring-2 ring-orange-600/25',
                  labelClass: 'text-orange-900',
                  valueClass: 'text-orange-800',
                },
                {
                  id: 'no_atendido' as OutcomeFilter,
                  label: 'No atendidos',
                  count: counts.noAtendidos,
                  baseClass: 'border-red-200 bg-red-50/50 hover:border-red-400 hover:bg-red-50',
                  activeClass: 'border-red-700 bg-red-700 text-white ring-2 ring-red-700/25',
                  labelClass: 'text-red-900',
                  valueClass: 'text-red-800',
                },
                {
                  id: 'trasladado' as OutcomeFilter,
                  label: 'Trasladados',
                  count: counts.trasladados,
                  baseClass: 'border-blue-200 bg-blue-50/50 hover:border-blue-400 hover:bg-blue-50',
                  activeClass: 'border-blue-700 bg-blue-700 text-white ring-2 ring-blue-700/25',
                  labelClass: 'text-blue-900',
                  valueClass: 'text-blue-800',
                },
              ]
            ).map((card) => {
              const isSelected = activeView === 'pacientes' && selectedCategory === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleSelectSummaryCard(card.id)}
                  className={`rounded-xl border px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                    isSelected ? card.activeClass : card.baseClass
                  }`}
                >
                  <div
                    className={`text-xs font-semibold ${
                      isSelected ? 'text-white/90' : card.labelClass
                    }`}
                  >
                    {card.label}
                  </div>
                  <div
                    className={`mt-0.5 font-[var(--font-display)] text-2xl font-bold tabular-nums ${
                      isSelected ? 'text-white' : card.valueClass
                    }`}
                  >
                    {card.count}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Botones principales de navegación directa: PACIENTES | FORMATO DE ENTRADA */}
          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('todos');
                handleSelectView('pacientes');
              }}
              className={`inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-xl border px-5 py-3 text-sm font-bold transition-colors ${
                activeView === 'pacientes'
                  ? 'border-teal-700 bg-teal-700 text-white shadow-xs'
                  : 'border-slate-300 bg-white text-slate-800 hover:border-teal-600 hover:bg-teal-50/60'
              }`}
            >
              <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="tabular-nums">PACIENTES ({counts.total})</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectView('entrada')}
              className={`inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-xl border px-5 py-3 text-sm font-bold transition-colors ${
                activeView === 'entrada'
                  ? 'border-teal-700 bg-teal-700 text-white shadow-xs'
                  : 'border-slate-300 bg-white text-slate-800 hover:border-teal-600 hover:bg-teal-50/60'
              }`}
            >
              <ClipboardPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {editingPatient && activeView === 'entrada'
                  ? 'EDITAR REGISTRO DE PACIENTE'
                  : 'FORMATO DE ENTRADA'}
              </span>
            </button>
          </div>
        </section>

        {/* Aviso de conflicto concurrente entre dispositivos */}
        {conflictNotice && (
          <div
            role="alert"
            className="mt-4 flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
              <span className="font-medium">{conflictNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setConflictNotice(null)}
              className="shrink-0 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-bold text-amber-950 hover:bg-amber-100"
            >
              Entendido
            </button>
          </div>
        )}

        {/* Contenido dinámico según apartado seleccionado (El formulario solo aparece al elegir Formato de entrada) */}
        <div className="mt-6">
          {activeView === 'entrada' && (
            <PatientForm
              editingPatient={editingPatient}
              isSaving={isSavingRecord}
              onSave={handleSavePatient}
              onCancel={() => {
                setEditingPatientId(null);
                setActiveView('pacientes');
              }}
              onRequestSpellCheck={handleRequestSpellCheck}
            />
          )}

          {activeView === 'pacientes' && (
            <PatientList
              patients={patients}
              filter={selectedCategory}
              onChangeFilter={setSelectedCategory}
              editingPatientId={editingPatientId}
              canDelete={isAdmin}
              onEdit={(patient) => {
                setEditingPatientId(patient.id);
                setActiveView('entrada');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenDischarge={(patient) => setDischargePatientId(patient.id)}
              onOpenWhatsApp={(patient, type) =>
                setWhatsAppSession({ patientId: patient.id, type })
              }
              onDeletePatient={handleRequestDeletePatient}
              onOpenNewForm={() => {
                setEditingPatientId(null);
                setActiveView('entrada');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {activeView === 'seguridad' && (
            <HistoryAndSecurityPanel
              patients={patients}
              auditLogs={auditLogs}
              staffUsers={staffUsers}
              staffUsersError={staffUsersError}
              accessRequests={accessRequests}
              accessRequestsLoading={accessRequestsLoading}
              accessRequestsError={accessRequestsError}
              currentUserEmail={firebaseUser.email || ''}
              isAdmin={isAdmin}
              isPrimaryAdmin={isPrimaryAdmin}
              legacyLocalCount={legacyLocalCount}
              onExportJsonBackup={handleExportJsonBackup}
              onRestoreJsonBackup={handleRestoreJsonBackup}
              onMigrateLocalRecords={handleManualMigrateLocal}
              onDownloadPdf={handleGeneratePdf}
              onDownloadProjectZip={handleDownloadProjectZip}
              onOpenClearModal={() => {
                if (isAdmin) setDeleteTarget({ mode: 'all' });
              }}
              onUpdateStaffAccess={handleUpdateStaffAccess}
              onRefreshAccessRequests={handleRefreshAccessRequests}
              onApproveAccessRequest={handleApproveAccessRequest}
              onRejectAccessRequest={handleRejectAccessRequest}
            />
          )}
        </div>
      </main>

      <footer className="mt-8 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1360px] flex-col gap-1 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>
            ACE-MED · Encargado de turno: <strong>{DEFAULT_SHIFT_SUPERVISOR}</strong>
          </span>
          <span>No diagnostica, no recomienda tratamientos ni sustituye el criterio clínico.</span>
        </div>
      </footer>

      {/* Barra inferior táctil optimizada para teléfonos móviles */}
      <nav
        aria-label="Navegación móvil"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-sm md:hidden pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
          <button
            type="button"
            onClick={() => handleSelectView('pacientes')}
            className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[11px] font-semibold transition-colors ${
              activeView === 'pacientes' ? 'bg-teal-50 text-teal-800' : 'text-slate-600'
            }`}
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            <span>Pacientes</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectView('entrada')}
            className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[11px] font-semibold transition-colors ${
              activeView === 'entrada' ? 'bg-teal-50 text-teal-800' : 'text-slate-600'
            }`}
          >
            <ClipboardPlus className="h-4 w-4" aria-hidden="true" />
            <span>Entrada</span>
          </button>

          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            <FileDown className="h-4 w-4" aria-hidden="true" />
            <span>Informe</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectView('seguridad')}
            className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[11px] font-semibold transition-colors ${
              activeView === 'seguridad' ? 'bg-teal-50 text-teal-800' : 'text-slate-600'
            }`}
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>Seguridad</span>
          </button>
        </div>
      </nav>

      {/* Notificación temporal */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 right-4 z-50 flex max-w-sm items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg md:bottom-5"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modales operativos */}
      {dischargePatient && (
        <DischargeModal
          patient={dischargePatient}
          isSaving={isSavingRecord}
          onClose={() => setDischargePatientId(null)}
          onSaveDischarge={handleSaveDischarge}
          onRequestSpellCheck={handleRequestSpellCheck}
        />
      )}

      {whatsAppSession && whatsAppPatient && (
        <WhatsAppModal
          patient={whatsAppPatient}
          messageType={whatsAppSession.type}
          whatsappGroupUrl={shiftConfig.whatsappGroupUrl}
          onClose={() => setWhatsAppSession(null)}
        />
      )}

      {spellCheckSession && (
        <SpellCheckModal
          proposals={spellCheckSession.proposals}
          onClose={() => setSpellCheckSession(null)}
          onApply={spellCheckSession.onApply}
        />
      )}

      {showReportModal && (
        <ReportModal
          patients={patients}
          counts={counts}
          whatsappGroupUrl={shiftConfig.whatsappGroupUrl}
          onChangeWhatsappGroupUrl={(value) =>
            void handleUpdateShiftConfig({ whatsappGroupUrl: value })
          }
          onDownloadPdf={handleGeneratePdf}
          onExportJsonBackup={handleExportJsonBackup}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {deleteTarget && isAdmin && (
        <ClearShiftModal
          mode={deleteTarget.mode}
          targetPatient={deleteTarget.mode === 'single' ? deleteTarget.patient : null}
          firebaseUser={firebaseUser}
          patientCount={counts.total}
          activeCount={counts.enAtencion}
          onGenerateReportFirst={handleGeneratePdf}
          onExportJsonFirst={handleExportJsonBackup}
          onConfirmDelete={handleConfirmProtectedDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
