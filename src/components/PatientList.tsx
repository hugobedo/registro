import { useMemo, useState } from 'react';
import {
  Ambulance,
  ArrowDownUp,
  CheckCircle2,
  ClipboardPlus,
  Clock,
  LogOut,
  MessageSquare,
  Pencil,
  Search,
  Trash2,
  UserX,
  X,
  XCircle,
} from 'lucide-react';
import { FIELD_LABELS, getOutcomeLabel, getTreatmentHeader } from '../config/labels';
import {
  computeShiftCounts,
  getPatientOutcome,
  hasRegisteredExit,
  type MessageType,
  type PatientOutcome,
  type PatientRecord,
} from '../types/patient';
import { compareByEntryTime, formatTime12h } from '../utils/time';

type OutcomeFilter = 'todos' | PatientOutcome;
type SortOrder = 'recent_first' | 'entry_asc';

interface PatientListProps {
  patients: PatientRecord[];
  editingPatientId: string | null;
  onEdit: (patient: PatientRecord) => void;
  onOpenDischarge: (patient: PatientRecord) => void;
  onOpenWhatsApp: (patient: PatientRecord, type: MessageType) => void;
  onDeletePatient: (patient: PatientRecord) => void;
  onOpenNewForm: () => void;
}

function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function OutcomeStatusText({ outcome }: { outcome: PatientOutcome }) {
  switch (outcome) {
    case 'atendido':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-900 border border-emerald-200">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
          <span>{getOutcomeLabel(outcome)}</span>
        </span>
      );
    case 'no_espero_turno':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1 text-orange-900 border border-orange-200">
          <UserX className="h-3.5 w-3.5 shrink-0 text-orange-700" aria-hidden="true" />
          <span>{getOutcomeLabel(outcome)}</span>
        </span>
      );
    case 'no_atendido':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1 text-red-900 border border-red-200">
          <XCircle className="h-3.5 w-3.5 shrink-0 text-red-700" aria-hidden="true" />
          <span>{getOutcomeLabel(outcome)}</span>
        </span>
      );
    case 'trasladado':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-blue-900 border border-blue-200">
          <Ambulance className="h-3.5 w-3.5 shrink-0 text-blue-700" aria-hidden="true" />
          <span>{getOutcomeLabel(outcome)}</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-amber-950 border border-amber-300">
          <Clock className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
          <span>Activo · Sin salida</span>
        </span>
      );
  }
}

export function PatientList({
  patients,
  editingPatientId,
  onEdit,
  onOpenDischarge,
  onOpenWhatsApp,
  onDeletePatient,
  onOpenNewForm,
}: PatientListProps) {
  const [filter, setFilter] = useState<OutcomeFilter>('todos');
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent_first');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Orden cronológico por defecto mostrando primero los registros más recientes
  const sortedPatients = useMemo(() => {
    const copy = [...patients];
    if (sortOrder === 'recent_first') {
      return copy.sort((a, b) => {
        const createdDiff = b.createdAt.localeCompare(a.createdAt);
        if (createdDiff !== 0) return createdDiff;
        return compareByEntryTime(b, a);
      });
    }
    return copy.sort(compareByEntryTime);
  }, [patients, sortOrder]);

  const counts = useMemo(() => computeShiftCounts(patients), [patients]);

  // Filtro en tiempo real sobre TODOS los pacientes registrados en la base de datos compartida
  const filteredPatients = useMemo(() => {
    const q = normalizeForSearch(searchQuery.trim());
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    return sortedPatients.filter((patient) => {
      const outcome = getPatientOutcome(patient);
      if (filter !== 'todos' && outcome !== filter) return false;
      if (tokens.length === 0) return true;

      const haystack = normalizeForSearch(
        [
          patient.nombre,
          patient.edad,
          patient.procedencia,
          patient.motivoVisita,
          patient.observaciones,
          patient.observacionesSalida,
          patient.medico,
          patient.enfermera,
          patient.diagnostico,
          patient.horaEntrada,
          formatTime12h(patient.horaEntrada),
          patient.horaSalida,
          formatTime12h(patient.horaSalida),
          getOutcomeLabel(outcome),
        ].join(' ')
      );

      return tokens.every((token) => haystack.includes(token));
    });
  }, [sortedPatients, filter, searchQuery]);

  const filterTabs: Array<{ id: OutcomeFilter; label: string; count: number }> = [
    { id: 'todos', label: 'Todos', count: counts.total },
    { id: 'en_atencion', label: 'Activos (sin salida)', count: counts.enAtencion },
    { id: 'atendido', label: 'Atendidos', count: counts.atendidos },
    { id: 'no_espero_turno', label: 'No esperó turno', count: counts.noEsperoTurno },
    { id: 'no_atendido', label: 'No atendidos', count: counts.noAtendidos },
    { id: 'trasladado', label: 'Trasladados', count: counts.trasladados },
  ];

  const hasActiveFilter = searchQuery.trim().length > 0 || filter !== 'todos';

  return (
    <section
      id="lista"
      aria-labelledby="lista-heading"
      className="rounded-2xl border border-slate-200 bg-white shadow-xs"
    >
      {/* Cabecera con buscador principal visible en la parte superior */}
      <div className="border-b border-slate-200 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="lista-heading" className="text-xl font-bold text-slate-900">
              Listado de pacientes registrados
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Base de datos compartida en tiempo real ·{' '}
              {sortOrder === 'recent_first'
                ? 'Mostrando registros más recientes primero'
                : 'Mostrando del primer ingreso al último'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setSortOrder((prev) => (prev === 'recent_first' ? 'entry_asc' : 'recent_first'))
              }
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <ArrowDownUp className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>
                {sortOrder === 'recent_first' ? 'Más recientes primero' : 'Orden de ingreso'}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenNewForm}
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-800"
            >
              <ClipboardPlus className="h-4 w-4" aria-hidden="true" />
              <span>Nuevo ingreso</span>
            </button>
          </div>
        </div>

        {/* Buscador amplio y accesible por nombre y apellidos */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="buscador-pacientes"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar paciente por nombre y apellidos, procedencia, médico o motivo..."
              aria-label="Buscar pacientes por nombre y apellidos"
              className="min-h-[46px] w-full rounded-xl border border-slate-300 bg-slate-50/70 py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-700 focus:bg-white"
            />
            {searchQuery.trim().length > 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilter('todos');
              }}
              className="inline-flex min-h-[46px] items-center justify-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Limpiar filtros</span>
            </button>
          )}
        </div>

        {searchQuery.trim().length > 0 && (
          <p className="mt-2 text-xs font-medium text-teal-800 tabular-nums">
            Mostrando {filteredPatients.length}{' '}
            {filteredPatients.length === 1 ? 'coincidencia' : 'coincidencias'} de {patients.length}{' '}
            registros totales en la base de datos.
          </p>
        )}

        {/* Filtros por estado clínico / egreso */}
        <div
          role="tablist"
          aria-label="Filtrar pacientes por estado"
          className="mt-3.5 flex flex-wrap gap-1.5"
        >
          {filterTabs.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.id)}
                className={`min-h-[38px] whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                  active
                    ? 'border-teal-700 bg-teal-700 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Estado vacío sin registros ficticios */}
      {patients.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-teal-700">
            <ClipboardPlus className="h-7 w-7" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">
            No hay pacientes registrados todavía
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
            Toca «Formato de entrada» para registrar al primer paciente. El registro se sincronizará
            automáticamente en todos los dispositivos conectados.
          </p>
          <button
            type="button"
            onClick={onOpenNewForm}
            className="mt-5 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
          >
            <ClipboardPlus className="h-4 w-4" aria-hidden="true" />
            <span>Abrir Formato de entrada</span>
          </button>
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-800">
            No se encontraron pacientes que coincidan con “{searchQuery.trim() || 'el filtro actual'}
            ”.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Verifica la escritura del nombre o limpia el filtro para ver todos los registros.
          </p>
          <button
            type="button"
            onClick={() => {
              setFilter('todos');
              setSearchQuery('');
            }}
            className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Mostrar todos los pacientes ({patients.length})
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200">
          {filteredPatients.map((patient, index) => {
            const outcome = getPatientOutcome(patient);
            const isExited = hasRegisteredExit(patient);
            const isEditing = editingPatientId === patient.id;
            const isConfirmingDelete = pendingDeleteId === patient.id;
            const treatmentLabel = getTreatmentHeader(patient.tratamiento);

            return (
              <li
                key={patient.id}
                className={`p-4 transition-colors sm:p-6 ${
                  isEditing
                    ? 'bg-teal-50/60'
                    : isExited
                      ? 'bg-white hover:bg-slate-50/60'
                      : 'bg-amber-50/20 hover:bg-amber-50/40'
                }`}
              >
                {/* Fila superior: nombre, horarios 12h y estado diferenciado */}
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-mono text-xs font-semibold tabular-nums text-slate-400">
                        #{index + 1}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 break-words">
                        {patient.nombre.trim()
                          ? `${treatmentLabel}: ${patient.nombre.trim()}`
                          : `${treatmentLabel} (sin nombre capturado)`}
                      </h3>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600">
                      <span className="font-mono font-semibold tabular-nums text-slate-900">
                        Entrada {formatTime12h(patient.horaEntrada) || '—'}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      {isExited && patient.horaSalida.trim() ? (
                        <span className="font-mono font-semibold tabular-nums text-teal-900">
                          Salida {formatTime12h(patient.horaSalida)}
                        </span>
                      ) : (
                        <span className="font-semibold text-amber-800">
                          Pendiente de salida
                        </span>
                      )}
                      {patient.edad.trim() && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span>
                            {FIELD_LABELS.edad}: {patient.edad.trim()}
                          </span>
                        </>
                      )}
                      {patient.procedencia.trim() && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span>
                            {FIELD_LABELS.procedencia}: {patient.procedencia.trim()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Estado visual claro activo vs salida */}
                  <div className="whitespace-nowrap shrink-0 text-xs font-bold">
                    <OutcomeStatusText outcome={outcome} />
                  </div>
                </div>

                {/* Detalles clínicos capturados */}
                <dl className="mt-3.5 grid grid-cols-1 gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-sm sm:grid-cols-2">
                  {patient.motivoVisita.trim() && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-semibold text-slate-500">
                        {FIELD_LABELS.motivoVisita}
                      </dt>
                      <dd className="mt-0.5 text-slate-900 break-words">
                        {patient.motivoVisita.trim()}
                      </dd>
                    </div>
                  )}

                  {patient.observaciones.trim() && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-semibold text-slate-500">
                        Observaciones de ingreso
                      </dt>
                      <dd className="mt-0.5 text-slate-900 break-words">
                        {patient.observaciones.trim()}
                      </dd>
                    </div>
                  )}

                  {patient.medico.trim() && (
                    <div>
                      <dt className="text-xs font-semibold text-slate-500">
                        {FIELD_LABELS.medico}
                      </dt>
                      <dd className="mt-0.5 font-semibold text-slate-900 break-words">
                        {patient.medico.trim()}
                      </dd>
                    </div>
                  )}

                  {patient.enfermera.trim() && (
                    <div>
                      <dt className="text-xs font-semibold text-slate-500">
                        {FIELD_LABELS.enfermera}
                      </dt>
                      <dd className="mt-0.5 font-semibold text-slate-900 break-words">
                        {patient.enfermera.trim()}
                      </dd>
                    </div>
                  )}

                  {patient.diagnostico.trim() && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-semibold text-slate-500">
                        {FIELD_LABELS.diagnostico}
                      </dt>
                      <dd className="mt-0.5 text-slate-900 break-words">
                        {patient.diagnostico.trim()}
                      </dd>
                    </div>
                  )}

                  {patient.observacionesSalida.trim() && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-semibold text-slate-500">
                        {FIELD_LABELS.observacionesSalida}
                      </dt>
                      <dd className="mt-0.5 text-slate-900 break-words">
                        {patient.observacionesSalida.trim()}
                      </dd>
                    </div>
                  )}
                </dl>

                {/* Acciones táctiles por paciente */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenDischarge(patient)}
                    className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                      isExited
                        ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                        : 'bg-teal-700 text-white hover:bg-teal-800'
                    }`}
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{isExited ? 'Editar salida' : 'Registrar salida'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenWhatsApp(patient, 'ingreso')}
                    className="inline-flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-700/40 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 transition-colors hover:bg-emerald-100"
                  >
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>WhatsApp ingreso</span>
                  </button>

                  {isExited && (
                    <button
                      type="button"
                      onClick={() => onOpenWhatsApp(patient, 'salida')}
                      className="inline-flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-800"
                    >
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>WhatsApp salida</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onEdit(patient)}
                    className="inline-flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Editar</span>
                  </button>

                  {isConfirmingDelete ? (
                    <div className="ml-auto flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-red-800">¿Eliminar?</span>
                      <button
                        type="button"
                        onClick={() => {
                          onDeletePatient(patient);
                          setPendingDeleteId(null);
                        }}
                        className="min-h-[38px] whitespace-nowrap rounded-lg bg-red-700 px-3 py-1 text-xs font-semibold text-white hover:bg-red-800"
                      >
                        Sí, eliminar
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(null)}
                        className="min-h-[38px] whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(patient.id)}
                      aria-label={`Eliminar registro de ${patient.nombre || 'paciente'}`}
                      className="ml-auto inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
