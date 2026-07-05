export type ID = string;
export type ISODate = string;
export type ISODateTime = string;

export interface Agency {
  id: ID;
  name: string;
  org: string;
}

export type UserRole = 'admin' | 'agent';

export interface Agent {
  id: ID;
  name: string;
  role: UserRole;
  avatar: string;
  status: string;
}

export interface PriceHistory {
  date: ISODate;
  price: number;
}

export type PropertyTag = 'FSBO' | 'Baisse de prix' | 'Republié' | 'Coup de cœur' | 'Nouveau';
export type PropertySource = 'Immoweb' | 'Zimmo' | 'Immovlan' | 'Biddit' | string;
export type FloodZone = 'Sûre' | 'Faible' | 'Moyenne' | 'Élevée';
export type PropertyInternalStatus = 'disponible' | 'réservé' | 'archivé';

export interface Property {
  id: number;
  supabasePropertyId?: ID;
  supabaseListingId?: ID;
  title: string;
  propertyType?: string;
  city: string;
  price: number;
  photos: string[];
  tag: PropertyTag | string;
  score: number;
  peb: string;
  surface: number;
  bedrooms: number;
  bathrooms: number;
  source: PropertySource;
  reserved: boolean;
  ownerId: ID | null;
  fsbo: boolean;
  publishedDays: number;
  floodZone: FloodZone;
  notes: string[];
  yieldEstimate: string;
  description: string;
  priceHistory: PriceHistory[];
  status?: PropertyInternalStatus;
}

export type SignalType = 'fsbo' | 'drop' | 'repub' | 'old' | 'high' | 'new';
export type SignalStatus = 'nouveau' | 'traité' | 'ignoré';

export interface PropertySignal {
  id: ID;
  type: SignalType;
  propertyId: number;
  heading: string;
  info: string;
  date: ISODate;
  time: string;
  value?: string;
  source?: PropertySource;
  status?: SignalStatus;
  ignoredByAgents: ID[];
}

export type ActivityType =
  | 'creation'
  | 'stage_change'
  | 'note'
  | 'task_done'
  | 'transfer'
  | 'signal'
  | 'status_change'
  | 'contact'
  | string;

export type ActivityEntityType = 'property' | 'contact' | 'deal' | 'task' | 'signal';

export interface Activity {
  id: ID;
  type: ActivityType;
  text: string;
  date: ISODate;
  agentId: ID;
  agentName: string;
  entityType?: ActivityEntityType;
  entityId?: string | number;
}

export type DealStage =
  | 'Nouveau'
  | 'Qualifié'
  | 'Contact'
  | 'Visite'
  | 'Proposition'
  | 'Mandat potentiel'
  | 'Mandat signé'
  | 'Bien vendu'
  | 'Perdu'
  | string;

export type CommissionStatus = 'brouillon' | 'prévue' | 'payable' | 'payée';

export interface Deal {
  id: ID;
  reference: string;
  propertyId: number;
  contactId: ID;
  ownerId: ID;
  stage: DealStage;
  activities: Activity[];
  notes: string[];
  tasks: ID[];
  commissionStatus: CommissionStatus;
  commissionAmount: number;
  title: string;
  price: number;
  activeTransferId?: ID | null;
}

export type ContactRole = 'vendeur' | 'acheteur' | 'prospect' | 'investisseur' | 'propriétaire';

export interface Contact {
  id: ID;
  reference: string;
  name: string;
  email: string;
  phone: string;
  roles: ContactRole[];
  notes: string[];
  assignedDeals: ID[];
  assignedProperties: number[];
}

export type TaskPriority = 'haute' | 'moyenne' | 'basse';

export interface Task {
  id: ID;
  title: string;
  date: ISODate;
  time: string;
  priority: TaskPriority;
  done: boolean;
  agentId: ID;
  propertyId?: number | null;
  dealId?: ID | null;
  contactId?: ID | null;
  place?: string;
}

export type TransferStatus = 'en_attente' | 'accepté' | 'refusé';

export interface TransferRequest {
  id: ID;
  propertyId: number;
  dealId: ID;
  fromAgentId: ID;
  toAgentId: ID;
  status: TransferStatus;
  date: ISODate;
}

export type NotificationType =
  | 'transfer_pending'
  | 'transfer_accepted'
  | 'transfer_refused'
  | 'task_due'
  | 'deal_moved'
  | 'property_reserved'
  | 'commission_ready'
  | string;

export interface Notification {
  id: ID;
  type: NotificationType;
  title: string;
  text: string;
  date: ISODate | ISODateTime | string;
  read: boolean;
  actionLink: string;
  agentId?: ID;
}

export interface Commission {
  id: ID;
  dealId: ID;
  agentId: ID;
  amount: number;
  status: CommissionStatus;
  date: ISODate;
  propertyTitle: string;
  agentName: string;
}

export interface UserPropertyMark {
  propertyId: number;
  agentId: ID;
  favorite: boolean;
  ignored: boolean;
}

export interface AuditLog {
  id: ID;
  timestamp: ISODateTime | string;
  action: string;
  agentName: string;
  details: string;
}

export interface PipelineStage {
  id: ID;
  name: DealStage;
  icon?: string;
  color?: string;
}

export interface PropertyRelations {
  property: Property;
  contact?: Contact;
  deal?: Deal;
  tasks: Task[];
  signals: PropertySignal[];
  activities: Activity[];
}

export interface DealRelations {
  deal: Deal;
  property?: Property;
  contact?: Contact;
  tasks: Task[];
  activities: Activity[];
}

export interface ContactRelations {
  contact: Contact;
  properties: Property[];
  deals: Deal[];
  tasks: Task[];
  activities: Activity[];
}
