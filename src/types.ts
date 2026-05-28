export interface Agency {
  id: string;
  name: string;
  org: string;
}

export type UserRole = 'admin' | 'agent';

export interface Agent {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  status: string;
}

export interface PriceHistory {
  date: string;
  price: number;
}

export interface Property {
  id: number;
  title: string;
  city: string;
  price: number;
  photos: string[];
  tag: string; // 'FSBO' | 'Baisse de prix' | 'Republié' | 'Coup de cœur' | 'Nouveau'
  score: number;
  peb: string;
  surface: number;
  bedrooms: number;
  bathrooms: number;
  source: string;
  reserved: boolean;
  ownerId: string | null; // Agent ID if reserved
  fsbo: boolean;
  publishedDays: number;
  floodZone: 'Sûre' | 'Faible' | 'Moyenne' | 'Élevée';
  notes: string[];
  yieldEstimate: string;
  description: string;
  priceHistory: PriceHistory[];
}

export interface PropertySignal {
  id: string;
  type: 'fsbo' | 'drop' | 'repub' | 'old' | 'high' | 'new';
  propertyId: number;
  heading: string;
  info: string;
  date: string;
  time: string;
  value?: string;
  source?: string;
  ignoredByAgents: string[]; // Agent IDs who ignored this signal
}

export interface Activity {
  id: string;
  type: string; // 'stage_change' | 'note' | 'task_done' | 'transfer' | 'creation'
  text: string;
  date: string;
  agentId: string;
  agentName: string;
}

export interface Deal {
  id: string;
  propertyId: number;
  contactId: string;
  ownerId: string; // Agent ID
  stage: string; // 'Nouveau' | 'Qualifié' | 'Contact' | 'Visite' | 'Proposition' | 'Mandat signé' | 'Bien vendu' | 'Perdu'
  activities: Activity[];
  notes: string[];
  tasks: string[]; // Task IDs linked
  commissionStatus: 'brouillon' | 'prévue' | 'payable' | 'payée';
  commissionAmount: number;
  title: string;
  price: number;
  activeTransferId?: string | null;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  roles: ('vendeur' | 'acheteur' | 'prospect' | 'investisseur' | 'propriétaire')[];
  notes: string[];
  assignedDeals: string[];
  assignedProperties: number[];
}

export interface Task {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string;
  priority: 'haute' | 'moyenne' | 'basse';
  done: boolean;
  agentId: string;
  propertyId?: number | null;
  dealId?: string | null;
  contactId?: string | null;
  place?: string;
}

export interface TransferRequest {
  id: string;
  propertyId: number;
  dealId: string;
  fromAgentId: string;
  toAgentId: string;
  status: 'en_attente' | 'accepté' | 'refusé';
  date: string;
}

export interface Notification {
  id: string;
  type: string; // 'transfer_pending' | 'transfer_accepted' | 'transfer_refused' | 'task_due' | 'deal_moved' | 'property_reserved' | 'commission_ready'
  title: string;
  text: string;
  date: string;
  read: boolean;
  actionLink: string; // e.g. '#pipeline?dealId=xxx'
}

export interface Commission {
  id: string;
  dealId: string;
  agentId: string;
  amount: number;
  status: 'brouillon' | 'prévue' | 'payable' | 'payée';
  date: string;
  propertyTitle: string;
  agentName: string;
}

export interface UserPropertyMark {
  propertyId: number;
  agentId: string;
  favorite: boolean;
  ignored: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  agentName: string;
  details: string;
}
