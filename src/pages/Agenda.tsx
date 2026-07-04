import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Clock, ExternalLink, Loader2, Plus, Search, X } from 'lucide-react';
import type { store as appStore } from '../lib/store';
import { fetchSupabaseProperties } from '../lib/supabaseProperties';
import { useContacts } from '../lib/useContacts';
import { useDeals } from '../lib/useDeals';
import { taskLinkLabel, useTasks, type UseTasksResult } from '../lib/useTasks';
import type { TaskPriority } from '../types';
import type { TaskWithRelations } from '../lib/services/tasksService';
import { StatusBadge } from '../components/ui';

type Store = typeof appStore;
type AgendaFilter = 'overdue' | 'today' | 'this_week' | 'all' | 'completed';
type LinkKind = 'none' | 'deal' | 'property' | 'contact';

interface AgendaProps {
  store: Store;
}

const filterLabels: Record<AgendaFilter, string> = {
  overdue: 'En retard',
  today: "Aujourd'hui",
  this_week: 'Cette semaine',
  all: 'Toutes',
  completed: 'Terminées',
};

function toLocalIso(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function dueParts(task: TaskWithRelations): { date: string; time: string } {
  const due = task.due_date ? new Date(task.due_date) : null;
  if (!due || Number.isNaN(due.getTime())) return { date: '', time: '09:00' };
  return { date: due.toISOString().slice(0, 10), time: due.toTimeString().slice(0, 5) };
}

function dueDateIso(date: string, time: string): string | null {
  if (!date) return null;
  return new Date(`${date}T${time || '09:00'}:00`).toISOString();
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

function priorityTone(priority: TaskPriority): 'danger' | 'warning' | 'neutral' {
  if (priority === 'haute') return 'danger';
  if (priority === 'moyenne') return 'warning';
  return 'neutral';
}

function taskPriority(task: TaskWithRelations): TaskPriority {
  if (task.priority === 'haute' || task.priority === 'high' || task.priority === 'urgent') return 'haute';
  if (task.priority === 'basse' || task.priority === 'low' || task.priority === 'faible') return 'basse';
  return 'moyenne';
}

function formatDateLabel(date: string, today: string): string {
  if (!date) return 'Sans échéance';
  if (date === today) return "Aujourd'hui";
  if (date === addDaysIso(today, 1)) return 'Demain';
  return new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: 'short' }).format(new Date(`${date}T12:00:00`));
}

function openLinkedObject(task: TaskWithRelations) {
  if (task.deal_id) {
    window.location.hash = task.relations.deal?.reference
      ? `#pipeline?deal=${encodeURIComponent(task.relations.deal.reference)}`
      : `#pipeline?dealId=${encodeURIComponent(task.deal_id)}`;
    return;
  }
  if (task.property_id) {
    window.location.hash = `#biens?propertyId=${encodeURIComponent(task.property_id)}`;
    return;
  }
  if (task.contact_id) {
    window.location.hash = task.relations.contact?.reference
      ? `#contacts?contact=${encodeURIComponent(task.relations.contact.reference)}`
      : `#contacts?contactId=${encodeURIComponent(task.contact_id)}`;
  }
}

function getTaskKind(task: TaskWithRelations): 'deal' | 'bien' | 'contact' | 'perso' {
  if (task.deal_id) return 'deal';
  if (task.property_id) return 'bien';
  if (task.contact_id) return 'contact';
  return 'perso';
}

export function Agenda({ store }: AgendaProps) {
  void store;
  const [filter, setFilter] = useState<AgendaFilter>('overdue');
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => getMonthStart(toLocalIso()));
  const [createOpen, setCreateOpen] = useState(false);
  const taskState = useTasks({ scope: 'all' });

  const today = toLocalIso();
  const monthCells = useMemo(() => getMonthCells(calendarMonth), [calendarMonth]);
  const calendarTitle = useMemo(
    () => new Intl.DateTimeFormat('fr-BE', { month: 'long', year: 'numeric' }).format(new Date(`${calendarMonth}T12:00:00`)),
    [calendarMonth],
  );

  const allTasks = taskState.tasks;
  const counts = useMemo(() => {
    const late = allTasks.filter((task) => {
      const { date } = dueParts(task);
      return !task.is_completed && date && date < today;
    }).length;
    return {
      overdue: late,
      today: allTasks.filter((task) => !task.is_completed && dueParts(task).date === today).length,
      this_week: allTasks.filter((task) => {
        const { date } = dueParts(task);
        return !task.is_completed && date && isWithinWeek(date, today);
      }).length,
      all: allTasks.length,
      completed: allTasks.filter((task) => task.is_completed).length,
    };
  }, [allTasks, today]);

  const firstLateTaskDate = useMemo(
    () => allTasks
      .filter((task) => {
        const { date } = dueParts(task);
        return !task.is_completed && date && date < today;
      })
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))[0]?.due_date?.slice(0, 10),
    [allTasks, today],
  );

  useEffect(() => {
    if (filter === 'overdue' && !selectedDate && firstLateTaskDate) {
      setCalendarMonth(getMonthStart(firstLateTaskDate));
    }
  }, [filter, firstLateTaskDate, selectedDate]);

  const visibleTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTasks
      .filter((task) => {
        const { date } = dueParts(task);
        if (selectedDate && date !== selectedDate) return false;
        if (filter === 'overdue' && (task.is_completed || !date || date >= today)) return false;
        if (filter === 'today' && (task.is_completed || date !== today)) return false;
        if (filter === 'this_week' && (task.is_completed || !date || !isWithinWeek(date, today))) return false;
        if (filter === 'completed' && !task.is_completed) return false;
        if (!q) return true;
        return [task.title, task.description ?? '', taskLinkLabel(task)]
          .some((value) => value.toLowerCase().includes(q));
      })
      .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));
  }, [allTasks, filter, search, selectedDate, today]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>();
    for (const task of allTasks) {
      const { date } = dueParts(task);
      if (!date) continue;
      const existing = map.get(date) ?? [];
      existing.push(task);
      map.set(date, existing);
    }
    return map;
  }, [allTasks]);

  const stats = {
    doneToday: allTasks.filter((task) => task.is_completed && task.completed_at?.slice(0, 10) === today).length,
    openWeek: counts.this_week,
    urgent: allTasks.filter((task) => !task.is_completed && taskPriority(task) === 'haute').length,
  };

  return (
    <div className="lv-agenda lv-page agenda-react-page">
      <div className="agenda-react-content">
        <header className="agenda-react-titlebar">
          <div>
            <h1 className="lv-title">Tâches</h1>
            <p>Toutes les actions créées depuis les biens, contacts et deals.</p>
          </div>
          <div className="agenda-search">
            <Search size={15} />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher une tâche..." />
          </div>
        </header>

        {taskState.error && (
          <div className="contact-action-message">{taskState.error}</div>
        )}

        <section className="agenda-kpis">
          <AgendaKpi label="En retard" value={counts.overdue} tone="danger" />
          <AgendaKpi label="Aujourd'hui" value={counts.today} tone="success" />
          <AgendaKpi label="Semaine" value={counts.this_week} tone="warning" />
          <AgendaKpi label="Urgentes" value={stats.urgent} tone="neutral" />
        </section>

        <section className="agenda-create-card">
          <button type="button" className="agenda-create-main" onClick={() => setCreateOpen(true)}>
            <Plus size={15} />
            <span>Ajouter une tâche manuelle...</span>
          </button>
          <button type="button" onClick={() => setCreateOpen(true)}>Ajouter</button>
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
              <span>{visibleTasks.length} tâches affichées{selectedDate ? ` - ${formatDateLabel(selectedDate, today)}` : ''}</span>
              <span>{stats.doneToday} terminées aujourd'hui</span>
            </div>

            <div className="agenda-task-list">
              {taskState.isLoading ? (
                <div className="agenda-empty"><Loader2 size={16} className="animate-spin" /> Chargement des tâches...</div>
              ) : visibleTasks.length === 0 ? (
                <div className="agenda-empty">Aucune tâche dans cette vue.</div>
              ) : visibleTasks.map(task => (
                <AgendaTaskRow
                  key={task.id}
                  task={task}
                  today={today}
                  taskState={taskState}
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
                              <i key={task.id} className={`${getTaskKind(task)} ${task.is_completed ? 'completed' : ''}`} />
                            ))}
                          </span>
                          <span className="agenda-month-tooltip">
                            <strong>{dayTasks.length} action{dayTasks.length > 1 ? 's' : ''} le {formatDateLabel(cell.date, today)}</strong>
                            {dayTasks.slice(0, 5).map(task => {
                              const { time } = dueParts(task);
                              return (
                                <span key={task.id} className={`agenda-month-tooltip-task ${task.is_completed ? 'completed' : ''}`}>
                                  <i className={getTaskKind(task)} />
                                  <em>{task.title}</em>
                                  <small>{time}</small>
                                </span>
                              );
                            })}
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
              {selectedDate && <button type="button" onClick={() => setSelectedDate(null)}>Tout voir</button>}
            </div>

            <div className="agenda-calendar-list">
              {(tasksByDate.get(selectedDate ?? today) ?? []).slice(0, 5).map(task => {
                const { date, time } = dueParts(task);
                return (
                  <button key={task.id} type="button" onClick={() => setSelectedDate(date)}>
                    <span>{time}</span>
                    <strong>{task.title}</strong>
                  </button>
                );
              })}
              {(tasksByDate.get(selectedDate ?? today) ?? []).length === 0 && <p>Aucune action ce jour.</p>}
            </div>
          </aside>
        </main>
      </div>

      {createOpen && (
        <TaskModal
          onClose={() => setCreateOpen(false)}
          onCreate={async (input) => {
            await taskState.createTask(input);
            const createdDate = input.due_date ? dueParts({ due_date: input.due_date } as TaskWithRelations).date : '';
            if (createdDate === today) setFilter('today');
            else if (createdDate && isWithinWeek(createdDate, today)) setFilter('this_week');
            else setFilter('all');
            setCreateOpen(false);
          }}
        />
      )}
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

function AgendaTaskRow({ task, today, taskState }: { task: TaskWithRelations; today: string; taskState: UseTasksResult }) {
  const { date, time } = dueParts(task);
  const late = !task.is_completed && date < today;
  const hasLink = Boolean(task.deal_id || task.property_id || task.contact_id);
  const priority = taskPriority(task);

  const updateDue = (nextDate: string, nextTime: string) => {
    void taskState.updateTask(task.id, { due_date: dueDateIso(nextDate, nextTime) });
  };

  return (
    <article className={`agenda-task-row ${task.is_completed ? 'done' : ''} ${late ? 'late' : ''}`}>
      <button type="button" className="agenda-check" onClick={() => { void taskState.toggleTask(task.id); }} aria-label="Marquer terminée">
        {task.is_completed && <Check size={12} />}
      </button>
      <div className="agenda-task-main">
        <div className="agenda-task-title-line">
          <strong>{task.title}</strong>
          <StatusBadge tone={late ? 'danger' : priorityTone(priority)}>
            {late ? 'Retard' : priority}
          </StatusBadge>
        </div>
        <div className="agenda-task-meta">
          <Clock size={13} />
          <span>{formatDateLabel(date, today)} à {time}</span>
          <span>-</span>
          <button type="button" disabled={!hasLink} onClick={() => openLinkedObject(task)}>
            {taskLinkLabel(task)}
            {hasLink && <ExternalLink size={12} />}
          </button>
        </div>
      </div>
      <div className="agenda-task-edit">
        <input type="date" value={date} onChange={event => updateDue(event.target.value, time)} />
        <input type="time" value={time} onChange={event => updateDue(date || today, event.target.value)} />
      </div>
    </article>
  );
}

function TaskModal({ onClose, onCreate }: { onClose: () => void; onCreate: (input: { title: string; description?: string | null; due_date?: string | null; priority?: TaskPriority; deal_id?: string | null; property_id?: string | null; contact_id?: string | null }) => Promise<void> }) {
  const dealsState = useDeals();
  const contactsState = useContacts();
  const [properties, setProperties] = useState<Array<{ id: string; label: string }>>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(toLocalIso());
  const [time, setTime] = useState('09:00');
  const [priority, setPriority] = useState<TaskPriority>('moyenne');
  const [linkKind, setLinkKind] = useState<LinkKind>('none');
  const [linkId, setLinkId] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchSupabaseProperties()
      .then((items) => {
        if (!active) return;
        setProperties(items.filter((property) => property.supabasePropertyId).map((property) => ({
          id: property.supabasePropertyId as string,
          label: `${property.title} - ${property.city}`,
        })));
      })
      .catch(() => {
        if (active) setProperties([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const linkOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const options =
      linkKind === 'deal'
        ? dealsState.deals.map((deal) => ({ id: deal.id, label: `${deal.reference ?? 'DEAL'} - ${deal.title ?? deal.property?.locality ?? 'Deal'}` }))
        : linkKind === 'contact'
          ? contactsState.contacts.map((contact) => ({ id: contact.id, label: `${contact.reference ?? 'CTC'} - ${contact.full_name}` }))
          : linkKind === 'property'
            ? properties
            : [];
    return q ? options.filter((option) => option.label.toLowerCase().includes(q)) : options;
  }, [contactsState.contacts, dealsState.deals, linkKind, properties, search]);

  useEffect(() => {
    setLinkId(linkOptions[0]?.id ?? '');
  }, [linkKind, linkOptions]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Le titre est obligatoire.');
      return;
    }

    try {
      setError('');
      await onCreate({
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDateIso(date, time),
        priority,
        deal_id: linkKind === 'deal' ? linkId || null : null,
        property_id: linkKind === 'property' ? linkId || null : null,
        contact_id: linkKind === 'contact' ? linkId || null : null,
      });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Création impossible.');
    }
  };

  return (
    <div className="contact-modal-backdrop" role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="contact-modal">
        <div className="section-head">
          <strong>Nouvelle tâche</strong>
          <button type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="contact-modal-grid">
          <label className="contact-modal-field-wide">Titre<input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus /></label>
          <label className="contact-modal-field-wide">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label>
          <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label>Heure<input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
          <label>Priorité<select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}><option value="basse">Basse</option><option value="moyenne">Moyenne</option><option value="haute">Haute</option></select></label>
          <label>Lien<select value={linkKind} onChange={(event) => setLinkKind(event.target.value as LinkKind)}><option value="none">Aucun</option><option value="deal">Deal</option><option value="property">Bien</option><option value="contact">Contact</option></select></label>
          {linkKind !== 'none' && (
            <>
              <label className="contact-modal-field-wide">Rechercher<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un objet..." /></label>
              <label className="contact-modal-field-wide">Objet<select value={linkId} onChange={(event) => setLinkId(event.target.value)}>{linkOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
            </>
          )}
        </div>
        {error && <div className="contact-action-message">{error}</div>}
        <div className="contact-modal-actions">
          <button className="panel-action" type="button" onClick={onClose}>Annuler</button>
          <button className="add-contact-link" type="button" onClick={handleSubmit}>Créer</button>
        </div>
      </div>
    </div>
  );
}
