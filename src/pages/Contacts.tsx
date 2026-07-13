import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Home,
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
import type { Contact, ContactRelations, Deal, Property, Task, TaskPriority } from '../types';
import { ActivityTimeline, NotesList, StatusBadge, TaskList, ContactsSkeleton } from '../components/ui';
import { useAuth } from '../lib/auth';
import { formatEuro } from '../lib/formatCurrency';
import { searchPropertiesForLink } from '../lib/supabaseProperties';
import { getContactsDataState, mapContactActivities } from '../lib/contactRuntime';
import { useContact, useContactActivities, useContacts } from '../lib/useContacts';
import { useNotes } from '../lib/useNotes';
import { taskToView, useTasks, useTasksFor } from '../lib/useTasks';
import {
  contactsService,
  type ContactFull,
  type ContactPropertyLink,
  type SupabaseContact,
  type SupabaseDeal,
} from '../lib/services/contactsService';

type RelationshipOption = 'owner' | 'interested' | 'former_owner' | 'tenant';

const CONTACT_ROLES = ['vendeur', 'acheteur', 'prospect', 'investisseur', 'proprietaire'];
const RELATIONSHIP_OPTIONS: { value: RelationshipOption; label: string }[] = [
  { value: 'interested', label: 'Interesse' },
  { value: 'owner', label: 'Proprietaire' },
  { value: 'former_owner', label: 'Ancien proprietaire' },
  { value: 'tenant', label: 'Locataire' },
];

function formatPrice(value: number) {
  return formatEuro(value);
}

function cleanText(value: string) {
  return value
    .replaceAll('ÃƒÂ©', 'e')
    .replaceAll('ÃƒÂ¨', 'e')
    .replaceAll('ÃƒÂª', 'e')
    .replaceAll('ÃƒÂ ', 'a')
    .replaceAll('ÃƒÂ®', 'i')
    .replaceAll('ÃƒÂ´', 'o')
    .replaceAll('ÃƒÂ§', 'c')
    .replaceAll('Ã¢â€šÂ¬', 'EUR');
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

  if (activeDeals > 0) return { label: 'Client actif', className: 'active' };
  if (openTasks > 0) return { label: 'A relancer', className: 'contacted' };
  if (relations.properties.length > 0) return { label: 'Proprietaire', className: 'new' };
  return { label: 'Nouveau', className: 'lead' };
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
  if (task) return { date: task.date, type: 'Tache planifiee' };
  return { date: '-', type: 'Aucune activite' };
}

function tomorrowIso() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

function contactToView(contact: SupabaseContact): Contact {
  return {
    id: contact.id,
    reference: contact.reference ?? 'CTC-...',
    name: contact.full_name,
    email: contact.email ?? 'Email a completer',
    phone: contact.phone ?? 'Telephone a completer',
    roles: (contact.roles.length > 0 ? contact.roles : ['prospect']) as Contact['roles'],
    notes: contact.notes ? [contact.notes] : [],
    assignedDeals: [],
    assignedProperties: [],
  };
}

function propertyLinkToProperty(link: ContactPropertyLink): Property {
  const listing = link.currentListing;
  const property = link.property;
  const title = listing?.title_fr ?? listing?.title_nl ?? link.address;

  return {
    id: link.property_id,
    supabasePropertyId: link.property_id,
    title,
    propertyType: property?.property_subtype ?? property?.property_type ?? 'Bien',
    city: link.city,
    price: link.currentPrice ?? 0,
    photos: link.photos,
    tag: link.relationship,
    score: 0,
    peb: 'N/A',
    surface: property?.living_area ?? property?.land_area ?? 0,
    bedrooms: property?.bedroom_count ?? 0,
    bathrooms: property?.bathroom_count ?? 0,
    source: listing?.source ?? 'Supabase',
    reserved: listing?.status !== 'active',
    ownerId: null,
    fsbo: Boolean(listing?.is_fsbo),
    publishedDays: 0,
    floodZone: 'Faible',
    notes: [],
    yieldEstimate: listing?.ai_gross_yield ? `${Number(listing.ai_gross_yield).toFixed(1)}%` : 'N/A',
    description: listing?.description_fr ?? listing?.description_nl ?? '',
    priceHistory: [{ date: (listing?.last_seen_at ?? new Date().toISOString()).slice(0, 10), price: link.currentPrice ?? 0 }],
    status: listing?.status === 'active' ? 'disponible' : 'archivé',
  };
}

function dealToView(deal: SupabaseDeal): Deal {
  return {
    id: deal.id,
    reference: deal.reference ?? 'DEAL-...',
    propertyId: deal.property_id,
    contactId: deal.contact_id ?? '',
    ownerId: deal.owner_id,
    stage: deal.is_lost ? 'Perdu' : deal.is_won ? 'Bien vendu' : 'Nouveau',
    activities: [],
    notes: deal.notes ? [deal.notes] : [],
    tasks: [],
    commissionStatus: 'brouillon',
    commissionAmount: deal.estimated_commission ?? 0,
    title: deal.title ?? deal.reference ?? 'Deal',
    price: 0,
  };
}

function contactFullToRelations(
  contact: ContactFull | SupabaseContact,
  contactTasks: Task[] = [],
  listActivities: ContactRelations['activities'] = [],
): ContactRelations {
  const fullContact = 'properties' in contact ? contact : null;

  return {
    contact: contactToView(contact),
    properties: fullContact?.properties.map(propertyLinkToProperty) ?? [],
    deals: fullContact?.deals.map(dealToView) ?? [],
    tasks: contactTasks,
    activities: fullContact
      ? mapContactActivities(fullContact.activities, contact.id, contact.agency_id)
      : listActivities,
  };
}

export function Contacts() {
  const { profile } = useAuth();
  const {
    contacts: supabaseContacts,
    isLoading,
    error,
    search,
    setSearch,
    createContact,
    deleteContact,
    refresh,
  } = useContacts();
  const contactActivities = useContactActivities(supabaseContacts);
  const contactsError = error ?? contactActivities.error;
  const contactsDataState = getContactsDataState(
    supabaseContacts,
    isLoading || contactActivities.isLoading,
    contactsError,
  );
  const allTasks = useTasks({ scope: 'all' });
  const [actionMessage, setActionMessage] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDate, setTaskDate] = useState(tomorrowIso);
  const [taskTime, setTaskTime] = useState('09:00');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('moyenne');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [linkPropertyModalOpen, setLinkPropertyModalOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const selectedContactDetails = useContact(selectedContactId);

  const contacts = useMemo(() => supabaseContacts.map(contactToView), [supabaseContacts]);
  const skeletonRowCount = Math.max(1, Math.min(contacts.length || 3, 6));
  const relationsById = useMemo(() => {
    const map = new Map<string, ContactRelations>();
    supabaseContacts.forEach((contact) => {
      map.set(contact.id, contactFullToRelations(
        contact,
        allTasks.tasks.filter((task) => task.contact_id === contact.id).map(taskToView),
        contactActivities.activitiesByContact[contact.id] ?? [],
      ));
    });
    return map;
  }, [allTasks.tasks, contactActivities.activitiesByContact, supabaseContacts]);

  const filteredContacts = contacts;
  const selectedContact = selectedContactDetails.contact
    ? contactToView(selectedContactDetails.contact)
    : selectedContactId
      ? contacts.find((contact) => contact.id === selectedContactId)
      : undefined;
  const selectedRelations = selectedContactDetails.contact
      ? contactFullToRelations(
        selectedContactDetails.contact,
        allTasks.tasks.filter((task) => task.contact_id === selectedContactDetails.contact?.id).map(taskToView),
      )
    : selectedContact
      ? relationsById.get(selectedContact.id)
      : undefined;

  const handleSelectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    setActionMessage('');
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setSelectedContactId(null);
    setActionMessage('');
  };

  const handleCreateTask = () => {
    if (!selectedContact || !taskTitle.trim()) {
      setActionMessage('Ajoute un titre de tache.');
      return;
    }

    void allTasks.createTask({
      title: taskTitle.trim(),
      due_date: new Date(`${taskDate}T${taskTime || '09:00'}:00`).toISOString(),
      priority: taskPriority,
      contact_id: selectedContact.id,
    })
      .then(() => {
        setTaskTitle('');
        setActionMessage('Tache creee depuis le contact.');
      })
      .catch((error: unknown) => {
        setActionMessage(error instanceof Error ? error.message : 'Creation de la tache impossible.');
      });
  };

  const handleMockAction = (kind: 'call' | 'email' | 'whatsapp') => {
    if (!selectedContact) return;
    const label = kind === 'call' ? 'Appel' : kind === 'email' ? 'Email' : 'WhatsApp';
    setActionMessage(`${label} pret pour ${cleanText(selectedContact.name)} (${selectedContact.phone}).`);
  };

  const handleCreateContact = async (input: {
    fullName: string;
    email: string;
    phone: string;
    roles: string[];
    source: string;
    initialNote: string;
  }) => {
    try {
      const created = await createContact({
        full_name: input.fullName,
        email: input.email,
        phone: input.phone,
        roles: input.roles,
        source: input.source,
        notes: input.initialNote,
      });
      setCreateModalOpen(false);
      setSelectedContactId(created.id);
      setActionMessage(`Contact ${created.reference ?? ''} cree.`);
    } catch (createError) {
      setActionMessage(createError instanceof Error ? createError.message : 'Creation du contact impossible.');
    }
  };

  const handlePropertyLinked = async () => {
    await selectedContactDetails.refresh();
    await refresh();
    setLinkPropertyModalOpen(false);
    setActionMessage('Bien lie au contact.');
  };

  const handleDeleteContact = async () => {
    if (!selectedContact) return;
    try {
      await deleteContact(selectedContact.id);
      setSelectedContactId(null);
      setActionMessage('Contact supprime.');
    } catch (deleteError) {
      setActionMessage(deleteError instanceof Error ? deleteError.message : 'Suppression impossible.');
    }
  };

  return (
    <main className={`lv-contacts lv-page contacts-page ${selectedRelations ? 'has-panel' : 'is-panel-closed'}`}>
      <header className="contacts-head" style={{ gridTemplateColumns: '1fr' }}>
        <div className="contacts-title">
          <h1 className="lv-title">Contacts</h1>
          <p>Gérez vos relations et suivez vos échanges.</p>
        </div>
      </header>

      <div className="lv-biens-toolbar" style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <div className="lv-biens-search" style={{ flex: 1, position: 'relative' }}>
          <Search
            size={15}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }}
          />
          <input
            className="lv-biens-search-input"
            type="search"
            placeholder="Rechercher un contact, email, téléphone ou référence..."
            aria-label="Rechercher des contacts"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            style={{
              width: '100%',
              height: 38,
              paddingLeft: 36,
              paddingRight: search ? 38 : 12,
              border: '1px solid var(--color-border-default)',
              borderRadius: 8,
              background: 'var(--color-bg-surface)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--notion-sans)',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {search && (
            <button
              type="button"
              aria-label="Effacer la recherche"
              onClick={() => handleSearchChange('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 26, height: 26, border: 0, borderRadius: 6, background: 'transparent', color: 'var(--color-text-tertiary)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <section className="contacts-body-grid">
        <div className="contacts-left">
          <div className="contacts-table-shell">
            <div className="table-count"><strong>{filteredContacts.length}</strong>&nbsp; contacts</div>
            {(contactsError || selectedContactDetails.error || actionMessage) && (
              <div className="contact-action-message">{contactsError ?? selectedContactDetails.error ?? actionMessage}</div>
            )}
            {contactsDataState === 'loading' && <ContactsSkeleton rowCount={skeletonRowCount} />}
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
                  {contactsDataState === 'empty' && (
                    <tr>
                      <td colSpan={10}><span className="muted-line">Aucun contact Supabase pour cette agence.</span></td>
                    </tr>
                  )}
                  {contactsDataState !== 'loading' && filteredContacts.map((contact) => {
                    const relations = relationsById.get(contact.id);
                    if (!relations) return null;
                    const status = contactStatus(relations);
                    const last = lastActivityLabel(relations);
                    const action = nextAction(relations.tasks);
                    const selected = selectedContact?.id === contact.id;

                    return (
                      <tr key={contact.id} className={selected ? 'selected' : ''} onClick={() => handleSelectContact(contact.id)}>
                        <td><span className={`check ${selected ? 'checked' : ''}`}>{selected && <Check size={11} />}</span></td>
                        <td>
                          <div className="contact-cell">
                            <div className="avatar-sm">{getInitials(contact.name)}</div>
                            <div>
                              <div className="contact-name">{cleanText(contact.name)}</div>
                              <div className="contact-role">{contact.reference} - {primaryRole(contact)}</div>
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
                            <span className="next-action">{action.title}<br /><span className="muted-line">{action.date} - {action.time}</span></span>
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
              <button className="add-contact-link" type="button" onClick={() => setCreateModalOpen(true)}>
                <Plus size={14} />
                Ajouter un contact
              </button>
              <div className="pager">Page <span className="page-num">1</span> sur 1 <ChevronLeft size={14} /><ChevronRight size={14} /></div>
            </footer>
          </div>
        </div>

        {selectedRelations && (
          <ContactPanel
            relations={selectedRelations}
            actionMessage={actionMessage}
            taskTitle={taskTitle}
            taskDate={taskDate}
            taskTime={taskTime}
            taskPriority={taskPriority}
            onClose={() => {
              setSelectedContactId(null);
              setActionMessage('');
            }}
            onMockAction={handleMockAction}
            onTaskTitleChange={setTaskTitle}
            onTaskDateChange={setTaskDate}
            onTaskTimeChange={setTaskTime}
            onTaskPriorityChange={setTaskPriority}
            onCreateTask={handleCreateTask}
            onToggleTask={(taskId) => { void allTasks.toggleTask(taskId); }}
            onOpenLinkProperty={() => setLinkPropertyModalOpen(true)}
            canDelete={profile?.role === 'admin' || selectedContactDetails.contact?.owner_id === profile?.id}
            onDelete={handleDeleteContact}
          />
        )}
      </section>

      {createModalOpen && (
        <CreateContactModal
          onClose={() => setCreateModalOpen(false)}
          onCreate={handleCreateContact}
        />
      )}

      {linkPropertyModalOpen && selectedContact && (
        <LinkPropertyModal
          contactId={selectedContact.id}
          onClose={() => setLinkPropertyModalOpen(false)}
          onLinked={handlePropertyLinked}
        />
      )}
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
  canDelete: boolean;
  onClose: () => void;
  onMockAction: (kind: 'call' | 'email' | 'whatsapp') => void;
  onTaskTitleChange: (value: string) => void;
  onTaskDateChange: (value: string) => void;
  onTaskTimeChange: (value: string) => void;
  onTaskPriorityChange: (value: TaskPriority) => void;
  onCreateTask: () => void;
  onToggleTask: (taskId: string) => void;
  onOpenLinkProperty: () => void;
  onDelete: () => void;
}

function ContactPanel({
  relations,
  actionMessage,
  taskTitle,
  taskDate,
  taskTime,
  taskPriority,
  canDelete,
  onClose,
  onMockAction,
  onTaskTitleChange,
  onTaskDateChange,
  onTaskTimeChange,
  onTaskPriorityChange,
  onCreateTask,
  onToggleTask,
  onOpenLinkProperty,
  onDelete,
}: ContactPanelProps) {
  const { contact, properties, deals, tasks, activities } = relations;
  const status = contactStatus(relations);
  const primaryProperty = properties[0];
  const visits = deals.filter((deal) => ['Visite', 'Proposition', 'Mandat potentiel', 'Mandat signe'].includes(cleanText(deal.stage))).length;
  const offers = deals.filter((deal) => ['Proposition', 'Mandat potentiel', 'Mandat signe'].includes(cleanText(deal.stage))).length;
  const notes = useNotes({ contactId: contact.id });
  const [noteDraft, setNoteDraft] = useState('');

  const handleCreateNote = async () => {
    if (!noteDraft.trim()) return;
    await notes.createNote(noteDraft);
    setNoteDraft('');
  };

  return (
    <aside className="contact-panel">
      <div className="panel-top">
        <div className="avatar-lg">{getInitials(contact.name)}</div>
        <div>
          <div className="panel-name">{cleanText(contact.name)}</div>
          <div className="panel-role">{contact.reference} - {roleLabel(contact)}</div>
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
        {canDelete && <button className="panel-action" type="button" onClick={onDelete}>Supprimer</button>}
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
          <InfoLine icon={<MapPin size={14} />} value={primaryProperty ? `${primaryProperty.title}, ${primaryProperty.city}` : 'Adresse a completer'} />
          <InfoLine icon={<Home size={14} />} value={roleLabel(contact)} />
          <InfoLine icon={<UserRound size={14} />} value="Contact suivi dans Supabase" />
        </div>
      </section>

      <section className="panel-section">
        <div className="section-head"><strong>Biens lies</strong><button type="button" onClick={onOpenLinkProperty}>+ Lier un bien</button></div>
        <div className="contact-linked-stack">
          {properties.length === 0 && deals.length === 0 && <p className="contact-empty-line">Aucun bien ou deal lie.</p>}
          {properties.slice(0, 3).map((property) => <PropertyLink key={property.id} property={property} />)}
          {deals.slice(0, 2).map((deal) => <DealLink key={deal.id} deal={deal} />)}
        </div>
      </section>

      <section className="panel-section">
        <div className="section-head"><strong>Creer une tache</strong><button type="button" onClick={onCreateTask}>Ajouter</button></div>
        <div className="contact-task-form">
          <input value={taskTitle} onChange={(event) => onTaskTitleChange(event.target.value)} placeholder="Ex: Relancer apres estimation" />
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
        <div className="section-head"><strong>Taches</strong><a href="#agenda">Agenda</a></div>
        <TaskList tasks={tasks} compact onToggleTask={onToggleTask} getMeta={(task) => `${task.date} - ${task.time}`} emptyTitle="Aucune tache contact" />
      </section>

      <section className="panel-section">
        <div className="section-head"><strong>Activite recente</strong><a href="#pipeline">Voir tout</a></div>
        <ActivityTimeline activities={activities} compact limit={5} emptyTitle="Aucune activite contact" />
      </section>

      <section className="panel-section">
        <div className="section-head"><strong>Notes</strong><button type="button" onClick={handleCreateNote}>Ajouter</button></div>
        <div className="contact-task-form" style={{ gridTemplateColumns: '1fr auto' }}>
          <input value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Ajouter une note..." />
          <button className="panel-action" type="button" onClick={handleCreateNote}>OK</button>
        </div>
        {notes.error && <div className="contact-action-message">{notes.error}</div>}
        <div className="note-box">
          <NotesList
            notes={notes.notes}
            isLoading={notes.isLoading}
            canEditNote={notes.canEditNote}
            onUpdate={notes.updateNote}
            onDelete={notes.deleteNote}
            compact
            emptyText="Aucune note pour ce contact."
          />
        </div>
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
  const relationship = property.tag ? cleanText(String(property.tag)) : 'interested';

  return (
    <button className="linked-card linked-card-button" type="button" onClick={() => { window.location.hash = `#biens?propertyId=${encodeURIComponent(String(property.id))}`; }}>
      <div className="thumb">{property.photos[0] && <img src={property.photos[0]} alt="" />}</div>
      <div>
        <div className="linked-title">Bien lie - {relationship}</div>
        <div className="linked-meta">{cleanText(property.title)}<br />{property.city}<br /><strong>{formatPrice(property.price)}</strong></div>
      </div>
      <StatusBadge tone={property.reserved ? 'warning' : 'success'}>{property.reserved ? 'Reserve' : 'Disponible'}</StatusBadge>
    </button>
  );
}

function DealLink({ deal }: { deal: Deal }) {
  return (
    <button className="linked-card linked-card-button" type="button" onClick={() => { window.location.hash = `#pipeline?deal=${encodeURIComponent(deal.reference)}`; }}>
      <div className="thumb deal-thumb"><Home size={23} /></div>
      <div>
        <div className="linked-title">Deal lie</div>
        <div className="linked-meta">{deal.reference} - {cleanText(deal.title)}<br />{cleanText(deal.stage)}</div>
      </div>
      <ExternalLink size={15} />
    </button>
  );
}

interface CreateContactModalProps {
  onClose: () => void;
  onCreate: (input: {
    fullName: string;
    email: string;
    phone: string;
    roles: string[];
    source: string;
    initialNote: string;
  }) => Promise<void>;
}

function CreateContactModal({ onClose, onCreate }: CreateContactModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roles, setRoles] = useState<string[]>(['prospect']);
  const [source, setSource] = useState('');
  const [initialNote, setInitialNote] = useState('');
  const [error, setError] = useState('');

  const toggleRole = (role: string) => {
    setRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
  };

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      setError('Le nom complet est obligatoire.');
      return;
    }

    try {
      setError('');
      await onCreate({ fullName, email, phone, roles, source, initialNote });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Creation impossible.');
    }
  };

  return (
    <div className="contact-modal-backdrop" role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="contact-modal">
        <div className="section-head">
          <strong>Ajouter un contact</strong>
          <button type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="contact-modal-grid">
          <label>Nom complet<input value={fullName} onChange={(event) => setFullName(event.target.value)} autoFocus /></label>
          <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" /></label>
          <label>Telephone<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
          <label>Source<input value={source} onChange={(event) => setSource(event.target.value)} /></label>
          <div className="contact-modal-field-wide">
            <span>Roles</span>
            <div className="contact-role-chips">
              {CONTACT_ROLES.map((role) => (
                <button key={role} className={`filter-pill ${roles.includes(role) ? 'active' : ''}`} type="button" onClick={() => toggleRole(role)}>
                  {role}
                </button>
              ))}
            </div>
          </div>
          <label className="contact-modal-field-wide">Note initiale<textarea value={initialNote} onChange={(event) => setInitialNote(event.target.value)} rows={3} /></label>
        </div>
        {error && <div className="contact-action-message">{error}</div>}
        <div className="contact-modal-actions">
          <button className="panel-action" type="button" onClick={onClose}>Annuler</button>
          <button className="add-contact-link" type="button" onClick={handleSubmit}>Creer</button>
        </div>
      </div>
    </div>
  );
}

interface LinkPropertyModalProps {
  contactId: string;
  onClose: () => void;
  onLinked: () => Promise<void>;
}

function LinkPropertyModal({ contactId, onClose, onLinked }: LinkPropertyModalProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [relationship, setRelationship] = useState<RelationshipOption>('interested');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setProperties([]);
      setSelectedPropertyId('');
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError('');

    async function loadProperties() {
      try {
        const nextProperties = await searchPropertiesForLink(query);
        if (!active) return;
        const linkableProperties = nextProperties.filter((property) => property.supabasePropertyId);
        setProperties(linkableProperties);
        setSelectedPropertyId(linkableProperties[0]?.supabasePropertyId ?? '');
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Chargement des biens impossible.');
      } finally {
        if (active) setIsLoading(false);
      }
    }

    const timeout = window.setTimeout(() => { void loadProperties(); }, 300);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [search]);

  const filteredProperties = properties;

  const handleLink = async () => {
    if (!selectedPropertyId) {
      setError('Selectionne un bien.');
      return;
    }

    try {
      setError('');
      await contactsService.linkPropertyToContact(contactId, selectedPropertyId, relationship);
      await onLinked();
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : 'Liaison impossible.');
    }
  };

  return (
    <div className="contact-modal-backdrop" role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="contact-modal">
        <div className="section-head">
          <strong>Lier un bien</strong>
          <button type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="contact-modal-grid">
          <label className="contact-modal-field-wide">Rechercher<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Adresse, ville..." /></label>
          <label className="contact-modal-field-wide">
            Bien
            <select value={selectedPropertyId} onChange={(event) => setSelectedPropertyId(event.target.value)}>
              {filteredProperties.map((property) => (
                <option key={property.supabasePropertyId} value={property.supabasePropertyId}>{property.title} - {property.city}</option>
              ))}
            </select>
          </label>
          <label>
            Relation
            <select value={relationship} onChange={(event) => setRelationship(event.target.value as RelationshipOption)}>
              {RELATIONSHIP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        {isLoading && <div className="contact-empty-line">Chargement des biens...</div>}
        {error && <div className="contact-action-message">{error}</div>}
        <div className="contact-modal-actions">
          <button className="panel-action" type="button" onClick={onClose}>Annuler</button>
          <button className="add-contact-link" type="button" onClick={handleLink}>Lier</button>
        </div>
      </div>
    </div>
  );
}
