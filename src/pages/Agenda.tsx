import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Clock, ExternalLink, Plus, Search } from 'lucide-react';
import type { store as appStore } from '../lib/store';
import type { Task, TaskPriority } from '../types';
import { PageIllustrationHeader, StatusBadge } from '../components/ui';

type Store = typeof appStore;
type AgendaFilter = 'late' | 'today' | 'week' | 'all';

interface AgendaProps {
  store: Store;
}

const filterLabels: Record<AgendaFilter, string> = {
  late: 'Retard',
  today: "Aujourd'hui",
  week: 'Cette semaine',
  all: 'Toutes',
};

function toLocalIso(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function addDaysIso(baseIso: string, days: number): string {
  const date = new Date(`${baseIso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toLocalIso(date);
}

function isWithinWeek(date: string, today: string): boolean {
  return date >= today && date <= addDaysIso(today, 6);
}

function getMonthStart(dateIso: string): string {
  const date = new Date(`${dateIso}T12:00:00`);
  return toLocalIso(new Date(date.getFullYear(), date.getMonth(), 1, 12));
}

function getMonthCells(monthStartIso: string): { date: string; muted: boolean }[] {
  const monthStart = new Date(`${monthStartIso}T12:00:00`);
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const firstDay = monthStart.getDay() || 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();
  const cells: { date: string; muted: boolean }[] = [];

  for (let i = firstDay - 2; i >= 0; i -= 1) {
    cells.push({ date: toLocalIso(new Date(year, month - 1, previousMonthDays - i, 12)), muted: true });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: toLocalIso(new Date(year, month, day, 12)), muted: false });
  }

  while (cells.length % 7 !== 0) {
    const last = new Date(`${cells[cells.length - 1].date}T12:00:00`);
    last.setDate(last.getDate() + 1);
    cells.push({ date: toLocalIso(last), muted: true });
  }

  return cells;
}

function moveMonth(monthStartIso: string, delta: number): string {
  const date = new Date(`${monthStartIso}T12:00:00`);
  return toLocalIso(new Date(date.getFullYear(), date.getMonth() + delta, 1, 12));
}

function taskBucket(task: Task, today: string): AgendaFilter {
  if (!task.done && task.date < today) return 'late';
  if (task.date === today) return 'today';
  if (isWithinWeek(task.date, today)) return 'week';
  return 'all';
}

function priorityTone(priority: TaskPriority): 'danger' | 'warning' | 'neutral' {
  if (priority === 'haute') return 'danger';
  if (priority === 'moyenne') return 'warning';
  return 'neutral';
}

function formatDateLabel(date: string, today: string): string {
  if (date === today) return "Aujourd'hui";
  if (date === addDaysIso(today, 1)) return 'Demain';
  return new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: 'short' }).format(new Date(`${date}T12:00:00`));
}

export function Agenda({ store }: AgendaProps) {
  const [, forceUpdate] = useState(0);
  const [filter, setFilter] = useState<AgendaFilter>('late');
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => getMonthStart(toLocalIso()));
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(() => toLocalIso());
  const [newTime, setNewTime] = useState('09:00');
  const [newPriority, setNewPriority] = useState<TaskPriority>('moyenne');

  useEffect(() => {
    const handler = () => forceUpdate(n => n + 1);
    window.addEventListener('ip-state-changed', handler);
    return () => window.removeEventListener('ip-state-changed', handler);
  }, []);

  const today = toLocalIso();
  const tasks = store.getTasks();
  const firstLateTaskDate = useMemo(
    () => tasks.filter(task => taskBucket(task, today) === 'late').sort((a, b) => a.date.localeCompare(b.date))[0]?.date,
    [tasks, today]
  );

  useEffect(() => {
    if (filter === 'late' && !selectedDate && firstLateTaskDate) {
      setCalendarMonth(getMonthStart(firstLateTaskDate));
    }
  }, [filter, firstLateTaskDate, selectedDate]);

  const monthCells = useMemo(() => getMonthCells(calendarMonth), [calendarMonth]);
  const calendarTitle = useMemo(
    () => new Intl.DateTimeFormat('fr-BE', { month: 'long', year: 'numeric' }).format(new Date(`${calendarMonth}T12:00:00`)),
    [calendarMonth]
  );

  const counts = useMemo(() => ({
    late: tasks.filter(task => taskBucket(task, today) === 'late').length,
    today: tasks.filter(task => task.date === today).length,
    week: tasks.filter(task => isWithinWeek(task.date, today)).length,
    all: tasks.length,
  }), [tasks, today]);

  const visibleTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks
      .filter(task => {
        if (selectedDate && task.date !== selectedDate) return false;
        if (filter === 'late' && taskBucket(task, today) !== 'late') return false;
        if (filter === 'today' && task.date !== today) return false;
        if (filter === 'week' && !isWithinWeek(task.date, today)) return false;
        if (!q) return true;

        const property = task.propertyId ? store.getProperty(task.propertyId) : undefined;
        const deal = task.dealId ? store.getDeal(task.dealId) : undefined;
        const contact = task.contactId ? store.getContact(task.contactId) : undefined;
        return [
          task.title,
          task.place ?? '',
          property?.title ?? '',
          property?.city ?? '',
          deal?.title ?? '',
          contact?.name ?? '',
        ].some(value => value.toLowerCase().includes(q));
      })
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [filter, search, selectedDate, store, tasks, today]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const existing = map.get(task.date) ?? [];
      existing.push(task);
      map.set(task.date, existing);
    }
    return map;
  }, [tasks]);

  const stats = {
    doneToday: tasks.filter(task => task.done && task.date === today).length,
    openWeek: tasks.filter(task => !task.done && isWithinWeek(task.date, today)).length,
    urgent: tasks.filter(task => !task.done && task.priority === 'haute').length,
  };

  const createTask = () => {
    const title = newTitle.trim();
    if (!title) return;
    store.createManualTask({
      title,
      date: newDate,
      time: newTime,
      priority: newPriority,
    });
    setNewTitle('');
    setNewDate(today);
    setNewTime('09:00');
    setNewPriority('moyenne');
    setFilter(newDate === today ? 'today' : 'week');
  };

  const openLinkedObject = (task: Task) => {
    if (task.dealId) {
      window.location.hash = `#pipeline?dealId=${encodeURIComponent(task.dealId)}`;
      return;
    }
    if (task.propertyId) {
      window.location.hash = `#biens?propertyId=${task.propertyId}`;
      return;
    }
    if (task.contactId) {
      window.location.hash = `#contacts?contactId=${encodeURIComponent(task.contactId)}`;
    }
  };

  const getLinkedLabel = (task: Task): string => {
    if (task.dealId) return store.getDeal(task.dealId)?.title ?? 'Deal lié';
    if (task.propertyId) return store.getProperty(task.propertyId)?.title ?? 'Bien lié';
    if (task.contactId) return store.getContact(task.contactId)?.name ?? 'Contact lié';
    return 'Aucun objet lié';
  };

  const getTaskKind = (task: Task): 'deal' | 'bien' | 'contact' | 'perso' => {
    if (task.dealId) return 'deal';
    if (task.propertyId) return 'bien';
    if (task.contactId) return 'contact';
    return 'perso';
  };

  return (
    <div className="agenda-react-page">
      <PageIllustrationHeader
        imageUrl="/agenda-header-illustration.png"
        height={150}
        padding="12px 32px 0"
        backgroundPosition="center 50%"
        backgroundSize="100% auto"
      />

      <div className="agenda-react-content">
        <header className="agenda-react-titlebar">
          <div>
            <h1>Agenda</h1>
            <p>Toutes les actions créées depuis les biens, contacts et deals.</p>
          </div>
          <div className="agenda-search">
            <Search size={15} />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher une tâche..." />
          </div>
        </header>

        <section className="agenda-kpis">
          <AgendaKpi label="En retard" value={counts.late} tone="danger" />
          <AgendaKpi label="Aujourd'hui" value={counts.today} tone="success" />
          <AgendaKpi label="Semaine" value={counts.week} tone="warning" />
          <AgendaKpi label="Urgentes" value={stats.urgent} tone="neutral" />
        </section>

        <section className="agenda-create-card">
          <div className="agenda-create-main">
            <Plus size={15} />
            <input
              value={newTitle}
              onChange={event => setNewTitle(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') createTask(); }}
              placeholder="Ajouter une tâche manuelle..."
            />
          </div>
          <input type="date" value={newDate} onChange={event => setNewDate(event.target.value)} />
          <input type="time" value={newTime} onChange={event => setNewTime(event.target.value)} />
          <select value={newPriority} onChange={event => setNewPriority(event.target.value as TaskPriority)}>
            <option value="basse">Basse</option>
            <option value="moyenne">Moyenne</option>
            <option value="haute">Haute</option>
          </select>
          <button type="button" onClick={createTask}>Ajouter</button>
        </section>

        <main className="agenda-layout">
          <aside className="agenda-sidebar-panel">
            {(Object.keys(filterLabels) as AgendaFilter[]).map(item => (
              <button
                key={item}
                type="button"
                className={!selectedDate && filter === item ? 'active' : ''}
                onClick={() => {
                  setSelectedDate(null);
                  setFilter(item);
                }}
              >
                <span>{filterLabels[item]}</span>
                <strong>{counts[item]}</strong>
              </button>
            ))}
            <div className="agenda-summary-card">
              <CalendarClock size={17} />
              <strong>{stats.openWeek}</strong>
              <span>actions ouvertes cette semaine</span>
            </div>
          </aside>

          <section className="agenda-task-panel">
            <div className="agenda-task-panel-head">
              <span>{visibleTasks.length} tâches affichées{selectedDate ? ` · ${formatDateLabel(selectedDate, today)}` : ''}</span>
              <span>{stats.doneToday} terminées aujourd'hui</span>
            </div>

            <div className="agenda-task-list">
              {visibleTasks.length === 0 ? (
                <div className="agenda-empty">Aucune tâche dans cette vue.</div>
              ) : visibleTasks.map(task => (
                <AgendaTaskRow
                  key={task.id}
                  task={task}
                  today={today}
                  linkedLabel={getLinkedLabel(task)}
                  onToggle={() => store.toggleTask(task.id)}
                  onDateChange={date => store.updateTask(task.id, { date })}
                  onTimeChange={time => store.updateTask(task.id, { time })}
                  onOpen={() => openLinkedObject(task)}
                />
              ))}
            </div>
          </section>

          <aside className="agenda-calendar-panel">
            <div className="agenda-month-card">
              <div className="agenda-month-head">
                <span>{calendarTitle}</span>
                <div>
                  <button type="button" onClick={() => setCalendarMonth(moveMonth(calendarMonth, -1))} aria-label="Mois précédent">‹</button>
                  <button type="button" onClick={() => setCalendarMonth(moveMonth(calendarMonth, 1))} aria-label="Mois suivant">›</button>
                </div>
              </div>

              <div className="agenda-month-weekdays">
                <span>Lu</span><span>Ma</span><span>Me</span><span>Je</span><span>Ve</span><span>Sa</span><span>Di</span>
              </div>

              <div className="agenda-month-grid">
                {monthCells.map(cell => {
                  const dayTasks = tasksByDate.get(cell.date) ?? [];
                  const isSelected = selectedDate === cell.date;
                  const isToday = cell.date === today;
                  return (
                    <button
                      key={cell.date}
                      type="button"
                      className={`${cell.muted ? 'muted' : ''} ${isSelected ? 'active' : ''} ${isToday ? 'today' : ''}`}
                      onClick={() => {
                        setSelectedDate(cell.date);
                        setFilter('all');
                      }}
                    >
                      <span className="agenda-month-day-num">
                        {new Intl.DateTimeFormat('fr-BE', { day: 'numeric' }).format(new Date(`${cell.date}T12:00:00`))}
                      </span>

                      {dayTasks.length > 0 && (
                        <>
                          <span className="agenda-month-dots">
                            {dayTasks.slice(0, 3).map(task => (
                              <i key={task.id} className={`${getTaskKind(task)} ${task.done ? 'completed' : ''}`} />
                            ))}
                          </span>
                          <span className="agenda-month-tooltip">
                            <strong>{dayTasks.length} action{dayTasks.length > 1 ? 's' : ''} le {formatDateLabel(cell.date, today)}</strong>
                            {dayTasks.slice(0, 5).map(task => (
                              <span key={task.id} className={`agenda-month-tooltip-task ${task.done ? 'completed' : ''}`}>
                                <i className={getTaskKind(task)} />
                                <em>{task.title}</em>
                                <small>{task.time}</small>
                              </span>
                            ))}
                          </span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="agenda-calendar-head">
              <div>
                <strong>{selectedDate ? formatDateLabel(selectedDate, today) : "Aujourd'hui"}</strong>
                <span>{(tasksByDate.get(selectedDate ?? today) ?? []).length} action(s)</span>
              </div>
              {selectedDate && (
                <button type="button" onClick={() => setSelectedDate(null)}>Tout voir</button>
              )}
            </div>

            <div className="agenda-calendar-list">
              {(tasksByDate.get(selectedDate ?? today) ?? []).slice(0, 5).map(task => (
                <button key={task.id} type="button" onClick={() => setSelectedDate(task.date)}>
                  <span>{task.time}</span>
                  <strong>{task.title}</strong>
                </button>
              ))}
              {(tasksByDate.get(selectedDate ?? today) ?? []).length === 0 && (
                <p>Aucune action ce jour.</p>
              )}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

function AgendaKpi({ label, value, tone }: { label: string; value: number; tone: 'success' | 'warning' | 'danger' | 'neutral' }) {
  return (
    <div className={`agenda-kpi ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

interface AgendaTaskRowProps {
  task: Task;
  today: string;
  linkedLabel: string;
  onToggle: () => void;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onOpen: () => void;
}

function AgendaTaskRow({ task, today, linkedLabel, onToggle, onDateChange, onTimeChange, onOpen }: AgendaTaskRowProps) {
  const late = !task.done && task.date < today;
  const hasLink = Boolean(task.dealId || task.propertyId || task.contactId);

  return (
    <article className={`agenda-task-row ${task.done ? 'done' : ''} ${late ? 'late' : ''}`}>
      <button type="button" className="agenda-check" onClick={onToggle} aria-label="Marquer terminé">
        {task.done && <Check size={12} />}
      </button>
      <div className="agenda-task-main">
        <div className="agenda-task-title-line">
          <strong>{task.title}</strong>
          <StatusBadge tone={late ? 'danger' : priorityTone(task.priority)}>
            {late ? 'Retard' : task.priority}
          </StatusBadge>
        </div>
        <div className="agenda-task-meta">
          <Clock size={13} />
          <span>{formatDateLabel(task.date, today)} à {task.time}</span>
          <span>·</span>
          <button type="button" disabled={!hasLink} onClick={onOpen}>
            {linkedLabel}
            {hasLink && <ExternalLink size={12} />}
          </button>
        </div>
      </div>
      <div className="agenda-task-edit">
        <input type="date" value={task.date} onChange={event => onDateChange(event.target.value)} />
        <input type="time" value={task.time} onChange={event => onTimeChange(event.target.value)} />
      </div>
    </article>
  );
}
