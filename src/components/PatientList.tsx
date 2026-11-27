import { useMemo, useState } from 'react';
import {
  Ambulance,
  ArrowLeft,
  ArrowLeftRight,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardPlus,
  Clock,
  LogOut,
  MessageSquare,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  UserX,
  X,
  XCircle,
} from 'lucide-react';
import {
  FIELD_LABELS,
  getHospitalizationDischargeLabel,
  getOutcomeLabel,
  getTreatmentHeader,
} from '../config/labels';
import {
  computeShiftCounts,
  getPatientOutcome,
  hasDistinctDischargeDoctor,
  hasDistinctDischargeNurse,
  hasReadmission,
  hasRegisteredExit,
  type MessageType,
  type PatientOutcome,
  type PatientRecord,
} from '../types/patient';
import {
  compareByRegistrationOrder,
  formatIsoDateEs,
  formatTime12h,
} from '../utils/time';

export type OutcomeFilter = 'todos' | PatientOutcome | 'reingreso';

interface PatientListProps {
  patients: PatientRecord[];
  filter: OutcomeFilter;
  onChangeFilter: (filter: OutcomeFilter) => void;
  editingPatientId: string | null;
  canDelete: boolean;
  onEdit: (patient: PatientRecord) => void;
  onOpenModifyMovement: (patient: PatientRecord) => void;
  onOpenDischarge: (patient: PatientRecord) => void;
  onOpenHospitalization: (patient: PatientRecord) => void;
  onOpenTransfer: (patient: PatientRecord) => void;
  onOpenReadmission: (patient: PatientRecord) => void;
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

function getCategoryTitle(filter: OutcomeFilter): string {
  switch (filter) {
    case 'en_atencion':
      return 'Activos';
    case 'atendido':
      return 'Atendidos';
    case 'no_espero_turno':
      return 'No esperó';
    case 'no_atendido':
      return 'No atendidos';
    case 'trasladado':
      return 'Trasladados';
    case 'hospitalizado':
      return 'Hospitalización';
    case 'reingreso':
      return 'Reingreso';
    default:
      return 'Todos los pacientes';
  }
}

function OutcomeStatusText({ outcome }: { outcome: PatientOutcome }) {
  switch (outcome) {
    case 'atendido':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-900">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
          <span>{getOutcomeLabel(outcome)}</span>
        </span>
      );
    case 'no_espero_turno':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-orange-900">
          <UserX className="h-3.5 w-3.5 shrink-0 text-orange-700" aria-hidden="true" />
          <span>{getOutcomeLabel(outcome)}</span>
        </span>
      );
    case 'no_atendido':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-red-900">
          <XCircle className="h-3.5 w-3.5 shrink-0 text-red-700" aria-hidden="true" />
          <span>{getOutcomeLabel(outcome)}</span>
        </span>
      );
    case 'trasladado':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-900">
          <Ambulance className="h-3.5 w-3.5 shrink-0 text-blue-700" aria-hidden="true" />
          <span>{getOutcomeLabel(outcome)}</span>
        </span>
      );
    case 'hospitalizado':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-indigo-900">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-indigo-700" aria-hidden="true" />
          <span>{getOutcomeLabel(outcome)}</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-amber-950">
          <Clock className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
          <span>Activo · Sin salida</span>
        </span>
      );
  }
}

export function PatientList({
  patients,
  filter,
  onChangeFilter,
  editingPatientId,
  canDelete,
  onEdit,
  onOpenModifyMovement,
  onOpenDischarge,
  onOpenHospitalization,
  onOpenTransfer,
  onOpenReadmission,
  onOpenWhatsApp,
  onDeletePatient,
  onOpenNewForm,
}: PatientListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Orden cronológico exacto: del primer registro que se subió al último
  const sortedPatients = useMemo(() => {
    return [...patients].sort(compareByRegistrationOrder);
  }, [patients]);

  // Numeración estable según el orden de registro global
  const orderNumberById = useMemo(() => {
    const map = new Map<string, number>();
    sortedPatients.forEach((p, idx) => map.set(p.id, idx + 1));
    return map;
  }, [sortedPatients]);

  const counts = useMemo(() => computeShiftCounts(patients), [patients]);

  // Filtro en tiempo real sobre todos los pacientes
  const filteredPatients = useMemo(() => {
    const q = normalizeForSearch(searchQuery.trim());
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    return sortedPatients.filter((patient) => {
      const outcome = getPatientOutcome(patient);
      const isReadmitted = hasReadmission(patient);
      if (filter === 'reingreso') {
        if (!isReadmitted) return false;
      } else if (filter !== 'todos' && outcome !== filter) {
        return false;
      }
      if (tokens.length === 0) return true;

      const haystack = normalizeForSearch(
        [
          patient.nombre,
          patient.edad,
          patient.procedencia,
          patient.motivoVisita,
          patient.destinoTraslado,
          patient.observaciones,
          patient.observacionesSalida,
          patient.medico,
          patient.enfermera,
          patient.medicoSalida,
          patient.enfermeraSalida,
          patient.diagnostico,
          patient.fechaRegistro,
          formatIsoDateEs(patient.fechaRegistro),
          patient.fechaSalida,
          formatIsoDateEs(patient.fechaSalida),
          patient.fechaSegundaEntrada,
          formatIsoDateEs(patient.fechaSegundaEntrada),
          getHospitalizationDischargeLabel(patient.tipoAltaHospitalizacion),
          patient.horaEntrada,
          formatTime12h(patient.horaEntrada),
          patient.horaSalida,
          formatTime12h(patient.horaSalida),
          patient.horaSegundaEntrada,
          formatTime12h(patient.horaSegundaEntrada),
          patient.horaSegundaSalida,
          formatTime12h(patient.horaSegundaSalida),
          isReadmitted ? 'reingreso' : '',
          getOutcomeLabel(outcome),
        ].join(' ')
      );

      return tokens.every((token) => haystack.includes(token));
    });
  }, [sortedPatients, filter, searchQuery]);

  const filterTabs: Array<{ id: OutcomeFilter; label: string; count: number }> = [
    { id: 'todos', label: 'Total', count: counts.total },
    { id: 'en_atencion', label: 'Activos', count: counts.enAtencion },
    { id: 'atendido', label: 'Atendidos', count: counts.atendidos },
    { id: 'no_espero_turno', label: 'No esperó', count: counts.noEsperoTurno },
    { id: 'no_atendido', label: 'No atendidos', count: counts.noAtendidos },
    { id: 'trasladado', label: 'Trasladados', count: counts.trasladados },
    { id: 'hospitalizado', label: 'Hospitalización', count: counts.hospitalizados },
    { id: 'reingreso', label: 'Reingreso', count: counts.reingresos },
  ];

  const hasActiveFilter = searchQuery.trim().length > 0 || filter !== 'todos';

  return (
    <section
      id="lista"
      aria-labelledby="lista-heading"
      className="rounded-2xl border border-slate-200 bg-white shadow-xs"
    >
      {/* Cabecera con buscador principal */}
      <div className="border-b border-slate-200 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="lista-heading" className="text-xl font-bold text-slate-900">
              {filter === 'todos'
                ? 'Listado de pacientes registrados'
                : `Pacientes · ${getCategoryTitle(filter)}`}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Orden de registro: del primero al último
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {filter !== 'todos' && (
              <button
                type="button"
                onClick={() => onChangeFilter('todos')}
                className="inline-flex min-h-[40px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-teal-700/40 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-900 transition-colors hover:bg-teal-100"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Ver todos ({counts.total})</span>
              </button>
            )}

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

        {/* Buscador amplio y accesible */}
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
              placeholder="Buscar paciente por nombre, fecha, procedencia, médico o motivo..."
              aria-label="Buscar pacientes"
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
                onChangeFilter('todos');
              }}
              className="inline-flex min-h-[46px] items-center justify-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Ver vista general</span>
            </button>
          )}
        </div>

        {searchQuery.trim().length > 0 && (
          <p className="mt-2 text-xs font-medium text-teal-800 tabular-nums">
            Mostrando {filteredPatients.length}{' '}
            {filteredPatients.length === 1 ? 'coincidencia' : 'coincidencias'} de {patients.length}{' '}
            registros totales.
          </p>
        )}

        {/* Filtros sincronizados con las tarjetas de resumen */}
        <div
          role="tablist"
          aria-label="Filtrar pacientes por categoría"
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
                onClick={() => onChangeFilter(tab.id)}
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
            Toca «Formato de entrada» para registrar al primer paciente.
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
            {searchQuery.trim()
              ? `No se encontraron pacientes que coincidan con “${searchQuery.trim()}”.`
              : `No hay pacientes en la categoría “${getCategoryTitle(filter)}”.`}
          </p>
          <button
            type="button"
            onClick={() => {
              onChangeFilter('todos');
              setSearchQuery('');
            }}
            className="mt-4 inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Volver a todos los pacientes ({patients.length})</span>
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200">
          {filteredPatients.map((patient) => {
            const outcome = getPatientOutcome(patient);
            const isHospitalized = outcome === 'hospitalizado';
            const isReadmitted = hasReadmission(patient);
            const isExited = hasRegisteredExit(patient);
            const isEditing = editingPatientId === patient.id;
            const treatmentLabel = getTreatmentHeader(patient.tratamiento);
            const orderNum = orderNumberById.get(patient.id) ?? 1;
            const formattedDate = formatIsoDateEs(patient.fechaRegistro);
            const formattedExitDate = formatIsoDateEs(patient.fechaSalida);
            const dischargeTypeLabel = getHospitalizationDischargeLabel(
              patient.tipoAltaHospitalizacion
            );
            const formattedEntry = formatTime12h(patient.horaEntrada);
            const formattedExit = formatTime12h(patient.horaSalida);
            const formattedSecondEntry = formatTime12h(patient.horaSegundaEntrada);
            const formattedSecondExit = formatTime12h(patient.horaSegundaSalida);

            const distinctDoctor = hasDistinctDischargeDoctor(patient);
            const distinctNurse = hasDistinctDischargeNurse(patient);

            const hasDetailFields = Boolean(
              dischargeTypeLabel ||
                formattedExitDate ||
                patient.motivoVisita.trim() ||
                patient.destinoTraslado.trim() ||
                patient.observaciones.trim() ||
                patient.medico.trim() ||
                patient.enfermera.trim() ||
                patient.medicoSalida.trim() ||
                patient.enfermeraSalida.trim() ||
                patient.diagnostico.trim() ||
                patient.observacionesSalida.trim()
            );

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
                {/* Fila superior: número de orden, nombre (solo si se ingresó), fecha, horarios y estado */}
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-mono text-xs font-semibold tabular-nums text-slate-400">
                        #{orderNum}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 break-words">
                        {patient.nombre.trim()
                          ? `${treatmentLabel}: ${patient.nombre.trim()}`
                          : `Registro #${orderNum}`}
                      </h3>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600">
                      {formattedDate && (
                        <span className="inline-flex items-center gap-1 font-mono font-semibold tabular-nums text-slate-700">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                          <span>{formattedDate}</span>
                        </span>
                      )}

                      {formattedEntry && (
                        <span className="font-mono font-semibold tabular-nums text-slate-900">
                          {isReadmitted ? '1ª Entrada' : 'Entrada'} {formattedEntry}
                        </span>
                      )}

                      {formattedExit && (
                        <span className="font-mono font-semibold tabular-nums text-teal-900">
                          {isReadmitted ? '1ª Salida' : 'Salida'} {formattedExit}
                        </span>
                      )}

                      {formattedSecondEntry && (
                        <span className="font-mono font-semibold tabular-nums text-violet-900">
                          2ª Entrada {formattedSecondEntry}
                        </span>
                      )}

                      {formattedSecondExit && (
                        <span className="font-mono font-semibold tabular-nums text-violet-800">
                          2ª Salida {formattedSecondExit}
                        </span>
                      )}

                      {patient.edad.trim() && (
                        <span>
                          {FIELD_LABELS.edad}: {patient.edad.trim()}
                        </span>
                      )}

                      {patient.procedencia.trim() && (
                        <span>
                          {FIELD_LABELS.procedencia}: {patient.procedencia.trim()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Estado visual claro */}
                  <div className="flex flex-wrap items-center gap-1.5 whitespace-nowrap shrink-0 text-xs font-bold">
                    {isReadmitted && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-violet-900">
                        <RotateCcw className="h-3.5 w-3.5 shrink-0 text-violet-700" aria-hidden="true" />
                        <span>Reingreso</span>
                      </span>
                    )}
                    <OutcomeStatusText outcome={outcome} />
                  </div>
                </div>

                {/* Detalles clínicos: solo mostrar el bloque y los campos efectivamente completados */}
                {hasDetailFields && (
                  <dl className="mt-3.5 grid grid-cols-1 gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-sm sm:grid-cols-2">
                    {dischargeTypeLabel && (
                      <div>
                        <dt className="text-xs font-semibold text-slate-500">
                          {FIELD_LABELS.tipoAltaHospitalizacion}
                        </dt>
                        <dd className="mt-0.5 font-semibold text-indigo-950 break-words">
                          {dischargeTypeLabel}
                        </dd>
                      </div>
                    )}

                    {formattedExitDate && (
                      <div>
                        <dt className="text-xs font-semibold text-slate-500">
                          {FIELD_LABELS.fechaSalida}
                        </dt>
                        <dd className="mt-0.5 font-mono font-semibold tabular-nums text-slate-900">
                          {formattedExitDate}
                        </dd>
                      </div>
                    )}

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

                    {patient.destinoTraslado.trim() && (
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-semibold text-slate-500">
                          {FIELD_LABELS.destinoTraslado}
                        </dt>
                        <dd className="mt-0.5 font-semibold text-blue-950 break-words">
                          {patient.destinoTraslado.trim()}
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

                    {distinctDoctor ? (
                      <>
                        {patient.medico.trim() && (
                          <div>
                            <dt className="text-xs font-semibold text-slate-500">
                              {FIELD_LABELS.medicoIngreso}
                            </dt>
                            <dd className="mt-0.5 font-semibold text-slate-900 break-words">
                              {patient.medico.trim()}
                            </dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-xs font-semibold text-indigo-700">
                            {FIELD_LABELS.medicoSalida}
                          </dt>
                          <dd className="mt-0.5 font-semibold text-indigo-950 break-words">
                            {patient.medicoSalida.trim()}
                          </dd>
                        </div>
                      </>
                    ) : (
                      patient.medico.trim() && (
                        <div>
                          <dt className="text-xs font-semibold text-slate-500">
                            {FIELD_LABELS.medico}
                          </dt>
                          <dd className="mt-0.5 font-semibold text-slate-900 break-words">
                            {patient.medico.trim()}
                          </dd>
                        </div>
                      )
                    )}

                    {distinctNurse ? (
                      <>
                        {patient.enfermera.trim() && (
                          <div>
                            <dt className="text-xs font-semibold text-slate-500">
                              {FIELD_LABELS.enfermeraIngreso}
                            </dt>
                            <dd className="mt-0.5 font-semibold text-slate-900 break-words">
                              {patient.enfermera.trim()}
                            </dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-xs font-semibold text-indigo-700">
                            {FIELD_LABELS.enfermeraSalida}
                          </dt>
                          <dd className="mt-0.5 font-semibold text-indigo-950 break-words">
                            {patient.enfermeraSalida.trim()}
                          </dd>
                        </div>
                      </>
                    ) : (
                      patient.enfermera.trim() && (
                        <div>
                          <dt className="text-xs font-semibold text-slate-500">
                            {FIELD_LABELS.enfermera}
                          </dt>
                          <dd className="mt-0.5 font-semibold text-slate-900 break-words">
                            {patient.enfermera.trim()}
                          </dd>
                        </div>
                      )
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
                )}

                {/* Acciones táctiles por paciente */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenDischarge(patient)}
                    className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                      isExited && !isHospitalized
                        ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                        : 'bg-teal-700 text-white hover:bg-teal-800'
                    }`}
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {isHospitalized
                        ? 'Registrar salida'
                        : isExited
                          ? 'Editar salida'
                          : 'Registrar salida'}
                    </span>
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
                    onClick={() => onOpenHospitalization(patient)}
                    className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      outcome === 'hospitalizado'
                        ? 'border-indigo-700 bg-indigo-700 text-white hover:bg-indigo-800'
                        : 'border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100'
                    }`}
                  >
                    <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Hospitalización</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenTransfer(patient)}
                    className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      outcome === 'trasladado'
                        ? 'border-blue-700 bg-blue-700 text-white hover:bg-blue-800'
                        : 'border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100'
                    }`}
                  >
                    <Ambulance className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Traslado</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenReadmission(patient)}
                    className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      isReadmitted
                        ? 'border-violet-700 bg-violet-700 text-white hover:bg-violet-800'
                        : 'border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100'
                    }`}
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Reingreso</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onEdit(patient)}
                    className="inline-flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Editar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenModifyMovement(patient)}
                    className="inline-flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-100"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Modificar registro</span>
                  </button>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onDeletePatient(patient)}
                      aria-label={`Eliminar registro de ${patient.nombre || `registro #${orderNum}`}`}
                      className="ml-auto inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-lg border border-transparent text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
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
