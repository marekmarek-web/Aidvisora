"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  ChevronRight,
  AlertCircle,
  CalendarDays,
  User,
  FileText,
  Trash2,
  ArrowRight,
} from "lucide-react";
import type { TaskRow, TaskCounts } from "@/app/actions/tasks";
import type { ContactRow } from "@/app/actions/contacts";
import {
  BottomSheet,
  EmptyState,
  FilterChips,
  MobileCard,
  MobileSectionHeader,
  MobileLoadingState,
  SearchBar,
  StatusBadge,
} from "@/app/shared/mobile-ui/primitives";
import { VirtualizedColumn } from "@/app/shared/mobile-ui/VirtualizedColumn";
import type { DeviceClass } from "@/lib/ui/useDeviceClass";
import { formatDisplayDateCs } from "@/lib/date/format-display-cs";
import { isDueDateBeforeLocalToday, localCalendarTodayYmd, normalizeIsoDateOnly } from "@/lib/date/date-only";

const TASK_LIST_VIRTUAL_THRESHOLD = 25;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Synchronní s MobilePortalClient / getTasksList filtry. Starý „týden“ na mobilu mapujeme na „vše“. */
type TaskFilter = "all" | "today" | "week" | "overdue" | "completed";

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const yy = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mo}-${dd}`;
}

function completedLocalYmd(completedAt: Date | null): string | null {
  if (!completedAt) return null;
  const d = completedAt instanceof Date ? completedAt : new Date(completedAt);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${dd}`;
}

function getDateLabel(due: string | null, todayStr: string): { label: string; isOverdue: boolean; isToday: boolean } {
  if (!due) return { label: "Bez termínu", isOverdue: false, isToday: false };
  const dueNorm = normalizeIsoDateOnly(due);
  if (!dueNorm) return { label: "Bez termínu", isOverdue: false, isToday: false };
  const [yy, mm, dd] = todayStr.split("-").map(Number);
  const next = new Date(yy, mm - 1, dd + 1);
  const tomorrowStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
  if (dueNorm < todayStr) return { label: "Po termínu", isOverdue: true, isToday: false };
  if (dueNorm === todayStr) return { label: "Dnes", isOverdue: false, isToday: true };
  if (dueNorm === tomorrowStr) return { label: "Zítra", isOverdue: false, isToday: false };
  return {
    label: formatDisplayDateCs(dueNorm) || dueNorm,
    isOverdue: false,
    isToday: false,
  };
}

function applyDayStrip(tasks: TaskRow[], stripYmd: string, taskFilter: TaskFilter, todayStr: string): TaskRow[] {
  if (taskFilter === "week") return tasks;
  if (taskFilter === "today") {
    return tasks.filter((t) => normalizeIsoDateOnly(t.dueDate) === todayStr);
  }
  if (taskFilter === "overdue") {
    return tasks.filter((t) => {
      const due = normalizeIsoDateOnly(t.dueDate);
      return Boolean(due && due === stripYmd && isDueDateBeforeLocalToday(due));
    });
  }
  if (taskFilter === "completed") {
    return tasks.filter((t) => {
      const c = completedLocalYmd(t.completedAt);
      return Boolean(c && c === stripYmd);
    });
  }
  return tasks.filter((t) => {
    const due = normalizeIsoDateOnly(t.dueDate);
    if (!due) return stripYmd === todayStr;
    return due === stripYmd;
  });
}

function TaskProgressCard({ taskCounts, todayStr }: { taskCounts: TaskCounts; todayStr: string }) {
  const openTotal = taskCounts.all;
  const notOverdueShare = openTotal === 0 ? 100 : Math.round(((openTotal - taskCounts.overdue) / openTotal) * 100);
  const dateShort = formatDisplayDateCs(todayStr) ?? todayStr;

  return (
    <MobileCard className="overflow-hidden border-indigo-100/90 bg-gradient-to-br from-white via-indigo-50/30 to-violet-50/20 p-4 shadow-[var(--aidv-mobile-shadow-card-premium,var(--aidv-shadow-card-sm))]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[color:var(--wp-text-tertiary)]">Dnešní souhrn</p>
          <p className="mt-1 text-sm font-black leading-snug text-[#0a0f29]">
            Termín dnes ({dateShort}): {taskCounts.today} otevřených
          </p>
          <p className="mt-1 text-xs font-medium text-[color:var(--wp-text-secondary)]">
            Po termínu v diáři: {taskCounts.overdue} — interní evidence pro poradce, nikoli hodnocení klienta.
          </p>
        </div>
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-950/20">
          <span className="text-lg font-black leading-none tabular-nums">{notOverdueShare}%</span>
          <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-white/90">bez skluzu</span>
        </div>
      </div>
      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--wp-surface-muted)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(4, Math.min(100, notOverdueShare))}%` }}
        />
      </div>
    </MobileCard>
  );
}

function DayStrip({
  todayStr,
  selectedYmd,
  onSelect,
}: {
  todayStr: string;
  selectedYmd: string;
  onSelect: (ymd: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => {
    const out: string[] = [];
    for (let i = -4; i <= 10; i++) {
      out.push(addDaysYmd(todayStr, i));
    }
    return out;
  }, [todayStr]);

  const scrollToSelected = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const sel = el.querySelector<HTMLElement>('[data-strip-active="true"]');
    sel?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, []);

  useEffect(() => {
    scrollToSelected();
  }, [selectedYmd, scrollToSelected]);

  return (
    <div
      ref={scrollerRef}
      className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1 snap-x snap-mandatory scroll-px-2"
      role="tablist"
      aria-label="Výběr dne"
    >
      {days.map((ymd) => {
        const isToday = ymd === todayStr;
        const active = ymd === selectedYmd;
        const ddmmyyyy = formatDisplayDateCs(ymd) ?? ymd;
        return (
          <button
            key={ymd}
            type="button"
            data-strip-active={active ? "true" : undefined}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(ymd)}
            className={cx(
              "min-h-[52px] min-w-[72px] shrink-0 snap-center rounded-2xl border px-2.5 py-2 text-center transition-all active:scale-[0.98]",
              active
                ? "border-indigo-300 bg-gradient-to-b from-indigo-50 to-violet-50 shadow-md shadow-indigo-950/10"
                : "border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)]",
            )}
          >
            <span
              className={cx(
                "block text-[9px] font-black uppercase tracking-wider",
                isToday ? "text-indigo-600" : "text-[color:var(--wp-text-tertiary)]",
              )}
            >
              {isToday ? "Dnes" : new Date(ymd + "T12:00:00").toLocaleDateString("cs-CZ", { weekday: "short" })}
            </span>
            <span className="mt-0.5 block text-[11px] font-bold tabular-nums leading-tight text-[#0a0f29]">
              {ddmmyyyy}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TaskDetailSheet({
  task,
  onClose,
  onToggle,
  onDelete,
  onQuickFix,
  todayStr,
}: {
  task: TaskRow;
  onClose: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onQuickFix: () => void;
  todayStr: string;
}) {
  const { label, isOverdue } = getDateLabel(task.dueDate, todayStr);
  const isDone = Boolean(task.completedAt);

  return (
    <BottomSheet
      open
      title={task.title}
      onClose={onClose}
      compact
      reserveMobileBottomNav
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onToggle}
            className={cx(
              "min-h-[48px] rounded-xl text-sm font-bold flex items-center justify-center gap-2",
              isDone
                ? "border border-[color:var(--wp-surface-card-border)] text-[color:var(--wp-text-secondary)]"
                : "bg-emerald-600 text-white",
            )}
          >
            {isDone ? (
              <>
                <Circle size={16} /> Znovu otevřít
              </>
            ) : (
              <>
                <CheckCircle2 size={16} /> Dokončit
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="min-h-[48px] rounded-xl border border-rose-200 text-rose-700 text-sm font-bold flex items-center justify-center gap-2"
          >
            <Trash2 size={16} /> Smazat
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <span
            className={cx(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-widest",
              isDone
                ? "bg-emerald-50 text-emerald-700"
                : isOverdue
                  ? "bg-rose-50 text-rose-700"
                  : "bg-amber-50 text-amber-700",
            )}
          >
            <Clock size={11} />
            {isDone ? "Dokončeno" : label}
          </span>
          {task.contactName && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[color:var(--wp-surface-muted)] text-[color:var(--wp-text-secondary)]">
              <User size={11} /> {task.contactName}
            </span>
          )}
          {task.opportunityTitle && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700">
              <FileText size={11} /> {task.opportunityTitle}
            </span>
          )}
        </div>

        {task.description ? (
          <p className="text-sm text-[color:var(--wp-text-secondary)] leading-relaxed bg-[color:var(--wp-surface-muted)] rounded-xl px-4 py-3">
            {task.description}
          </p>
        ) : null}

        {isOverdue && !isDone ? (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100">
            <AlertCircle size={16} className="text-rose-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-rose-800">Úkol je po termínu</p>
              <button
                type="button"
                onClick={onQuickFix}
                className="mt-1.5 text-xs font-bold text-rose-700 underline-offset-2 hover:underline"
              >
                Přesunout na dnešek →
              </button>
            </div>
          </div>
        ) : null}

        {task.contactId ? (
          <a
            href={`/portal/contacts/${task.contactId}`}
            className="w-full min-h-[44px] rounded-xl border border-[color:var(--wp-surface-card-border)] text-[color:var(--wp-text-secondary)] text-sm font-bold flex items-center justify-center gap-2"
          >
            <User size={14} /> Otevřít klienta <ArrowRight size={14} />
          </a>
        ) : null}
      </div>
    </BottomSheet>
  );
}

function ModernTaskRow({
  task,
  todayStr,
  onToggleTask,
  onSelectTask,
}: {
  task: TaskRow;
  todayStr: string;
  onToggleTask: (task: TaskRow) => void;
  onSelectTask: (task: TaskRow) => void;
}) {
  const isDone = Boolean(task.completedAt);
  const { label, isOverdue, isToday } = getDateLabel(task.dueDate, todayStr);
  return (
    <MobileCard
      className={cx(
        "p-0 overflow-hidden shadow-[var(--aidv-mobile-shadow-card-premium,var(--aidv-shadow-card-sm))]",
        isOverdue && !isDone && "ring-1 ring-rose-200/90",
      )}
    >
      <div className="flex items-stretch gap-0">
        <button
          type="button"
          onClick={() => onToggleTask(task)}
          className={cx(
            "w-[3.25rem] shrink-0 flex items-center justify-center transition-colors",
            isDone
              ? "bg-emerald-50 text-emerald-500"
              : isOverdue
                ? "bg-rose-50 text-rose-400"
                : "bg-gradient-to-b from-indigo-50/80 to-violet-50/50 text-indigo-300",
          )}
          aria-label={isDone ? "Znovu otevřít" : "Označit jako hotovo"}
        >
          {isDone ? <CheckCircle2 size={24} className="text-emerald-500" /> : <Circle size={24} strokeWidth={2} />}
        </button>

        <button
          type="button"
          onClick={() => onSelectTask(task)}
          className="flex flex-1 min-w-0 items-center gap-2 p-3.5 text-left"
        >
          <div className="min-w-0 flex-1">
            <p
              className={cx(
                "text-[15px] font-bold leading-snug",
                isDone ? "line-through text-[color:var(--wp-text-tertiary)]" : "text-[color:var(--wp-text)]",
              )}
            >
              {task.title}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {task.dueDate ? (
                <span
                  className={cx(
                    "text-[10px] font-black uppercase tracking-widest flex items-center gap-1",
                    isOverdue && !isDone
                      ? "text-rose-600"
                      : isToday && !isDone
                        ? "text-amber-600"
                        : "text-[color:var(--wp-text-tertiary)]",
                  )}
                >
                  <CalendarDays size={10} />
                  {label}
                </span>
              ) : null}
              {task.contactName ? (
                <StatusBadge tone="info">{task.contactName}</StatusBadge>
              ) : null}
            </div>
          </div>
          <ChevronRight size={18} className="shrink-0 text-[color:var(--wp-text-tertiary)]" aria-hidden />
        </button>
      </div>
    </MobileCard>
  );
}

interface TasksScreenProps {
  tasks: TaskRow[];
  taskCounts: TaskCounts;
  taskFilter: TaskFilter;
  contacts: ContactRow[];
  deviceClass: DeviceClass;
  refreshing?: boolean;
  onFilterChange: (filter: TaskFilter) => void;
  onToggleTask: (task: TaskRow) => void;
  onDeleteTask: (taskId: string) => void;
  onQuickOverdueFix: (task: TaskRow) => void;
}

export function TasksScreen({
  tasks,
  taskCounts,
  taskFilter,
  deviceClass,
  refreshing = false,
  onFilterChange,
  onToggleTask,
  onDeleteTask,
  onQuickOverdueFix,
}: TasksScreenProps) {
  void contacts;

  const todayStr = localCalendarTodayYmd();
  const [search, setSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);
  const [stripYmd, setStripYmd] = useState(todayStr);
  const coercedWeek = useRef(false);

  /** Legacy výběr „týden“ z hostitele nahradíme plným výpisem na mobilních čipech bez „týdne“. */
  useEffect(() => {
    if (taskFilter !== "week" || coercedWeek.current) return;
    coercedWeek.current = true;
    onFilterChange("all");
  }, [taskFilter, onFilterChange]);

  useEffect(() => {
    setStripYmd(todayStr);
  }, [taskFilter, todayStr]);

  const onStripDaySelect = useCallback(
    (ymd: string) => {
      if (taskFilter === "today" && ymd !== todayStr) {
        onFilterChange("all");
      }
      setStripYmd(ymd);
    },
    [taskFilter, todayStr, onFilterChange],
  );

  const filterOptions = useMemo(
    () => [
      { id: "all", label: "Vše", badge: taskCounts.all },
      { id: "today", label: "Dnes", badge: taskCounts.today },
      { id: "overdue", label: "Po termínu", badge: taskCounts.overdue, tone: "warning" as const },
      { id: "completed", label: "Hotovo", badge: taskCounts.completed },
    ],
    [taskCounts],
  );

  const chipValue =
    taskFilter === "week" ? "all" : (taskFilter as "all" | "today" | "overdue" | "completed");

  const overdueCount = tasks.filter((t) => !t.completedAt && !!t.dueDate && isDueDateBeforeLocalToday(t.dueDate)).length;

  const afterSearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.contactName ?? "").toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q),
    );
  }, [tasks, search]);

  const filtered = useMemo(() => {
    return applyDayStrip(afterSearch, stripYmd, taskFilter, todayStr);
  }, [afterSearch, stripYmd, taskFilter, todayStr]);

  return (
    <div className={cx("w-full min-w-0 space-y-4 overflow-x-hidden", deviceClass === "tablet" && "mx-auto max-w-2xl")}>
      <MobileSectionHeader title="Úkoly dnes" subtitle={`Váš diář a interní práce (${formatDisplayDateCs(todayStr) ?? ""})`} />

      <TaskProgressCard taskCounts={taskCounts} todayStr={todayStr} />

      <div>
        <p className="mb-2 text-[11px] font-black uppercase tracking-[0.1em] text-[color:var(--wp-text-secondary)]">
          Vyberte den
        </p>
        <DayStrip todayStr={todayStr} selectedYmd={stripYmd} onSelect={onStripDaySelect} />
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Hledat úkol…" />

      <FilterChips
        value={chipValue}
        onChange={(id) => onFilterChange(id as TaskFilter)}
        options={filterOptions}
      />

      {overdueCount > 0 && chipValue !== "overdue" && chipValue !== "completed" ? (
        <MobileCard className="border-rose-200 bg-rose-50/50 p-3.5">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="shrink-0 text-rose-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-rose-800">
                {overdueCount} {overdueCount === 1 ? "úkol" : overdueCount < 5 ? "úkoly" : "úkolů"} po termínu
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setStripYmd(todayStr);
                onFilterChange("overdue");
              }}
              className="min-h-[44px] shrink-0 rounded-lg border border-rose-200 bg-[color:var(--wp-surface-card)] px-3 text-xs font-bold text-rose-700"
            >
              Zobrazit
            </button>
          </div>
        </MobileCard>
      ) : null}

      {refreshing && tasks.length === 0 ? (
        <MobileLoadingState variant="card" rows={5} label="Načítám úkoly" />
      ) : !refreshing && filtered.length === 0 ? (
        <EmptyState
          title="Žádné úkoly"
          description={
            search
              ? "Žádné výsledky hledání."
              : "V tomto výběru dne a filtru nejsou žádné položky."
          }
        />
      ) : filtered.length > 0 ? (
        <VirtualizedColumn
          count={filtered.length}
          estimateSize={120}
          enabled={filtered.length >= TASK_LIST_VIRTUAL_THRESHOLD}
          fallback={filtered.map((task) => (
            <ModernTaskRow
              key={task.id}
              task={task}
              todayStr={todayStr}
              onToggleTask={onToggleTask}
              onSelectTask={setSelectedTask}
            />
          ))}
        >
          {(index) => {
            const task = filtered[index];
            if (!task) return null;
            return (
              <div className="pb-3">
                <ModernTaskRow
                  task={task}
                  todayStr={todayStr}
                  onToggleTask={onToggleTask}
                  onSelectTask={setSelectedTask}
                />
              </div>
            );
          }}
        </VirtualizedColumn>
      ) : null}

      {selectedTask ? (
        <TaskDetailSheet
          task={selectedTask}
          todayStr={todayStr}
          onClose={() => setSelectedTask(null)}
          onToggle={() => {
            onToggleTask(selectedTask);
            setSelectedTask(null);
          }}
          onDelete={() => {
            onDeleteTask(selectedTask.id);
            setSelectedTask(null);
          }}
          onQuickFix={() => {
            onQuickOverdueFix(selectedTask);
            setSelectedTask(null);
          }}
        />
      ) : null}
    </div>
  );
}
