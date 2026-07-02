"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatDate, formatHours, todayISO } from "@/lib/date-utils";
import { supabase } from "@/lib/supabase";
import type { DayRecord, DayType, Project, TimeEntry } from "@/lib/types";

type EntryFormState = {
  projectId: string;
  hours: string;
  note: string;
};

type CalendarDay = {
  date: string;
  dayNumber: number;
  inMonth: boolean;
};

type MonthlySummary = {
  workedHours: number;
  overtimeHours: number;
  vacationDays: number;
  sickLeaveDays: number;
};

type MonthlyListDay = {
  date: string;
  projects: Array<{
    name: string;
    hours: number;
  }>;
};

const emptyEntryForm: EntryFormState = {
  projectId: "",
  hours: "",
  note: ""
};

const dayTypeOptions: Array<{ value: DayType; label: string; shortLabel: string }> = [
  { value: "working_day", label: "Working day", shortLabel: "Work" },
  { value: "vacation", label: "Vacation", shortLabel: "Vacation" },
  { value: "sick_leave", label: "Sick leave", shortLabel: "Sick" },
  { value: "holiday", label: "Holiday", shortLabel: "Holiday" }
];

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getDayTypeLabel(dayType: DayType) {
  return dayTypeOptions.find((option) => option.value === dayType)?.label ?? "Working day";
}

function getDayTypeShortLabel(dayType: DayType) {
  return dayTypeOptions.find((option) => option.value === dayType)?.shortLabel ?? "Work";
}

function parseISODate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthStartISO(date: string) {
  const parsed = parseISODate(date);
  return toISODate(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
}

function monthEndISO(monthStart: string) {
  const parsed = parseISODate(monthStart);
  return toISODate(new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0));
}

function addMonths(monthStart: string, amount: number) {
  const parsed = parseISODate(monthStart);
  return toISODate(new Date(parsed.getFullYear(), parsed.getMonth() + amount, 1));
}

function formatMonth(monthStart: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric"
  }).format(parseISODate(monthStart));
}

function isWeekend(date: string) {
  const day = parseISODate(date).getDay();
  return day === 0 || day === 6;
}

function buildCalendarDays(monthStart: string): CalendarDay[] {
  const first = parseISODate(monthStart);
  const firstGridOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - firstGridOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const iso = toISODate(date);

    return {
      date: iso,
      dayNumber: date.getDate(),
      inMonth: date.getMonth() === first.getMonth()
    };
  });
}

export function TimeTracker({
  userEmail,
  userId
}: {
  userEmail: string;
  userId: string;
}) {
  const [currentMonth, setCurrentMonth] = useState(monthStartISO(todayISO()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayRecords, setDayRecords] = useState<DayRecord[]>([]);
  const [monthEntries, setMonthEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectName, setProjectName] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [dayType, setDayType] = useState<DayType>("working_day");
  const [dayNote, setDayNote] = useState("");
  const [entryForm, setEntryForm] = useState<EntryFormState>(emptyEntryForm);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [isLoadingMonth, setIsLoadingMonth] = useState(true);
  const [isMonthlyListOpen, setIsMonthlyListOpen] = useState(false);

  const activeProjects = useMemo(
    () => projects.filter((project) => project.active),
    [projects]
  );

  const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);

  const dayRecordByDate = useMemo(() => {
    return new Map(dayRecords.map((record) => [record.date, record]));
  }, [dayRecords]);

  const entriesByDate = useMemo(() => {
    const grouped = new Map<string, TimeEntry[]>();

    monthEntries.forEach((entry) => {
      const existing = grouped.get(entry.date) ?? [];
      grouped.set(entry.date, [...existing, entry]);
    });

    return grouped;
  }, [monthEntries]);

  const hoursByDate = useMemo(() => {
    const grouped = new Map<string, number>();

    monthEntries.forEach((entry) => {
      grouped.set(entry.date, (grouped.get(entry.date) ?? 0) + Number(entry.hours));
    });

    return grouped;
  }, [monthEntries]);

  const selectedRecord = selectedDate ? dayRecordByDate.get(selectedDate) ?? null : null;
  const selectedEntries = selectedDate ? entriesByDate.get(selectedDate) ?? [] : [];
  const selectedTotalHours = selectedDate ? hoursByDate.get(selectedDate) ?? 0 : 0;
  const selectedOvertimeHours = Math.max(selectedTotalHours - 8, 0);
  const isWorkingDay = dayType === "working_day";

  const monthlySummary = useMemo<MonthlySummary>(() => {
    const start = currentMonth;
    const end = monthEndISO(currentMonth);
    const monthDays = calendarDays.filter((day) => day.date >= start && day.date <= end);
    const workedHours = monthEntries.reduce((sum, entry) => sum + Number(entry.hours), 0);
    const overtimeHours = monthDays.reduce((sum, day) => {
      return sum + Math.max((hoursByDate.get(day.date) ?? 0) - 8, 0);
    }, 0);

    const vacationDays = dayRecords.filter((record) => record.day_type === "vacation").length;
    const sickLeaveDays = dayRecords.filter((record) => record.day_type === "sick_leave").length;

    return {
      workedHours,
      overtimeHours,
      vacationDays,
      sickLeaveDays
    };
  }, [calendarDays, currentMonth, dayRecords, hoursByDate, monthEntries]);

  const monthlyList = useMemo<MonthlyListDay[]>(() => {
    const byDate = new Map<string, Map<string, number>>();

    monthEntries.forEach((entry) => {
      const projectName = entry.projects?.name ?? "Deleted project";
      const projectHours = byDate.get(entry.date) ?? new Map<string, number>();
      projectHours.set(projectName, (projectHours.get(projectName) ?? 0) + Number(entry.hours));
      byDate.set(entry.date, projectHours);
    });

    return Array.from(byDate.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, projectHours]) => ({
        date,
        projects: Array.from(projectHours.entries())
          .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
          .map(([name, hours]) => ({ name, hours }))
      }));
  }, [monthEntries]);

  const monthlyListText = useMemo(() => {
    return monthlyList
      .map((day) => {
        const projects = day.projects
          .map((project) => `${project.name}: ${formatHours(project.hours)} h`)
          .join(", ");

        return `${day.date} - ${projects}`;
      })
      .join("\n");
  }, [monthlyList]);

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    void loadMonthData();
  }, [currentMonth]);

  useEffect(() => {
    if (!entryForm.projectId && activeProjects.length > 0) {
      setEntryForm((current) => ({
        ...current,
        projectId: activeProjects[0].id
      }));
    }
  }, [activeProjects, entryForm.projectId]);

  async function loadProjects() {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("active", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      setStatus(error.message);
      return;
    }

    setProjects(data ?? []);
  }

  async function loadMonthData() {
    setIsLoadingMonth(true);
    const start = currentMonth;
    const end = monthEndISO(currentMonth);

    const [dayRecordsResult, entriesResult] = await Promise.all([
      supabase
        .from("day_records")
        .select("*")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true }),
      supabase
        .from("time_entries")
        .select("*, projects(id, name, active)")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true })
        .order("created_at", { ascending: true })
    ]);

    if (dayRecordsResult.error) {
      setStatus(dayRecordsResult.error.message);
      setIsLoadingMonth(false);
      return;
    }

    if (entriesResult.error) {
      setStatus(entriesResult.error.message);
      setIsLoadingMonth(false);
      return;
    }

    setDayRecords((dayRecordsResult.data ?? []) as DayRecord[]);
    setMonthEntries((entriesResult.data ?? []) as TimeEntry[]);
    setIsLoadingMonth(false);
  }

  function openDay(date: string) {
    const record = dayRecordByDate.get(date) ?? null;

    setSelectedDate(date);
    setDayType(record?.day_type ?? "working_day");
    setDayNote(record?.note ?? "");
    resetEntryForm();
    setStatus("");
  }

  function closeDayModal() {
    setSelectedDate(null);
    setEditingEntryId(null);
    resetEntryForm();
  }

  async function saveDayRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDate) return;

    const payload = {
      date: selectedDate,
      day_type: dayType,
      note: dayNote.trim() || null,
      user_id: userId
    };

    const request = selectedRecord
      ? supabase.from("day_records").update(payload).eq("id", selectedRecord.id)
      : supabase.from("day_records").insert(payload);

    const { error } = await request;

    if (error) {
      setStatus(error.message);
      return;
    }

    if (dayType !== "working_day") {
      resetEntryForm();
    }

    setStatus("Day status saved.");
    await loadMonthData();
  }

  async function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = projectName.trim();

    if (!name) {
      setStatus("Enter a project name.");
      return;
    }

    const { error } = await supabase.from("projects").insert({ name, user_id: userId });

    if (error) {
      setStatus(error.message);
      return;
    }

    setProjectName("");
    setStatus("Project added.");
    await loadProjects();
  }

  function startProjectEdit(project: Project) {
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
  }

  function cancelProjectEdit() {
    setEditingProjectId(null);
    setEditingProjectName("");
  }

  async function saveProjectName(projectId: string) {
    const name = editingProjectName.trim();

    if (!name) {
      setStatus("Project name cannot be empty.");
      return;
    }

    const { error } = await supabase
      .from("projects")
      .update({ name })
      .eq("id", projectId);

    if (error) {
      setStatus(error.message);
      return;
    }

    cancelProjectEdit();
    setStatus("Project updated.");
    await loadProjects();
    await loadMonthData();
  }

  async function archiveProject(projectId: string) {
    const { error } = await supabase
      .from("projects")
      .update({ active: false })
      .eq("id", projectId);

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Project archived.");
    await loadProjects();
  }

  async function restoreProject(projectId: string) {
    const { error } = await supabase
      .from("projects")
      .update({ active: true })
      .eq("id", projectId);

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Project restored.");
    await loadProjects();
  }

  async function deleteProject(project: Project) {
    const confirmed = window.confirm(
      `Delete "${project.name}"? This is only allowed when the project has no time entries.`
    );

    if (!confirmed) return;

    const { count, error: countError } = await supabase
      .from("time_entries")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id);

    if (countError) {
      setStatus(countError.message);
      return;
    }

    if ((count ?? 0) > 0) {
      window.alert(
        "This project has existing time entries. Deleting it would affect historical records. Archive it instead to keep past records intact."
      );
      setStatus("Project was not deleted because it has time entries. Archive it instead.");
      return;
    }

    const { error } = await supabase.from("projects").delete().eq("id", project.id);

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Project deleted.");
    await loadProjects();
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDate) return;

    if (!isWorkingDay) {
      setStatus("Time entries are only available for working days.");
      return;
    }

    const hours = Number(entryForm.hours);

    if (!entryForm.projectId) {
      setStatus("Choose a project.");
      return;
    }

    if (!Number.isFinite(hours) || hours <= 0) {
      setStatus("Enter hours greater than zero.");
      return;
    }

    const payload = {
      date: selectedDate,
      project_id: entryForm.projectId,
      hours,
      note: entryForm.note.trim() || null,
      user_id: userId
    };

    const request = editingEntryId
      ? supabase.from("time_entries").update(payload).eq("id", editingEntryId)
      : supabase.from("time_entries").insert(payload);

    const { error } = await request;

    if (error) {
      setStatus(error.message);
      return;
    }

    resetEntryForm();
    setStatus(editingEntryId ? "Entry updated." : "Entry saved.");
    await loadMonthData();
  }

  function startEntryEdit(entry: TimeEntry) {
    setEditingEntryId(entry.id);
    setEntryForm({
      projectId: entry.project_id ?? "",
      hours: String(entry.hours),
      note: entry.note ?? ""
    });
  }

  function resetEntryForm() {
    setEditingEntryId(null);
    setEntryForm({
      projectId: activeProjects[0]?.id ?? "",
      hours: "",
      note: ""
    });
  }

  async function deleteEntry(entryId: string) {
    const { error } = await supabase
      .from("time_entries")
      .delete()
      .eq("id", entryId);

    if (error) {
      setStatus(error.message);
      return;
    }

    if (editingEntryId === entryId) {
      resetEntryForm();
    }

    setStatus("Entry deleted.");
    await loadMonthData();
  }

  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-6 lg:px-8">
        {status ? (
          <div className="rounded-md border border-line bg-white px-4 py-3 text-sm text-ink shadow-sm">
            {status}
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <section className="flex min-w-0 flex-col gap-4 sm:gap-6">
            <MonthlySummaryPanel summary={monthlySummary} />

            <Calendar
              currentMonth={currentMonth}
              days={calendarDays}
              dayRecordByDate={dayRecordByDate}
              hoursByDate={hoursByDate}
              isLoading={isLoadingMonth}
              onOpenDay={openDay}
            />

            <MonthNavigation
              onNext={() => setCurrentMonth(addMonths(currentMonth, 1))}
              onPrevious={() => setCurrentMonth(addMonths(currentMonth, -1))}
              onToday={() => setCurrentMonth(monthStartISO(todayISO()))}
            />
          </section>

          <aside className="flex min-w-0 flex-col gap-6">
            <button
              className="min-h-12 rounded-md bg-ink px-4 py-3 font-semibold text-white shadow-sm hover:bg-moss"
              type="button"
              onClick={() => setIsMonthlyListOpen(true)}
            >
              Monthly list
            </button>

            <ProjectsPanel
              projectName={projectName}
              projects={projects}
              onAdd={addProject}
              onArchive={archiveProject}
              onDelete={deleteProject}
              onProjectNameChange={setProjectName}
              onRestore={restoreProject}
            />
            <LogoutPanel userEmail={userEmail} />
          </aside>
        </div>
      </div>

      {selectedDate ? (
        <DayModal
          activeProjects={activeProjects}
          dayNote={dayNote}
          dayType={dayType}
          editingEntryId={editingEntryId}
          entries={selectedEntries}
          entryForm={entryForm}
          overtimeHours={selectedOvertimeHours}
          selectedDate={selectedDate}
          totalHours={selectedTotalHours}
          onClose={closeDayModal}
          onDayNoteChange={setDayNote}
          onDayTypeChange={setDayType}
          onDeleteEntry={deleteEntry}
          onEntryChange={setEntryForm}
          onResetEntry={resetEntryForm}
          onSaveDay={saveDayRecord}
          onSaveEntry={saveEntry}
          onStartEntryEdit={startEntryEdit}
        />
      ) : null}

      {isMonthlyListOpen ? (
        <MonthlyListModal
          monthLabel={formatMonth(currentMonth)}
          monthlyList={monthlyList}
          monthlyListText={monthlyListText}
          onClose={() => setIsMonthlyListOpen(false)}
          onCopied={() => setStatus("Monthly list copied.")}
        />
      ) : null}
    </main>
  );
}

function MonthlySummaryPanel({ summary }: { summary: MonthlySummary }) {
  return (
    <section className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
      <SummaryCard label="Worked hours" value={`${formatHours(summary.workedHours)} h`} />
      <SummaryCard
        label="Overtime hours"
        tone={summary.overtimeHours > 0 ? "warm" : "neutral"}
        value={`${formatHours(summary.overtimeHours)} h`}
      />
      <SummaryCard label="Vacation days" tone="blue" value={String(summary.vacationDays)} />
      <SummaryCard label="Sick leave days" tone="purple" value={String(summary.sickLeaveDays)} />
    </section>
  );
}

function MonthNavigation({
  onNext,
  onPrevious,
  onToday
}: {
  onNext: () => void;
  onPrevious: () => void;
  onToday: () => void;
}) {
  return (
    <nav className="grid grid-cols-3 gap-2">
      <button
        className="min-h-11 rounded-md border border-line bg-white px-3 py-2 font-semibold text-ink shadow-sm hover:bg-mist"
        type="button"
        onClick={onPrevious}
      >
        Prev
      </button>
      <button
        className="min-h-11 rounded-md border border-line bg-white px-3 py-2 font-semibold text-ink shadow-sm hover:bg-mist"
        type="button"
        onClick={onToday}
      >
        Today
      </button>
      <button
        className="min-h-11 rounded-md border border-line bg-white px-3 py-2 font-semibold text-ink shadow-sm hover:bg-mist"
        type="button"
        onClick={onNext}
      >
        Next
      </button>
    </nav>
  );
}

function Calendar({
  currentMonth,
  days,
  dayRecordByDate,
  hoursByDate,
  isLoading,
  onOpenDay
}: {
  currentMonth: string;
  days: CalendarDay[];
  dayRecordByDate: Map<string, DayRecord>;
  hoursByDate: Map<string, number>;
  isLoading: boolean;
  onOpenDay: (date: string) => void;
}) {
  return (
    <section className="rounded-md border border-line bg-white p-2 shadow-soft sm:p-4">
      <div className="flex flex-col gap-2 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-ink">{formatMonth(currentMonth)}</h2>
        {isLoading ? <span className="text-sm text-ink/60">Loading month...</span> : null}
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-ink/60 sm:mt-4 sm:gap-2 sm:text-xs">
        {weekdays.map((weekday) => (
          <div key={weekday} className="py-1">
            {weekday}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-2">
        {days.map((day) => {
          const record = dayRecordByDate.get(day.date);
          const hours = hoursByDate.get(day.date) ?? 0;

          return (
            <CalendarCell
              key={day.date}
              day={day}
              dayType={record?.day_type ?? "working_day"}
              hours={hours}
              onOpenDay={onOpenDay}
            />
          );
        })}
      </div>
    </section>
  );
}

function CalendarCell({
  day,
  dayType,
  hours,
  onOpenDay
}: {
  day: CalendarDay;
  dayType: DayType;
  hours: number;
  onOpenDay: (date: string) => void;
}) {
  const today = todayISO();
  const explicitNonWorking = dayType !== "working_day";
  const overtime = Math.max(hours - 8, 0);
  const cellTone = getCellTone(day.date, dayType, hours);
  const toneClass = getCellToneClass(cellTone);
  const todayClass = day.date === today ? "ring-2 ring-blue ring-offset-2 ring-offset-white" : "";
  const dimClass = day.inMonth ? "" : "opacity-35";

  return (
    <button
      className={`flex min-h-[72px] min-w-0 flex-col items-start gap-0.5 rounded-md border p-1.5 text-left transition hover:-translate-y-0.5 hover:shadow-soft sm:min-h-28 sm:gap-1 sm:p-2 ${toneClass} ${todayClass} ${dimClass}`}
      type="button"
      onClick={() => onOpenDay(day.date)}
    >
      <span className="text-sm font-semibold leading-none">{day.dayNumber}</span>
      {hours > 0 ? (
        <span className="max-w-full truncate text-[11px] font-semibold leading-tight sm:text-xs">
          {formatHours(hours)} h
        </span>
      ) : null}
      {overtime > 0 ? (
        <span className="max-w-full truncate text-[10px] font-bold leading-tight text-red-700 sm:text-[11px]">
          +{formatHours(overtime)} h
        </span>
      ) : null}
      {explicitNonWorking ? (
        <span className="mt-auto max-w-full truncate rounded-md bg-white/75 px-1 py-0.5 text-[10px] font-bold leading-tight sm:px-1.5 sm:text-[11px]">
          {getDayTypeShortLabel(dayType)}
        </span>
      ) : null}
    </button>
  );
}

function getCellTone(date: string, dayType: DayType, hours: number) {
  const today = todayISO();

  if (dayType === "vacation") return "vacation";
  if (dayType === "sick_leave") return "sick";
  if (dayType === "holiday") return "holiday";
  if (isWeekend(date)) return "weekend";
  if (date > today) return "future";
  if (date < today && hours > 0) return "worked";
  if (date < today && hours === 0) return "missing";

  return "future";
}

function getCellToneClass(tone: string) {
  switch (tone) {
    case "vacation":
      return "border-blue/50 bg-blue/25 text-blue";
    case "sick":
      return "border-purple-400 bg-purple-200 text-purple-950";
    case "holiday":
      return "border-orange-400 bg-orange-200 text-orange-950";
    case "weekend":
      return "border-slate-300 bg-slate-200 text-slate-700";
    case "worked":
      return "border-green-400 bg-green-200 text-green-950";
    case "missing":
      return "border-red-400 bg-red-200 text-red-950";
    default:
      return "border-slate-300 bg-slate-50 text-ink";
  }
}

function DayModal({
  activeProjects,
  dayNote,
  dayType,
  editingEntryId,
  entries,
  entryForm,
  overtimeHours,
  selectedDate,
  totalHours,
  onClose,
  onDayNoteChange,
  onDayTypeChange,
  onDeleteEntry,
  onEntryChange,
  onResetEntry,
  onSaveDay,
  onSaveEntry,
  onStartEntryEdit
}: {
  activeProjects: Project[];
  dayNote: string;
  dayType: DayType;
  editingEntryId: string | null;
  entries: TimeEntry[];
  entryForm: EntryFormState;
  overtimeHours: number;
  selectedDate: string;
  totalHours: number;
  onClose: () => void;
  onDayNoteChange: (value: string) => void;
  onDayTypeChange: (value: DayType) => void;
  onDeleteEntry: (entryId: string) => void;
  onEntryChange: (value: EntryFormState) => void;
  onResetEntry: () => void;
  onSaveDay: (event: FormEvent<HTMLFormElement>) => void;
  onSaveEntry: (event: FormEvent<HTMLFormElement>) => void;
  onStartEntryEdit: (entry: TimeEntry) => void;
}) {
  const isWorkingDay = dayType === "working_day";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 sm:items-center sm:px-6 sm:py-6">
      <div className="h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-paper shadow-soft sm:h-auto sm:max-h-[88vh] sm:max-w-4xl sm:rounded-md">
        <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-line sm:hidden" />
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-moss">
              {getDayTypeLabel(dayType)}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-ink sm:text-2xl">
              {formatDate(selectedDate)}
            </h2>
          </div>
          <button
            className="min-h-11 w-full rounded-md border border-line px-3 py-2 font-semibold text-ink hover:bg-mist sm:w-fit"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="flex flex-col gap-4 p-3 sm:p-4">
          <EntryForm
            activeProjects={activeProjects}
            disabled={!isWorkingDay}
            entryForm={entryForm}
            editingEntryId={editingEntryId}
            onCancel={onResetEntry}
            onChange={onEntryChange}
            onSubmit={onSaveEntry}
          />

          <DailyEntries
            entries={entries}
            onDelete={onDeleteEntry}
            onEdit={onStartEntryEdit}
          />

          <section className={overtimeHours > 0 ? "grid grid-cols-2 gap-2 sm:gap-3" : "grid gap-2 sm:gap-3"}>
            <SummaryCard label="Daily total" value={`${formatHours(totalHours)} h`} />
            {overtimeHours > 0 ? (
              <SummaryCard
                label="Overtime"
                tone="warm"
                value={`${formatHours(overtimeHours)} h`}
              />
            ) : null}
          </section>

          <form onSubmit={onSaveDay} className="rounded-md border border-line bg-white p-4">
            <h3 className="text-lg font-semibold text-ink">Day status</h3>
            <label className="mt-4 block text-sm font-medium text-ink">
              Day type
              <select
                className="mt-2 min-h-12 rounded-md border border-line bg-white px-3 py-3 text-base outline-none ring-blue/20 focus:ring-4"
                value={dayType}
                onChange={(event) => onDayTypeChange(event.target.value as DayType)}
              >
                {dayTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block text-sm font-medium text-ink">
              Day note
              <textarea
                className="mt-2 min-h-24 rounded-md border border-line bg-white px-3 py-3 text-base outline-none ring-blue/20 focus:ring-4"
                placeholder="Optional note for this day"
                value={dayNote}
                onChange={(event) => onDayNoteChange(event.target.value)}
              />
            </label>

            <button
              className="mt-4 min-h-12 w-full rounded-md bg-ink px-4 py-3 font-semibold text-white hover:bg-moss"
              type="submit"
            >
              Save day status
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function MonthlyListModal({
  monthLabel,
  monthlyList,
  monthlyListText,
  onClose,
  onCopied
}: {
  monthLabel: string;
  monthlyList: MonthlyListDay[];
  monthlyListText: string;
  onClose: () => void;
  onCopied: () => void;
}) {
  async function copyMonthlyList() {
    if (!monthlyListText) return;

    await navigator.clipboard.writeText(monthlyListText);
    onCopied();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 sm:items-center sm:px-6 sm:py-6">
      <div className="h-[86dvh] w-full overflow-y-auto rounded-t-2xl bg-paper shadow-soft sm:h-auto sm:max-h-[82vh] sm:max-w-3xl sm:rounded-md">
        <div className="sticky top-0 z-10 border-b border-line bg-white p-4">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line sm:hidden" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-moss">
                Monthly list
              </p>
              <h2 className="mt-1 text-xl font-semibold text-ink">{monthLabel}</h2>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                className="min-h-11 rounded-md border border-line px-3 py-2 font-semibold text-ink hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!monthlyListText}
                type="button"
                onClick={copyMonthlyList}
              >
                Copy
              </button>
              <button
                className="min-h-11 rounded-md border border-line px-3 py-2 font-semibold text-ink hover:bg-mist"
                type="button"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-3 sm:p-4">
          {monthlyList.length === 0 ? (
            <p className="rounded-md border border-line bg-white p-4 text-sm text-ink/70">
              No time entries for this month.
            </p>
          ) : (
            monthlyList.map((day) => (
              <article key={day.date} className="rounded-md border border-line bg-white p-3">
                <p className="font-semibold text-ink">{day.date}</p>
                <p className="mt-2 select-text break-words text-sm leading-6 text-ink/80">
                  {day.projects
                    .map((project) => `${project.name}: ${formatHours(project.hours)} h`)
                    .join(", ")}
                </p>
              </article>
            ))
          )}

          {monthlyListText ? (
            <textarea
              className="min-h-40 select-all rounded-md border border-line bg-white p-3 text-sm leading-6 text-ink outline-none ring-blue/20 focus:ring-4"
              readOnly
              value={monthlyListText}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EntryForm({
  activeProjects,
  disabled,
  entryForm,
  editingEntryId,
  onCancel,
  onChange,
  onSubmit
}: {
  activeProjects: Project[];
  disabled: boolean;
  entryForm: EntryFormState;
  editingEntryId: string | null;
  onCancel: () => void;
  onChange: (value: EntryFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const formDisabled = disabled || activeProjects.length === 0;

  return (
    <form onSubmit={onSubmit} className="rounded-md border border-line bg-white p-4">
      <div className="flex flex-col justify-between gap-3 border-b border-line pb-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-semibold text-ink">
            {editingEntryId ? "Edit time entry" : "Add time entry"}
          </h3>
          {disabled ? (
            <p className="mt-1 text-sm text-ink/65">
              Time entries are available for working days.
            </p>
          ) : null}
        </div>
        {editingEntryId ? (
          <button
            className="min-h-11 rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-mist"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
      </div>

      <fieldset disabled={formDisabled} className="disabled:opacity-60">
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_140px]">
          <label className="text-sm font-medium text-ink">
            Project
            <select
              className="mt-2 min-h-12 rounded-md border border-line bg-white px-3 py-3 text-base outline-none ring-blue/20 focus:ring-4"
              value={entryForm.projectId}
              onChange={(event) =>
                onChange({ ...entryForm, projectId: event.target.value })
              }
            >
              {activeProjects.length === 0 ? (
                <option value="">Add an active project first</option>
              ) : null}
              {activeProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-ink">
            Hours
            <input
              className="mt-2 min-h-12 rounded-md border border-line bg-white px-3 py-3 text-base outline-none ring-blue/20 focus:ring-4"
              min="0"
              step="0.25"
              type="number"
              value={entryForm.hours}
              onChange={(event) => onChange({ ...entryForm, hours: event.target.value })}
            />
          </label>
        </div>

        <label className="mt-4 block text-sm font-medium text-ink">
          Note
          <textarea
            className="mt-2 min-h-20 rounded-md border border-line bg-white px-3 py-3 text-base outline-none ring-blue/20 focus:ring-4"
            value={entryForm.note}
            onChange={(event) => onChange({ ...entryForm, note: event.target.value })}
          />
        </label>
      </fieldset>

      <button
        className="mt-4 min-h-12 w-full rounded-md bg-ink px-4 py-3 font-semibold text-white hover:bg-moss disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit"
        type="submit"
        disabled={formDisabled}
      >
        {editingEntryId ? "Update entry" : "Add entry"}
      </button>
    </form>
  );
}

function DailyEntries({
  entries,
  onDelete,
  onEdit
}: {
  entries: TimeEntry[];
  onDelete: (entryId: string) => void;
  onEdit: (entry: TimeEntry) => void;
}) {
  return (
    <section className="rounded-md border border-line bg-white p-4">
      <div className="border-b border-line pb-4">
        <h3 className="text-lg font-semibold text-ink">Time entries</h3>
      </div>
      <div className="mt-4 grid gap-3">
        {entries.length === 0 ? (
          <p className="text-sm text-ink/70">No work hours logged for this date.</p>
        ) : (
          entries.map((entry) => (
            <article key={entry.id} className="rounded-md border border-line bg-paper p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate font-semibold text-ink">
                    {entry.projects?.name ?? "Deleted project"}
                  </h4>
                  {entry.note ? (
                    <p className="mt-1 break-words text-sm text-ink/70">{entry.note}</p>
                  ) : null}
                </div>
                <p className="shrink-0 text-lg font-semibold text-ink">
                  {formatHours(Number(entry.hours))} h
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className="min-h-11 rounded-md border border-line bg-white px-3 py-2 font-semibold hover:bg-mist"
                  type="button"
                  onClick={() => onEdit(entry)}
                >
                  Edit
                </button>
                <button
                  className="min-h-11 rounded-md border border-clay bg-white px-3 py-2 font-semibold text-clay hover:bg-clay hover:text-white"
                  type="button"
                  onClick={() => onDelete(entry.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function ProjectsPanel({
  projectName,
  projects,
  onAdd,
  onProjectNameChange,
  onArchive,
  onDelete,
  onRestore
}: {
  projectName: string;
  projects: Project[];
  onAdd: (event: FormEvent<HTMLFormElement>) => void;
  onProjectNameChange: (value: string) => void;
  onArchive: (projectId: string) => void;
  onDelete: (project: Project) => void;
  onRestore: (projectId: string) => void;
}) {
  const [openSection, setOpenSection] = useState<"active" | "archived" | null>(null);
  const activeProjects = projects.filter((project) => project.active);
  const archivedProjects = projects.filter((project) => !project.active);

  return (
    <section className="rounded-md border border-line bg-white p-4 shadow-soft">
      <h2 className="text-xl font-semibold text-ink">Projects</h2>
      <form onSubmit={onAdd} className="mt-4 flex gap-2">
        <input
          className="rounded-md border border-line bg-white px-3 py-2 outline-none ring-blue/20 focus:ring-4"
          placeholder="Project name"
          value={projectName}
          onChange={(event) => onProjectNameChange(event.target.value)}
        />
        <button
          className="shrink-0 rounded-md bg-ink px-4 py-2 font-semibold text-white hover:bg-moss"
          type="submit"
        >
          Add
        </button>
      </form>

      <ProjectAccordion
        actionLabel="Archive"
        emptyText="No active projects."
        isOpen={openSection === "active"}
        projects={activeProjects}
        title="Active projects"
        onDelete={onDelete}
        onToggle={() => setOpenSection(openSection === "active" ? null : "active")}
        onAction={onArchive}
      />

      <ProjectAccordion
        actionLabel="Restore"
        emptyText="No archived projects."
        isOpen={openSection === "archived"}
        projects={archivedProjects}
        title="Archived projects"
        onDelete={onDelete}
        onToggle={() => setOpenSection(openSection === "archived" ? null : "archived")}
        onAction={onRestore}
      />
    </section>
  );
}

function ProjectAccordion({
  actionLabel,
  emptyText,
  isOpen,
  projects,
  title,
  onDelete,
  onToggle,
  onAction
}: {
  actionLabel: string;
  emptyText: string;
  isOpen: boolean;
  projects: Project[];
  title: string;
  onDelete: (project: Project) => void;
  onToggle: () => void;
  onAction: (projectId: string) => void;
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-md border border-line">
      <button
        className="flex min-h-12 w-full items-center justify-between gap-3 bg-paper px-3 py-3 text-left hover:bg-mist"
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="font-semibold text-ink">{title}</span>
        <span className="flex items-center gap-2 text-sm font-semibold text-ink/65">
          {projects.length}
          <span className={isOpen ? "rotate-180 transition" : "transition"}>v</span>
        </span>
      </button>

      {isOpen ? (
        <div className="flex flex-col gap-2 border-t border-line bg-white p-2">
          {projects.length === 0 ? (
            <p className="px-2 py-3 text-sm text-ink/70">{emptyText}</p>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                className="rounded-md border border-line px-3 py-3"
              >
                <p className="truncate font-medium text-ink">{project.name}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    className="min-h-10 rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-mist"
                    type="button"
                    onClick={() => onAction(project.id)}
                  >
                    {actionLabel}
                  </button>
                  <button
                    className="min-h-10 rounded-md border border-clay px-3 py-2 text-sm font-semibold text-clay hover:bg-clay hover:text-white"
                    type="button"
                    onClick={() => onDelete(project)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function LogoutPanel({ userEmail }: { userEmail: string }) {
  async function logOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <section className="rounded-md border border-line bg-white p-4 shadow-soft">
      <p className="truncate text-sm text-ink/65">{userEmail}</p>
      <button
        className="mt-3 min-h-11 w-full rounded-md border border-line px-3 py-2 font-semibold text-ink hover:bg-mist"
        type="button"
        onClick={logOut}
      >
        Log out
      </button>
    </section>
  );
}

function SummaryCard({
  label,
  tone = "neutral",
  value
}: {
  label: string;
  tone?: "neutral" | "warm" | "danger" | "blue" | "purple" | "orange";
  value: string;
}) {
  const toneClass = {
    neutral: "text-ink",
    warm: "text-clay",
    danger: "text-red-700",
    blue: "text-blue",
    purple: "text-purple-800",
    orange: "text-orange-800"
  }[tone];

  return (
    <div className="rounded-md border border-line bg-white p-3 shadow-soft sm:p-4">
      <p className="text-xs font-semibold text-ink/65 sm:text-sm">{label}</p>
      <p className={`mt-1 break-words text-xl font-semibold sm:mt-2 sm:text-3xl ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}
