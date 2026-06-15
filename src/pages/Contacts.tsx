import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Filter,
  Grid2X2,
  Home,
  List,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Star,
  UserRound,
  X,
} from 'lucide-react';
import type { store as appStore } from '../lib/store';
import type { Contact, ContactRelations, Deal, Property, Task, TaskPriority } from '../types';
import { ActivityTimeline, PageIllustrationHeader, StatusBadge, TaskList } from '../components/ui';

type Store = typeof appStore;
type ContactFilter = 'all' | 'active' | 'prospect' | 'owner' | 'buyer';

interface ContactsProps {
  store: Store;
}

const moneyFormatter = new Intl.NumberFormat('fr-BE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

function formatPrice(value: number) {
  return moneyFormatter.format(value).replace(/\s?EUR/, ' EUR');
}

function cleanText(value: string) {
  return value
    .replaceAll('Ã©', 'é')
    .replaceAll('Ã¨', 'è')
    .replaceAll('Ãª', 'ê')
    .replaceAll('Ã ', 'à')
    .replaceAll('Ã®', 'î')
    .replaceAll('Ã´', 'ô')
    .replaceAll('Ã§', 'ç')
    .replaceAll('Ã‰', 'É')
    .replaceAll('â‚¬', '€');
}

function getInitials(name: string) {
  const parts = cleanText(name).replace(/[&.]/g, ' ').split(' ').filter(Boolean);
  if (parts.length === 0) return 'IP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function roleLabel(contact: Contact) {
  return contact.roles.map((role) => cleanText(role)).join(', ');
}

function primaryRole(contact: Contact) {
  return cleanText(contact.roles[0] ?? 'prospect');
}

function contactStatus(relations: ContactRelations) {
  const openTasks = relations.tasks.filter((task) => !task.done).length;
  const activeDeals = relations.deals.filter((deal) => !['Perdu', 'Bien vendu'].includes(deal.stage)).length;

  if (activeDeals > 0) return { label: 'Client actif', tone: 'success' as const, className: 'active' };
  if (openTasks > 0) return { label: 'A relancer', tone: 'warning' as const, className: 'contacted' };
  if (relations.properties.length > 0) return { label: 'Propriétaire', tone: 'info' as const, className: 'new' };
  return { label: 'Nouveau', tone: 'violet' as const, className: 'lead' };
}

function nextAction(tasks: Task[]) {
  return [...tasks]
    .filter((task) => !task.done)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];
}

function lastActivityLabel(relations: ContactRelations) {
  const activity = relations.activities[0];
  if (activity) return { date: activity.date, type: cleanText(activity.text) };
  const task = nextAction(relations.tasks);
  if (task) return { date: task.date, type: 'Tâche planifiée' };
  return { date: '-', type: 'Aucune activité' };
}

function contactMatchesFilter(contact: Contact, relations: ContactRelations, filter: ContactFilter) {
  if (filter === 'all') return true;
  const roles = contact.roles.map((role) => cleanText(role).toLowerCase());
  if (filter === 'active') return relations.deals.length > 0 || relations.properties.length > 0;
  if (filter === 'prospect') return roles.includes('prospect');
  if (filter === 'owner') return roles.includes('propriétaire') || roles.includes('vendeur');
  if (filter === 'buyer') return roles.includes('acheteur') || roles.includes('investisseur');
  return true;
}

function tomorrowIso() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

function openContactHash(contactId: string) {
  window.location.hash = `#contacts?contactId=${encodeURIComponent(contactId)}`;
}

export function Contacts({ store }: ContactsProps) {
  const [, forceUpdate] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ContactFilter>('all');
  const [panelOpen, setPanelOpen] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDate, setTaskDate] = useState(tomorrowIso);
  const [taskTime, setTaskTime] = useState('09:00');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('moyenne');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    return params.get('contactId');
  });

  useEffect(() => {
    const refresh = () => forceUpdate((value) => value + 1);
    const syncSelectedContact = () => {
      const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
      const contactId = params.get('contactId');
      if (contactId) {
        setSelectedContactId(contactId);
        setPanelOpen(true);
      }
    };

    window.addEventListener('ip-state-changed', refresh);
    window.addEventListener('hashchange', syncSelectedContact);
    syncSelectedContact();
    return () => {
      window.removeEventListener('ip-state-changed', refresh);
      window.removeEventListener('hashchange', syncSelectedContact);
    };
  }, []);

  const contacts = store.getContacts();
  const relationsById = useMemo(() => {
    const map = new Map<string, ContactRelations>();
    contacts.forEach((contact) => {
      const relations = store.getContactRelations(contact.id);
      if (relations) map.set(contact.id, relations);
    });
    return map;
  }, [contacts, store]);

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      const relations = relationsById.get(contact.id);
      if (!relations || !contactMatchesFilter(contact, relations, filter)) return false;
      if (!query) return true;

      const propertyText = relations.properties.map((property) => `${property.title} ${property.city}`).join(' ');
      const dealText = relations.deals.map((deal) => `${deal.title} ${deal.stage}`).join(' ');
      return [
        contact.name,
        contact.email,
        contact.phone,
        roleLabel(contact),
        propertyText,
        dealText,
      ].some((value) => cleanText(value).toLowerCase().includes(query));
    });
  }, [contacts, filter, relationsById, search]);

  const selectedContact = selectedContactId ? store.getContact(selectedContactId) : filteredContacts[0] ?? contacts[0];
  const selectedRelations = selectedContact ? store.getContactRelations(selectedContact.id) : undefined;

  useEffect(() => {
    if (!selectedContactId && filteredContacts[0]) {
      setSelectedContactId(filteredContacts[0].id);
    }
  }, [filteredContacts, selectedContactId]);

  const handleSelectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    setPanelOpen(true);
    setActionMessage('');
    openContactHash(contactId);
  };

  const handleCreateTask = () => {
    if (!selectedContact || !taskTitle.trim()) {
      setActionMessage('Ajoute un titre de tâche.');
      return;
    }

    const firstDeal = selectedRelations?.deals[0];
    const firstProperty = selectedRelations?.properties[0];
    store.createManualTask({
      title: taskTitle.trim(),
      date: taskDate,
      time: taskTime,
      priority: taskPriority,
      contactId: selectedContact.id,
      dealId: firstDeal?.id ?? null,
      propertyId: firstProperty?.id ?? null,
      place: firstProperty?.city,
    });
    setTaskTitle('');
    setActionMessage('Tâche créée depuis le contact.');
  };

  const handleMockAction = (kind: 'call' | 'email' | 'whatsapp') => {
    if (!selectedContact) return;
    const label = kind === 'call' ? 'Appel' : kind === 'email' ? 'Email' : 'WhatsApp';
    setActionMessage(`${label} prêt pour ${cleanText(selectedContact.name)} (${selectedContact.phone}).`);
  };

  return (
    <main className={`contacts-page ${panelOpen && selectedRelations ? '' : 'is-panel-closed'}`}>
      <PageIllustrationHeader
        imageUrl="/contacts-header-illustration.png"
        height={150}
        padding="0"
        borderRadius={0}
        backgroundPosition="center 50%"
        backgroundSize="100% auto"
        className="contacts-hero-slot-react"
      />

      <header className="contacts-head">
        <div className="contacts-title">
          <h1>Contacts</h1>
          <p>Gérez vos relations et suivez vos échanges.</p>
        </div>

        <label className="contacts-search">
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Rechercher un contact..." />
        </label>

        <div className="contacts-view-toggle" aria-label="Mode d'affichage">
          <button type="button" title="Grille"><Grid2X2 size={15} /></button>
          <button type="button" className="active" title="Liste"><List size={15} /></button>
        </div>

        <div className="contacts-export" aria-label="Export">
          <button type="button" title="Exporter" onClick={() => setActionMessage('Export mock préparé.')}>
            <Download size={15} />
          </button>
          <button type="button" title="Options"><ChevronDown size={13} /></button>
        </div>
      </header>

      <section className="contacts-body-grid">
        <div className="contacts-left">
          <div className="filters-row">
            <div className="filters-active">
              <Filter size={15} />
              Filtres actifs
            </div>
            <select className="filter-pill" value={filter} onChange={(event) => setFilter(event.target.value as ContactFilter)}>
              <option value="all">Statut (Tous)</option>
              <option value="active">Clients actifs</option>
              <option value="prospect">Prospects</option>
              <option value="owner">Propriétaires / vendeurs</option>
              <option value="buyer">Acheteurs / investisseurs</option>
            </select>
            <button className="filter-pill" type="button">Source (Toutes)<ChevronDown size={13} /></button>
            <button className="filter-pill" type="button">Tag (Tous)<ChevronDown size={13} /></button>
            <button className="filter-pill" type="button">Propriétaire (Tous)<ChevronDown size={13} /></button>
            <button className="reset-link" type="button" onClick={() => { setFilter('all'); setSearch(''); }}>Réinitialiser</button>
            <button className="contacts-filter-square" type="button" title="Colonnes"><Grid2X2 size={16} /></button>
          </div>

          <div className="contacts-table-shell">
            <div className="table-count"><strong>{filteredContacts.length}</strong>&nbsp; contacts</div>
            <div className="table-scroll">
              <table className="contacts-table">
                <thead>
                  <tr>
                    <th style={{ width: 34 }}><span className="check" /></th>
                    <th>Contact</th>
                    <th>Téléphone</th>
                    <th>Email</th>
                    <th>Statut</th>
                    <th>Biens</th>
                    <th>Deals</th>
                    <th>Dernière activité</th>
                    <th>Prochaine action</th>
                    <th style={{ width: 38 }} />
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map((contact) => {
                    const relations = relationsById.get(contact.id);
                    if (!relations) return null;
                    const status = contactStatus(relations);
                    const last = lastActivityLabel(relations);
                    const action = nextAction(relations.tasks);
                    const selected = selectedContact?.id === contact.id && panelOpen;

                    return (
                      <tr key={contact.id} className={selected ? 'selected' : ''} onClick={() => handleSelectContact(contact.id)}>
                        <td><span className={`check ${selected ? 'checked' : ''}`}>{selected && <Check size={11} />}</span></td>
                        <td>
                          <div className="contact-cell">
                            <div className="avatar-sm">{getInitials(contact.name)}</div>
                            <div>
                              <div className="contact-name">{cleanText(contact.name)}</div>
                              <div className="contact-role">{primaryRole(contact)}</div>
                            </div>
                          </div>
                        </td>
                        <td>{contact.phone}</td>
                        <td>{contact.email}</td>
                        <td><span className={`status ${status.className}`}>{status.label}</span></td>
                        <td>{relations.properties.length}</td>
                        <td>{relations.deals.length}</td>
                        <td>{last.date}<br /><span className="muted-line">{last.type}</span></td>
                        <td>
                          {action ? (
                            <span className="next-action">{action.title}<br /><span className="muted-line">{action.date} · {action.time}</span></span>
                          ) : (
                            <span className="muted-line">Aucune</span>
                          )}
                        </td>
                        <td><MoreHorizontal size={16} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <footer className="table-footer">
              <button
                className="add-contact-link"
                type="button"
                onClick={() => setActionMessage('Création contact mock : formulaire complet à brancher plus tard.')}
              >
                <Plus size={14} />
                Ajouter un contact
              </button>
              <div className="pager">Page <span className="page-num">1</span> sur 1 <ChevronLeft size={14} /><ChevronRight size={14} /></div>
            </footer>
          </div>
        </div>

        {selectedRelations && panelOpen && (
          <ContactPanel
            relations={selectedRelations}
            actionMessage={actionMessage}
            taskTitle={taskTitle}
            taskDate={taskDate}
            taskTime={taskTime}
            taskPriority={taskPriority}
            onClose={() => setPanelOpen(false)}
            onMockAction={handleMockAction}
            onTaskTitleChange={setTaskTitle}
            onTaskDateChange={setTaskDate}
            onTaskTimeChange={setTaskTime}
            onTaskPriorityChange={setTaskPriority}
            onCreateTask={handleCreateTask}
            onToggleTask={(taskId) => store.toggleTask(taskId)}
          />
        )}
      </section>
    </main>
  );
}

interface ContactPanelProps {
  relations: ContactRelations;
  actionMessage: string;
  taskTitle: string;
  taskDate: string;
  taskTime: string;
  taskPriority: TaskPriority;
  onClose: () => void;
  onMockAction: (kind: 'call' | 'email' | 'whatsapp') => void;
  onTaskTitleChange: (value: string) => void;
  onTaskDateChange: (value: string) => void;
  onTaskTimeChange: (value: string) => void;
  onTaskPriorityChange: (value: TaskPriority) => void;
  onCreateTask: () => void;
  onToggleTask: (taskId: string) => void;
}

function ContactPanel({
  relations,
  actionMessage,
  taskTitle,
  taskDate,
  taskTime,
  taskPriority,
  onClose,
  onMockAction,
  onTaskTitleChange,
  onTaskDateChange,
  onTaskTimeChange,
  onTaskPriorityChange,
  onCreateTask,
  onToggleTask,
}: ContactPanelProps) {
  const { contact, properties, deals, tasks, activities } = relations;
  const status = contactStatus(relations);
  const primaryProperty = properties[0];
  const primaryDeal = deals[0];
  const visits = deals.filter((deal) => ['Visite', 'Proposition', 'Mandat potentiel', 'Mandat signé'].includes(cleanText(deal.stage))).length;
  const offers = deals.filter((deal) => ['Proposition', 'Mandat potentiel', 'Mandat signé'].includes(cleanText(deal.stage))).length;

  return (
    <aside className="contact-panel">
      <div className="panel-top">
        <div className="avatar-lg">{getInitials(contact.name)}</div>
        <div>
          <div className="panel-name">{cleanText(contact.name)}</div>
          <div className="panel-role">{roleLabel(contact)}</div>
        </div>
        <div className="panel-star">
          <Star size={19} />
          <div className="panel-badge">{status.label}</div>
        </div>
        <button className="close-btn" type="button" title="Fermer" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="panel-actions">
        <button className="panel-action" type="button" onClick={() => onMockAction('call')}><Phone size={13} />Appeler</button>
        <button className="panel-action" type="button" onClick={() => onMockAction('email')}><Mail size={13} />Email</button>
        <button className="panel-action" type="button" onClick={() => onMockAction('whatsapp')}><MessageCircle size={13} />WhatsApp</button>
        <button className="panel-action" type="button"><MoreHorizontal size={13} /></button>
      </div>

      {actionMessage && <div className="contact-action-message">{actionMessage}</div>}

      <div className="panel-stats">
        <div className="panel-stat">Biens<strong>{properties.length}</strong></div>
        <div className="panel-stat">Deals<strong>{deals.length}</strong></div>
        <div className="panel-stat">Visites<strong>{visits}</strong></div>
        <div className="panel-stat">Offres<strong>{offers}</strong></div>
      </div>

      <section className="panel-section">
        <div className="section-head"><strong>Informations</strong><button type="button">Modifier</button></div>
        <div className="info-list">
          <InfoLine icon={<Phone size={14} />} value={contact.phone} />
          <InfoLine icon={<Mail size={14} />} value={contact.email} />
          <InfoLine icon={<MapPin size={14} />} value={primaryProperty ? `${primaryProperty.title}, ${primaryProperty.city}` : 'Adresse à compléter'} />
          <InfoLine icon={<Home size={14} />} value={roleLabel(contact)} />
          <InfoLine icon={<UserRound size={14} />} value={`Contact suivi par ${relations.deals[0]?.ownerId ?? 'Thomas'}`} />
        </div>
      </section>

      <section className="panel-section">
        <div className="section-head"><strong>Liens</strong><a href="#biens">Voir tout</a></div>
        <div className="contact-linked-stack">
          {properties.length === 0 && deals.length === 0 && <p className="contact-empty-line">Aucun bien ou deal lié.</p>}
          {properties.slice(0, 2).map((property) => <PropertyLink key={property.id} property={property} />)}
          {deals.slice(0, 2).map((deal) => <DealLink key={deal.id} deal={deal} />)}
        </div>
      </section>

      <section className="panel-section">
        <div className="section-head"><strong>Créer une tâche</strong><button type="button" onClick={onCreateTask}>Ajouter</button></div>
        <div className="contact-task-form">
          <input value={taskTitle} onChange={(event) => onTaskTitleChange(event.target.value)} placeholder="Ex: Relancer après estimation" />
          <input type="date" value={taskDate} onChange={(event) => onTaskDateChange(event.target.value)} />
          <input type="time" value={taskTime} onChange={(event) => onTaskTimeChange(event.target.value)} />
          <select value={taskPriority} onChange={(event) => onTaskPriorityChange(event.target.value as TaskPriority)}>
            <option value="basse">Basse</option>
            <option value="moyenne">Moyenne</option>
            <option value="haute">Haute</option>
          </select>
        </div>
      </section>

      <section className="panel-section">
        <div className="section-head"><strong>Tâches</strong><a href="#agenda">Agenda</a></div>
        <TaskList tasks={tasks} compact onToggleTask={onToggleTask} getMeta={(task) => `${task.date} · ${task.time}`} emptyTitle="Aucune tâche contact" />
      </section>

      <section className="panel-section">
        <div className="section-head"><strong>Activité récente</strong><a href="#pipeline">Voir tout</a></div>
        <ActivityTimeline activities={activities} compact limit={5} emptyTitle="Aucune activité contact" />
      </section>

      <section className="panel-section">
        <div className="section-head"><strong>Notes</strong><button type="button">Voir tout</button></div>
        <div className="note-box">{contact.notes?.map(cleanText).join(' ') || 'Aucune note pour ce contact.'}</div>
      </section>
    </aside>
  );
}

function InfoLine({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <div className="info-line">
      {icon}
      <span>{cleanText(value)}</span>
    </div>
  );
}

function PropertyLink({ property }: { property: Property }) {
  return (
    <button className="linked-card linked-card-button" type="button" onClick={() => { window.location.hash = `#biens?propertyId=${property.id}`; }}>
      <div className="thumb">{property.photos[0] && <img src={property.photos[0]} alt="" />}</div>
      <div>
        <div className="linked-title">Bien lié</div>
        <div className="linked-meta">{cleanText(property.title)}<br />{property.city}<br /><strong>{formatPrice(property.price)}</strong></div>
      </div>
      <StatusBadge tone={property.reserved ? 'warning' : 'success'}>{property.reserved ? 'Réservé' : 'Disponible'}</StatusBadge>
    </button>
  );
}

function DealLink({ deal }: { deal: Deal }) {
  return (
    <button className="linked-card linked-card-button" type="button" onClick={() => { window.location.hash = `#pipeline?dealId=${encodeURIComponent(deal.id)}`; }}>
      <div className="thumb deal-thumb"><Home size={23} /></div>
      <div>
        <div className="linked-title">Deal lié</div>
        <div className="linked-meta">{cleanText(deal.title)}<br />{cleanText(deal.stage)}</div>
      </div>
      <ExternalLink size={15} />
    </button>
  );
}
