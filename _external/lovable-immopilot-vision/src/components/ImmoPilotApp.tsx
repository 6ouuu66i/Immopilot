import '../styles/immopilot.css';

import {
  Bath,
  BedDouble,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  ContactRound,
  Filter,
  Globe,
  Grid2X2,
  Heart,
  Home,
  LayoutGrid,
  List,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  Plus,
  Ruler,
  Search,
  SlidersHorizontal,
  Star,
  TrendingDown,
  UserRound,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

type Route = 'dashboard' | 'biens' | 'pipeline' | 'contacts';
type PropertyStatus = 'Disponible' | 'Reserve' | 'Archive';
type Stage = 'A analyser' | 'A contacter' | 'Contacte' | 'RDV' | 'Mandat potentiel';

interface PriceEvent { date: string; from?: number; to: number; label: string; delta?: string }
interface Listing { platform: string; ref: string; publishedAt: string }
interface Property {
  id: number;
  title: string;
  city: string;
  type: string;
  price: number;
  previousPrice: number;
  source: string;
  seller: 'Particulier' | 'Agence' | 'Notaire';
  score: number;
  status: PropertyStatus;
  nextAction: string;
  lastSeen: string;
  surface: number;
  bedrooms: number;
  daysOnline: number;
  signal: string;
  contactId?: string;
  image: string;
  photos?: string[];
  signals?: string[];
  primarySignal?: string;
  tag?: string;
  opportunityReason?: string;
  publishedDays?: number;
  fsbo?: boolean;
  bathrooms?: number;
  publishedAgo?: string;
  photosCount?: number;
  aiSummary?: string;
  tags?: string[];
  terrain?: number;
  garages?: number;
  year?: number;
  peb?: { rating: string; consumption: number };
  heating?: string;
  availability?: string;
  priceHistory?: PriceEvent[];
  marketPricePerM2?: number;
  marketGapPct?: number;
  marketAvgPricePerM2?: number;
  addressLine?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
  listings?: Listing[];
  sellerName?: string;
  sellerPhone?: string;
  sellerEmail?: string;
}

interface Deal {
  id: string;
  reference: string;
  title: string;
  propertyId: number;
  contactId: string;
  ownerId: string;
  stage: Stage;
  value: number;
  price: number;
  commission: number;
  commissionAmount: number;
  nextAction: string;
}

interface Agent {
  id: string;
  name: string;
  avatar: string;
}

interface Task {
  id: string;
  dealId: string;
  title: string;
  dueDate: string; // ISO
  status: 'open' | 'done';
}

interface Contact {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  status: string;
  properties: number[];
  deals: string[];
  lastActivity: string;
  nextAction: string;
}

const properties: Property[] = [
  {
    id: 101,
    title: 'Maison 3 facades avec jardin',
    city: 'Woluwe-Saint-Pierre',
    type: 'Maison',
    price: 545000,
    previousPrice: 575000,
    source: 'Immoweb',
    seller: 'Particulier',
    score: 87,
    status: 'Disponible',
    nextAction: 'Appeler le proprietaire',
    lastSeen: 'auj.',
    surface: 172,
    bedrooms: 4,
    bathrooms: 2,
    daysOnline: 68,
    publishedDays: 68,
    fsbo: true,
    signal: 'Baisse de prix',
    signals: ['Baisse -5%', 'Reprise photos', 'FSBO'],
    primarySignal: 'Baisse de prix -30k',
    opportunityReason: 'Vendeur ouvert a une estimation',
    contactId: 'ct-1',
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=900&q=80',
    photos: [
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=900&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900&q=80',
    ],
  },
  {
    id: 102,
    title: 'Appartement lumineux proche gare',
    city: 'Namur',
    type: 'Appartement',
    price: 285000,
    previousPrice: 285000,
    source: 'Zimmo',
    seller: 'Agence',
    score: 72,
    status: 'Disponible',
    nextAction: 'Verifier historique prix',
    lastSeen: '2 j',
    surface: 94,
    bedrooms: 2,
    bathrooms: 1,
    daysOnline: 21,
    publishedDays: 21,
    signal: 'Nouveau',
    signals: ['Nouveau', 'PEB C'],
    primarySignal: 'Nouveau bien',
    image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&q=80',
    photos: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&q=80',
    ],
  },
  {
    id: 103,
    title: 'Villa basse énergie',
    city: 'Lasne',
    type: 'Villa',
    price: 895000,
    previousPrice: 945000,
    source: 'Immoweb',
    seller: 'Particulier',
    score: 91,
    status: 'Disponible',
    nextAction: 'Preparer estimation',
    lastSeen: '1 j',
    surface: 210,
    bedrooms: 4,
    bathrooms: 2,
    daysOnline: 93,
    publishedDays: 93,
    fsbo: true,
    signal: 'FSBO ancien',
    signals: ['FSBO ancien', 'Baisse -50k', 'Photos vieillies'],
    primarySignal: 'FSBO 3 mois',
    opportunityReason: 'Deja en contact, mandat probable',
    contactId: 'ct-2',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=80',
    photos: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=80',
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=900&q=80',
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=900&q=80',
      'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=900&q=80',
    ],
    photosCount: 18,
    publishedAgo: 'il y a 2h',
    aiSummary: "Excellente villa récente basse énergie dans un quartier résidentiel prisé de Lasne. Très bon état général, PEB A et équipements modernes. Forte demande locative et potentiel de valorisation à moyen terme.",
    tags: ['Emplacement premium', 'PEB A', 'Maison récente', 'Jardin', 'Calme', 'Forte demande locative'],
    terrain: 1250,
    garages: 1,
    year: 2018,
    peb: { rating: 'A', consumption: 56 },
    heating: 'Pompe à chaleur',
    availability: "À l'acte",
    priceHistory: [
      { date: '18/01/2024', to: 945000, label: 'Mise en ligne' },
      { date: '02/03/2024', from: 945000, to: 920000, label: 'Republiée' },
      { date: '15/04/2024', from: 920000, to: 895000, label: '−2,7%', delta: '-2,7%' },
    ],
    marketPricePerM2: 4262,
    marketGapPct: 10.7,
    marketAvgPricePerM2: 3850,
    addressLine: 'Chemin du Try 14',
    postalCode: '1380',
    lat: 50.6688,
    lng: 4.4711,
    listings: [
      { platform: 'Zimmo', ref: 'ZIM12345678', publishedAt: '23/05/2024' },
      { platform: 'Immoweb', ref: 'IW-89234517', publishedAt: '24/05/2024' },
      { platform: 'Immovlan', ref: 'IV-558231', publishedAt: '25/05/2024' },
    ],
    sellerName: 'Jean Dupont',
    sellerPhone: '+32 475 12 34 56',
    sellerEmail: 'jean.dupont@email.be',
  },
  {
    id: 104,
    title: 'Terrain constructible centre village',
    city: 'Gembloux',
    type: 'Terrain',
    price: 168000,
    previousPrice: 178000,
    source: 'Biddit',
    seller: 'Notaire',
    score: 64,
    status: 'Reserve',
    nextAction: 'Surveiller remise en ligne',
    lastSeen: '6 j',
    surface: 820,
    bedrooms: 0,
    bathrooms: 0,
    daysOnline: 41,
    publishedDays: 41,
    signal: 'Surveillance',
    signals: ['Surveillance', 'Enchere notariale'],
    primarySignal: 'Enchere Biddit',
    image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900&q=80',
    photos: [
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900&q=80',
      'https://images.unsplash.com/photo-1501183638710-841dd1904471?w=900&q=80',
    ],
  },
];

const contacts: Contact[] = [
  {
    id: 'ct-1',
    name: 'Claire Martin',
    role: 'Proprietaire vendeur',
    phone: '+32 475 21 44 09',
    email: 'claire.martin@example.be',
    status: 'A relancer',
    properties: [101],
    deals: ['deal-1'],
    lastActivity: 'Email envoye hier',
    nextAction: 'Appel 10:30',
  },
  {
    id: 'ct-2',
    name: 'Thomas Lambert',
    role: 'Vendeur particulier',
    phone: '+32 486 88 10 33',
    email: 't.lambert@example.be',
    status: 'Client actif',
    properties: [103],
    deals: ['deal-2'],
    lastActivity: 'RDV confirme',
    nextAction: 'Estimation vendredi',
  },
  {
    id: 'ct-3',
    name: 'Sophie Dubois',
    role: 'Prospect acheteur',
    phone: '+32 477 12 62 18',
    email: 'sophie.dubois@example.be',
    status: 'Nouveau',
    properties: [],
    deals: [],
    lastActivity: 'Import CRM',
    nextAction: 'Qualifier budget',
  },
];

const agents: Agent[] = [
  { id: 'ag-1', name: 'Julien Vasseur', avatar: 'https://i.pravatar.cc/64?img=15' },
  { id: 'ag-2', name: 'Camille Petit', avatar: 'https://i.pravatar.cc/64?img=32' },
  { id: 'ag-3', name: 'Marc Dupont', avatar: 'https://i.pravatar.cc/64?img=12' },
];

const deals: Deal[] = [
  { id: 'deal-1', reference: 'DL-2401', title: 'Mandat Woluwe', propertyId: 101, contactId: 'ct-1', ownerId: 'ag-1', stage: 'A contacter', value: 545000, price: 545000, commission: 16350, commissionAmount: 16350, nextAction: 'Appel proprietaire' },
  { id: 'deal-2', reference: 'DL-2402', title: 'Villa Waterloo', propertyId: 103, contactId: 'ct-2', ownerId: 'ag-2', stage: 'RDV', value: 895000, price: 895000, commission: 26850, commissionAmount: 26850, nextAction: 'Envoyer estimation' },
  { id: 'deal-3', reference: 'DL-2403', title: 'Appartement Namur', propertyId: 102, contactId: 'ct-3', ownerId: 'ag-3', stage: 'A analyser', value: 285000, price: 285000, commission: 8550, commissionAmount: 8550, nextAction: 'Controle signaux' },
];

const today = new Date();
const iso = (offsetDays: number, hour = 10, minute = 0) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const tasks: Task[] = [
  { id: 't-1', dealId: 'deal-1', title: 'Appeler Claire', dueDate: iso(-2, 9, 30), status: 'open' },
  { id: 't-2', dealId: 'deal-1', title: 'Envoyer avis de valeur', dueDate: iso(1, 14), status: 'open' },
  { id: 'deal-2-t1', dealId: 'deal-2', title: 'Preparer estimation', dueDate: iso(0, 15), status: 'open' },
  { id: 'deal-3-t1', dealId: 'deal-3', title: 'Controle signaux marche', dueDate: iso(3, 11), status: 'open' },
  { id: 'deal-3-t2', dealId: 'deal-3', title: 'Verifier historique prix', dueDate: iso(5, 10), status: 'open' },
];

const stages: Stage[] = ['A analyser', 'A contacter', 'Contacte', 'RDV', 'Mandat potentiel'];

function money(value: number) {
  return new Intl.NumberFormat('fr-BE', { maximumFractionDigits: 0, style: 'currency', currency: 'EUR' })
    .format(value)
    .replace(/\s?EUR/, ' EUR');
}

export default function ImmoPilotApp() {
  const [route, setRoute] = useState<Route>('dashboard');
  const [selectedPropertyId, setSelectedPropertyId] = useState(properties[0].id);
  const [selectedDealId, setSelectedDealId] = useState(deals[0].id);
  const [selectedContactId, setSelectedContactId] = useState(contacts[0].id);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [propertyPanelOpen, setPropertyPanelOpen] = useState(true);
  const [dealPanelOpen, setDealPanelOpen] = useState(true);
  const [contactPanelOpen, setContactPanelOpen] = useState(true);
  const selectedProperty = properties.find((item) => item.id === selectedPropertyId) ?? properties[0];
  const selectedDeal = deals.find((item) => item.id === selectedDealId) ?? deals[0];
  const selectedContact = contacts.find((item) => item.id === selectedContactId) ?? contacts[0];

  const selectProperty = (id: number) => { setSelectedPropertyId(id); setPropertyPanelOpen(true); };
  const selectDeal = (id: string) => { setSelectedDealId(id); setDealPanelOpen(true); };
  const selectContact = (id: string) => { setSelectedContactId(id); setContactPanelOpen(true); };

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Building2 size={18} /></div>
          {!sidebarCollapsed && (
            <div>
              <strong>ImmoPilot</strong>
              <span>Prospection CRM</span>
            </div>
          )}
          <button
            className="sidebar-toggle"
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            title={sidebarCollapsed ? 'Deployer' : 'Reduire'}
            aria-label={sidebarCollapsed ? 'Deployer la sidebar' : 'Reduire la sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>
        <nav>
          <NavButton icon={Home} label="Tableau de bord" active={route === 'dashboard'} collapsed={sidebarCollapsed} onClick={() => setRoute('dashboard')} />
          <NavButton icon={Building2} label="Biens" active={route === 'biens'} collapsed={sidebarCollapsed} count={properties.length} onClick={() => setRoute('biens')} />
          <NavButton icon={BriefcaseBusiness} label="Opportunites" active={route === 'pipeline'} collapsed={sidebarCollapsed} count={deals.length} onClick={() => setRoute('pipeline')} />
          <NavButton icon={ContactRound} label="Contacts" active={route === 'contacts'} collapsed={sidebarCollapsed} count={contacts.length} onClick={() => setRoute('contacts')} />
        </nav>
        {!sidebarCollapsed && (
          <div className="saved-views">
            <span>Vues sauvegardees</span>
            <button>Baisses de prix</button>
            <button>Particuliers recents</button>
            <button>A rappeler aujourd'hui</button>
          </div>
        )}
        <div className="agent-card">
          <div className="avatar">AM</div>
          {!sidebarCollapsed && (
            <>
              <div>
                <strong>Agent Martin</strong>
                <span>Agence Bruxelles Est</span>
              </div>
              <span className="agent-status" title="En ligne" />
            </>
          )}
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <label className="global-search">
            <Search size={16} />
            <input placeholder="Rechercher bien, contact, opportunite..." />
            <span className="kbd">⌘K</span>
          </label>
          <span className="sync-pill">Sync · 8 min</span>
          <div className="topbar-divider" />
          <button className="icon-button" title="Notifications"><Bell size={17} /></button>
          <button className="primary-button"><Plus size={15} /> Nouveau</button>
        </header>
        {route === 'dashboard' && <Dashboard onOpenProperty={(id) => { selectProperty(id); setRoute('biens'); }} />}
        {route === 'biens' && <Biens selected={selectedProperty} onSelect={selectProperty} panelOpen={propertyPanelOpen} onClosePanel={() => setPropertyPanelOpen(false)} onOpenPanel={() => setPropertyPanelOpen(true)} />}
        {route === 'pipeline' && <Pipeline selected={selectedDeal} onSelect={selectDeal} panelOpen={dealPanelOpen} onClosePanel={() => setDealPanelOpen(false)} onOpenPanel={() => setDealPanelOpen(true)} />}
        {route === 'contacts' && <Contacts selected={selectedContact} onSelect={selectContact} panelOpen={contactPanelOpen} onClosePanel={() => setContactPanelOpen(false)} onOpenPanel={() => setContactPanelOpen(true)} />}
      </section>
    </div>
  );
}

function NavButton({ icon: Icon, label, active, count, collapsed, onClick }: { icon: typeof Home; label: string; active: boolean; count?: number; collapsed?: boolean; onClick: () => void }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''} ${collapsed ? 'nav-collapsed' : ''}`} type="button" onClick={onClick} title={collapsed ? label : undefined}>
      <Icon size={17} />
      {!collapsed && <span>{label}</span>}
      {!collapsed && count ? <em>{count}</em> : null}
    </button>
  );
}

function Dashboard({ onOpenProperty }: { onOpenProperty: (id: number) => void }) {
  const hot = properties.filter((item) => item.score >= 80);
  return (
    <main className="page dashboard-grid">
      <section className="page-title">
        <div>
          <h1>Tableau de bord</h1>
          <p>Bonjour, voici les opportunites et signaux a traiter aujourd'hui.</p>
        </div>
        <button className="secondary-button"><SlidersHorizontal size={15} /> Vue du jour</button>
      </section>
      <div className="meta-bar">
        <span className="live">Live</span>
        <span>Vendredi 3 juillet 2026</span>
        <span className="dot" />
        <span><b>4</b> nouveaux signaux depuis hier</span>
        <span className="dot" />
        <span><b>18</b> annonces scannees ce matin</span>
        <span className="dot" />
        <span>Derniere sync <b>08:42</b></span>
      </div>
      <section className="kpi-strip">
        <Kpi label="Opportunites chaudes" value={hot.length} delta="+2" deltaLabel="vs semaine -1" tone="good" spark={[3,4,3,5,4,6,7,8]} hint="7 j" />
        <Kpi label="Baisses de prix" value={2} delta="-30k€" deltaLabel="cumule 7 j" tone="risk" spark={[1,1,2,1,2,3,2,2]} hint="7 j" />
        <Kpi label="Taches dues" value={5} delta="3 avant midi" tone="watch" spark={[2,3,2,4,3,5,4,5]} hint="24 h" />
        <Kpi label="Particuliers FSBO" value={2} delta="+1 ce mois" tone="good" spark={[0,1,1,2,2,2,3,2]} hint="30 j" />
      </section>
      <div className="dashboard-split">
        <section className="panel dashboard-main">
          <div className="panel-head">
            <div>
              <h2>Priorites commerciales</h2>
              <p>Les biens avec signaux exploitables maintenant.</p>
            </div>
            <button className="ghost-button"><Filter size={14} /> Filtrer</button>
          </div>
          <div className="opportunity-table">
            {properties.map((property) => {
              const drop = property.previousPrice - property.price;
              const tone: 'risk' | 'watch' | 'good' = property.signal.includes('Baisse') ? 'risk' : property.signal.includes('FSBO') ? 'watch' : 'good';
              return (
                <button key={property.id} className="opportunity-row" onClick={() => onOpenProperty(property.id)}>
                  <img src={property.image} alt="" />
                  <span className="row-title">
                    <span className="row-title-line"><strong>{property.title}</strong><span className={`row-signal ${tone}`}>{property.signal}</span></span>
                    <small>{property.city} · {property.type} · {property.source}</small>
                  </span>
                  <span className="row-price"><b>{money(property.price)}</b>{drop > 0 ? <small>-{new Intl.NumberFormat('fr-BE').format(drop)} €</small> : null}</span>
                  <ScoreVerdict score={property.score} />
                  <span className="row-actions">
                    <button title="Appeler" onClick={(e) => e.stopPropagation()}><Phone size={13} /></button>
                    <button title="Email" onClick={(e) => e.stopPropagation()}><Mail size={13} /></button>
                    <button title="Plus" onClick={(e) => e.stopPropagation()}><MoreHorizontal size={13} /></button>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <aside className="dashboard-rail">
          <MiniPanel title="Taches du jour" count="5">
            <Task checked={false} label="Appeler Claire Martin" meta="10:30 · Woluwe" />
            <Task checked label="Verifier annonce Namur" meta="09:15 · Zimmo" />
            <Task checked={false} label="Envoyer estimation Waterloo" meta="15:00 · Villa" />
          </MiniPanel>
          <MiniPanel title="Signaux a surveiller" count="3">
            <Signal label="Baisse de prix" value="-30 000 EUR" tone="risk" />
            <Signal label="FSBO ancien" value="+90 jours" />
            <Signal label="Remise en ligne" value="2 sources" tone="watch" />
          </MiniPanel>
        </aside>
      </div>
    </main>
  );
}

function Biens({ selected, onSelect, panelOpen, onClosePanel, onOpenPanel }: { selected: Property; onSelect: (id: number) => void; panelOpen: boolean; onClosePanel: () => void; onOpenPanel: () => void }) {
  return (
    <main className={`page split-page ${panelOpen ? '' : 'panel-closed'}`}>
      <section className="content-zone">
        <PageHead title="Biens" subtitle="Base de donnees des proprietes prospectees." action={panelOpen ? 'Ouvrir mini fiche' : 'Afficher mini fiche'} onAction={panelOpen ? undefined : onOpenPanel} />
        <div className="tabs">
          {['Tous', 'Particuliers', 'Baisses de prix', 'Chauds', 'Carte', 'Archive'].map((tab, index) => <button className={index === 0 ? 'active' : ''} key={tab}>{tab}</button>)}
        </div>
        <Toolbar placeholder="Rechercher adresse, ville, source..." />
        <section className="property-grid">
          {properties.map((property, index) => (
            <PropertyCard key={property.id} property={property} selected={property.id === selected.id} onClick={() => onSelect(property.id)} index={index} />
          ))}
        </section>
      </section>
      {panelOpen && <PropertyPanel property={selected} onClose={onClosePanel} />}
    </main>
  );
}

function Pipeline({ selected, onSelect, panelOpen, onClosePanel, onOpenPanel }: { selected: Deal; onSelect: (id: string) => void; panelOpen: boolean; onClosePanel: () => void; onOpenPanel: () => void }) {
  const totals = useMemo(() => ({
    active: deals.length,
    mandat: deals.filter((item) => item.stage === 'Mandat potentiel').length,
    commission: deals.reduce((sum, item) => sum + item.commission, 0),
  }), []);
  return (
    <main className={`page split-page ${panelOpen ? '' : 'panel-closed'}`}>
      <section className="content-zone">
        <PageHead title="Opportunites" subtitle="Suivi commercial de vos dossiers actifs." action={panelOpen ? 'Nouveau deal' : 'Afficher mini fiche'} onAction={panelOpen ? undefined : onOpenPanel} />
        <section className="compact-kpis">
          <Kpi label="Deals actifs" value={totals.active} delta="Pipeline en cours" />
          <Kpi label="Mandats potentiels" value={totals.mandat} delta="Ce mois" />
          <Kpi label="Commission ouverte" value={money(totals.commission)} delta="Estimee" />
        </section>
        <div className="view-switch">
          <button className="active"><LayoutGrid size={15} /></button>
          <button><List size={15} /></button>
          <button><Filter size={15} /> Filtres</button>
        </div>
        <section className="kanban">
          {stages.map((stage) => (
            <div className="kanban-column" key={stage}>
              <header><span>{stage}</span><b>{deals.filter((deal) => deal.stage === stage).length}</b></header>
              {deals.filter((deal) => deal.stage === stage).map((deal) => (
                <DealCard key={deal.id} deal={deal} isSelected={selected.id === deal.id} onSelect={onSelect} />
              ))}
            </div>
          ))}
        </section>
      </section>
      {panelOpen && <DealPanel deal={selected} onClose={onClosePanel} />}
    </main>
  );
}

function Contacts({ selected, onSelect, panelOpen, onClosePanel, onOpenPanel }: { selected: Contact; onSelect: (id: string) => void; panelOpen: boolean; onClosePanel: () => void; onOpenPanel: () => void }) {
  return (
    <main className={`page split-page ${panelOpen ? '' : 'panel-closed'}`}>
      <section className="content-zone">
        <PageHead title="Contacts" subtitle="Gerez vos relations et suivez vos echanges." action={panelOpen ? 'Ajouter un contact' : 'Afficher mini fiche'} onAction={panelOpen ? undefined : onOpenPanel} />
        <Toolbar placeholder="Rechercher un contact..." />
        <div className="filter-row">
          {['vendeur', 'acheteur', 'prospect', 'investisseur', 'proprietaire'].map((role, index) => <button className={index === 0 ? 'active' : ''} key={role}>{role}</button>)}
        </div>
        <section className="table-panel">
          <table>
            <thead>
              <tr><th>Contact</th><th>Telephone</th><th>Email</th><th>Statut</th><th>Biens</th><th>Deals</th><th>Derniere activite</th><th>Prochaine action</th></tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr className={selected.id === contact.id ? 'selected' : ''} key={contact.id} onClick={() => onSelect(contact.id)}>
                  <td><span className="contact-cell"><Avatar name={contact.name} /> <b>{contact.name}</b></span></td>
                  <td>{contact.phone}</td>
                  <td>{contact.email}</td>
                  <td><Badge>{contact.status}</Badge></td>
                  <td>{contact.properties.length}</td>
                  <td>{contact.deals.length}</td>
                  <td>{contact.lastActivity}</td>
                  <td>{contact.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </section>
      {panelOpen && <ContactPanel contact={selected} onClose={onClosePanel} />}
    </main>
  );
}

function PageHead({ title, subtitle, action, onAction }: { title: string; subtitle: string; action: string; onAction?: () => void }) {
  return (
    <section className="page-title">
      <div><h1>{title}</h1><p>{subtitle}</p></div>
      <button className="primary-button" type="button" onClick={onAction}><Plus size={15} /> {action}</button>
    </section>
  );
}

function Toolbar({ placeholder }: { placeholder: string }) {
  return (
    <div className="toolbar">
      <label><Search size={15} /><input placeholder={placeholder} /></label>
      <button><Filter size={15} /> Filtres</button>
      <button><SlidersHorizontal size={15} /> Colonnes</button>
      <button><ChevronDown size={15} /> Trier</button>
    </div>
  );
}

function Kpi({ label, value, delta, deltaLabel, tone = 'good', spark, hint }: { label: string; value: string | number; delta: string; deltaLabel?: string; tone?: 'good' | 'risk' | 'watch'; spark?: number[]; hint?: string }) {
  return (
    <article className={`kpi tone-${tone}`}>
      <div className="kpi-label"><span>{label}</span>{hint ? <b>{hint}</b> : null}</div>
      <div className="kpi-value">
        <strong>{value}</strong>
        <span className={`kpi-delta ${tone === 'good' ? '' : tone}`}>{delta}</span>
      </div>
      {deltaLabel ? <small>{deltaLabel}</small> : null}
      {spark ? <Sparkline points={spark} /> : null}
    </article>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const w = 100, h = 28;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = Math.max(max - min, 1);
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => [i * step, h - ((p - min) / range) * (h - 4) - 2] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg className="kpi-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path className="area" d={area} />
      <path className="line" d={line} />
    </svg>
  );
}

function ScoreRing({ score, size = 'sm' }: { score: number; size?: 'sm' | 'lg' }) {
  const dimension = size === 'lg' ? 82 : 40;
  const stroke = size === 'lg' ? 7 : 3;
  const radius = (dimension - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const tier = score >= 80 ? 'tier-hot' : score >= 65 ? 'tier-warm' : 'tier-cool';
  return (
    <span className={`score-ring ${tier}`} style={{ width: dimension, height: dimension }}>
      <svg width={dimension} height={dimension} viewBox={`0 0 ${dimension} ${dimension}`}>
        <circle cx={dimension / 2} cy={dimension / 2} r={radius} />
        <circle cx={dimension / 2} cy={dimension / 2} r={radius} strokeDasharray={circumference} strokeDashoffset={circumference - (score / 100) * circumference} />
      </svg>
      <b>{score}</b>
    </span>
  );
}

function ScoreVerdict({ score }: { score: number }) {
  const verdict = score >= 80 ? 'Priorite haute' : score >= 65 ? 'A qualifier' : 'A surveiller';
  return (
    <span className="score-inline">
      <ScoreRing score={score} />
      <span className="verdict"><b>{score}</b><small>{verdict}</small></span>
    </span>
  );
}

const UNSPLASH_FALLBACK = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=900&q=80';

function PropertyCard({ property, selected, onClick, index = 0 }: { property: Property; selected: boolean; onClick: () => void; index?: number }) {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [linked, setLinked] = useState<boolean>(Boolean(property.contactId));

  const photos = property.photos && property.photos.length > 0
    ? property.photos
    : property.image
      ? [property.image]
      : [UNSPLASH_FALLBACK];
  const currentPhoto = photos[carouselIndex] ?? UNSPLASH_FALLBACK;
  const hasMultiple = photos.length > 1;

  const primarySignal = property.primarySignal ?? property.tag ?? property.signal;
  const signals = property.signals && property.signals.length > 0 ? property.signals : [property.signal];
  const extraCount = Math.max(0, signals.length - 1);
  const sellerType = property.fsbo
    ? 'Particulier'
    : property.source === 'Biddit'
      ? 'Notaire'
      : 'Agence';
  const publishedDays = property.publishedDays ?? property.daysOnline;
  const bathrooms = property.bathrooms ?? 0;
  const contact = contacts.find((item) => item.id === property.contactId);
  const opportunityReason = property.opportunityReason;
  const statusSlug = property.status.toLowerCase().replace('é', 'e');

  const stop = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); };
  const prev = (e: React.MouseEvent) => { stop(e); setCarouselIndex((i) => (i - 1 + photos.length) % photos.length); };
  const next = (e: React.MouseEvent) => { stop(e); setCarouselIndex((i) => (i + 1) % photos.length); };
  const toggleFav = (e: React.MouseEvent) => { stop(e); setIsFavorite((v) => !v); };
  const linkContact = (e: React.MouseEvent) => { stop(e); setLinked(true); };

  return (
    <button
      className={`property-card ${selected ? 'selected' : ''}`}
      onClick={onClick}
      type="button"
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` } as React.CSSProperties}
    >
      <div className="pc-media">
        <img key={currentPhoto} src={currentPhoto} alt="" className="pc-photo" />

        <div className="pc-media-top">
          <div className="pc-signal-badges">
            <span className="pc-badge-primary">{primarySignal}</span>
            {extraCount > 0 && <span className="pc-badge-extra">+{extraCount} autre{extraCount > 1 ? 's' : ''}</span>}
          </div>
          <ScoreRing score={property.score} />
        </div>

        <div className="pc-media-bottom">
          <span className="pc-source"><Globe size={11} /> {property.source}</span>
          <button
            className={`pc-fav ${isFavorite ? 'active' : ''}`}
            type="button"
            onClick={toggleFav}
            aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <Heart size={14} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>

        {hasMultiple && (
          <>
            <button className="pc-nav prev" type="button" onClick={prev} aria-label="Photo précédente"><ChevronLeft size={16} /></button>
            <button className="pc-nav next" type="button" onClick={next} aria-label="Photo suivante"><ChevronRight size={16} /></button>
            <div className="pc-dots">
              {photos.map((_, i) => (
                <span key={i} className={i === carouselIndex ? 'active' : ''} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="pc-body">
        <div className="pc-price-row">
          <strong className="pc-price">{money(property.price)}</strong>
          <span className={`pc-status status-${statusSlug}`}>{property.status}</span>
        </div>

        <h3 className="pc-title">{property.title}</h3>
        <p className="pc-location"><MapPin size={12} /> {property.city}</p>

        <div className="pc-signals">
          {signals.map((s) => (
            <span className="pc-signal-chip" key={s}>{s}</span>
          ))}
        </div>

        {linked && contact && opportunityReason ? (
          <div className="pc-opportunity">
            <Star size={12} />
            <span>{opportunityReason}</span>
          </div>
        ) : (
          <button className="pc-link-contact" type="button" onClick={linkContact}>
            <Plus size={12} /> Lier un contact
          </button>
        )}

        <div className="pc-meta-row">
          <span>{publishedDays} j en ligne</span>
          <span className="pc-dot">·</span>
          <span>{sellerType}</span>
        </div>

        <div className="pc-features">
          <span><Ruler size={12} /> {property.surface} m²</span>
          <span><BedDouble size={12} /> {property.bedrooms} ch.</span>
          <span><Bath size={12} /> {bathrooms} sdb</span>
        </div>
      </div>
    </button>
  );
}

function PropertyPanel({ property, onClose }: { property: Property; onClose: () => void }) {
  const photos = property.photos && property.photos.length > 0 ? property.photos : [property.image];
  const [idx, setIdx] = useState(0);
  const total = property.photosCount ?? photos.length;
  const remaining = Math.max(0, total - 1);
  const prev = () => setIdx((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIdx((i) => (i + 1) % photos.length);

  const sellerTypeLabel = property.fsbo
    ? 'Particulier (FSBO)'
    : property.source === 'Biddit'
    ? 'Notaire'
    : 'Agence';
  const sellerInitials = property.sellerName
    ? property.sellerName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
    : '—';
  const mapsHref = property.lat && property.lng
    ? `https://www.google.com/maps?q=${property.lat},${property.lng}`
    : `https://www.google.com/maps/search/${encodeURIComponent(property.addressLine ?? property.city)}`;

  return (
    <aside className="side-panel property-panel">
      {/* 1. Header bien */}
      <header className="pp-header">
        <div className="pp-title">
          <h2>{property.title}</h2>
          <p className="pp-loc"><MapPin size={13} /> {property.city} · Brabant wallon</p>
          <div className="pp-price-row">
            <b className="pp-price">{money(property.price)}</b>
            <span className="pp-meta">Publié {property.publishedAgo ?? `il y a ${property.daysOnline}j`}</span>
          </div>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Fermer"><X size={17} /></button>
      </header>

      {/* 2. Galerie */}
      <div className="pp-gallery">
        <img key={photos[idx]} src={photos[idx]} alt="" />
        {photos.length > 1 && (
          <>
            <button className="pp-nav prev" onClick={prev} aria-label="Précédent"><ChevronLeft size={16} /></button>
            <button className="pp-nav next" onClick={next} aria-label="Suivant"><ChevronRight size={16} /></button>
          </>
        )}
        <span className="pp-counter">{idx + 1} / {total}</span>
        {remaining > 0 && <span className="pp-photo-badge">+{Math.max(0, total - photos.length) || remaining} photos</span>}
      </div>

      {/* 3. Score IA */}
      <div className="score-block">
        <ScoreRing score={property.score} size="lg" />
        <div><strong>Score IA</strong><span>{property.primarySignal ?? property.signal}</span></div>
      </div>

      {/* 4. Résumé IA */}
      {property.aiSummary && (
        <section className="mini-panel">
          <header><h3>Résumé IA</h3></header>
          <p className="pp-summary">{property.aiSummary}</p>
        </section>
      )}

      {/* 5. Tags */}
      {property.tags && property.tags.length > 0 && (
        <div className="pp-tags">
          {property.tags.map((t) => <span key={t} className="pp-tag">{t}</span>)}
        </div>
      )}

      {/* 6. Détection multi-plateformes */}
      {property.listings && property.listings.length > 0 && (
        <section className="mini-panel">
          <header><h3>Détection</h3></header>
          <div className="pp-detect">
            <span className="pp-detect-label"><Globe size={13} /> Annonce détectée</span>
            <b className="pp-detect-value">{property.listings.length} plateformes</b>
          </div>
        </section>
      )}


      {/* 7. Caractéristiques */}
      <section className="mini-panel">
        <header><h3>Caractéristiques</h3></header>
        <dl className="pp-specs">
          <div><dt>Type</dt><dd>{property.type}</dd></div>
          <div><dt>Surface habitable</dt><dd>{property.surface} m²</dd></div>
          {property.terrain != null && <div><dt>Terrain</dt><dd>{property.terrain.toLocaleString('fr-BE')} m²</dd></div>}
          <div><dt>Chambres</dt><dd>{property.bedrooms}</dd></div>
          {property.bathrooms != null && <div><dt>Salles de bain</dt><dd>{property.bathrooms}</dd></div>}
          {property.garages != null && <div><dt>Garages</dt><dd>{property.garages}</dd></div>}
          {property.year != null && <div><dt>Année</dt><dd>{property.year}</dd></div>}
          {property.peb && <div><dt>PEB</dt><dd>{property.peb.rating} ({property.peb.consumption} kWh/m².an)</dd></div>}
          {property.heating && <div><dt>Chauffage</dt><dd>{property.heating}</dd></div>}
          {property.availability && <div><dt>Disponibilité</dt><dd>{property.availability}</dd></div>}
        </dl>
      </section>

      {/* 8. Historique prix */}
      {property.priceHistory && property.priceHistory.length > 0 && (
        <section className="mini-panel">
          <header><h3>Historique prix</h3></header>
          <ol className="pp-history">
            {property.priceHistory.map((e, i) => (
              <li key={i}>
                <span className="pp-h-date">{e.date}</span>
                <span className="pp-h-price">
                  {e.from ? `${money(e.from)} → ${money(e.to)}` : money(e.to)}
                </span>
                <span className={`pp-h-label ${e.delta ? 'delta' : ''}`}>{e.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 9. Analyse marché */}
      {property.marketPricePerM2 != null && (
        <section className="mini-panel">
          <header><h3>Analyse marché</h3></header>
          <div className="pp-market">
            <div><span>Prix au m²</span><b>{property.marketPricePerM2.toLocaleString('fr-BE')} €</b></div>
            <div><span>Écart marché</span><b className={property.marketGapPct && property.marketGapPct > 0 ? 'up' : 'down'}>
              {property.marketGapPct != null ? `${property.marketGapPct > 0 ? '+' : ''}${property.marketGapPct.toString().replace('.', ',')}%` : '—'}
            </b></div>
            <div><span>Marché {property.city}</span><b>{property.marketAvgPricePerM2?.toLocaleString('fr-BE')} €</b></div>
          </div>
        </section>
      )}

      {/* 10. Adresse */}
      {(property.addressLine || property.lat) && (
        <section className="mini-panel">
          <header><h3>Adresse</h3></header>
          <p className="pp-addr">{property.addressLine} · {property.postalCode} {property.city}</p>
          {property.lat && property.lng && (
            <p className="pp-coord">{property.lat}° N · {property.lng}° E</p>
          )}
          <a className="pp-maps" href={mapsHref} target="_blank" rel="noreferrer"><MapPin size={13} /> Ouvrir Maps</a>
        </section>
      )}

      {/* 11. Sources d'annonce */}
      {property.listings && property.listings.length > 0 && (
        <section className="mini-panel">
          <header><h3>Sources d'annonce</h3><span>{property.listings.length}</span></header>
          <ul className="pp-listings">
            {property.listings.map((l) => (
              <li key={l.platform}>
                <b>{l.platform}</b>
                <span>Référence : {l.ref}</span>
                <span>Publié le : {l.publishedAt}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 12. Vendeur */}
      {property.sellerName && (
        <section className="mini-panel">
          <header><h3>Vendeur</h3></header>
          <div className="pp-seller">
            <span className="pp-avatar">{sellerInitials}</span>
            <div className="pp-seller-info">
              <b>{property.sellerName}</b>
              <span>{sellerTypeLabel}</span>
              {property.sellerPhone && <span><Phone size={12} /> {property.sellerPhone}</span>}
              {property.sellerEmail && <span><Mail size={12} /> {property.sellerEmail}</span>}
            </div>
          </div>
        </section>
      )}

      {/* 13. Actions footer */}
      <div className="pp-actions">
        <button className="pp-btn primary"><Plus size={13} /> Créer deal</button>
        <button className="pp-btn" aria-label="Favori"><Heart size={14} /></button>
        <button className="pp-btn" aria-label="Ignorer"><X size={14} /></button>
        <button className="pp-btn ghost">Voir plus</button>
      </div>
    </aside>
  );
}


function DealPanel({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  const property = properties.find((item) => item.id === deal.propertyId)!;
  const contact = contacts.find((item) => item.id === deal.contactId)!;
  return (
    <aside className="side-panel">
      <header><div><h2>{deal.title}</h2><p>{deal.stage}</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fermer"><X size={17} /></button></header>
      <div className="info-grid">
        <Info label="Valeur" value={money(deal.value)} />
        <Info label="Commission" value={money(deal.commission)} />
        <Info label="Bien" value={property.city} />
        <Info label="Contact" value={contact.name} />
      </div>
      <MiniPanel title="Milestones">
        <Task checked label="Bien qualifie" meta="Automatique" />
        <Task checked={deal.stage !== 'A analyser'} label="Contact etabli" meta={contact.phone} />
        <Task checked={deal.stage === 'RDV' || deal.stage === 'Mandat potentiel'} label="RDV planifie" meta="Vendredi" />
      </MiniPanel>
      <MiniPanel title="Activite">
        <Signal label="Changement de stage" value={deal.stage} />
        <Signal label="Prochaine action" value={deal.nextAction} tone="watch" />
      </MiniPanel>
    </aside>
  );
}

function ContactPanel({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const linked = properties.filter((property) => contact.properties.includes(property.id));
  return (
    <aside className="side-panel">
      <header><div className="panel-person"><Avatar name={contact.name} /><div><h2>{contact.name}</h2><p>{contact.role}</p></div></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fermer"><X size={17} /></button></header>
      <div className="panel-actions">
        <button><Phone size={13} /> Appeler</button>
        <button><Mail size={13} /> Email</button>
        <button><MessageCircle size={13} /> WhatsApp</button>
      </div>
      <div className="info-grid">
        <Info label="Biens" value={contact.properties.length} />
        <Info label="Deals" value={contact.deals.length} />
        <Info label="Statut" value={contact.status} />
        <Info label="Action" value={contact.nextAction} />
      </div>
      <MiniPanel title="Informations">
        <p><Phone size={13} /> {contact.phone}</p>
        <p><Mail size={13} /> {contact.email}</p>
        <p><UserRound size={13} /> Suivi par Agent Martin</p>
      </MiniPanel>
      <MiniPanel title="Biens lies">
        {linked.length ? linked.map((property) => <Signal key={property.id} label={property.title} value={money(property.price)} />) : <p>Aucun bien lie.</p>}
      </MiniPanel>
      <MiniPanel title="Taches contact">
        <Task checked={false} label={contact.nextAction} meta="Demain 09:00" />
      </MiniPanel>
    </aside>
  );
}

function MiniPanel({ title, count, children }: { title: string; count?: string; children: React.ReactNode }) {
  return <section className="mini-panel"><header><h3>{title}</h3>{count ? <span>{count}</span> : null}</header>{children}</section>;
}

function Task({ checked, label, meta }: { checked: boolean; label: string; meta: string }) {
  return <div className="task-row">{checked ? <CheckCircle2 size={16} /> : <Circle size={16} />}<span><b>{label}</b><small>{meta}</small></span></div>;
}

function Signal({ label, value, tone = 'good' }: { label: string; value: string; tone?: 'good' | 'risk' | 'watch' }) {
  return <div className={`signal ${tone}`}><span>{label}</span><b>{value}</b></div>;
}

function Info({ label, value }: { label: string; value: string | number }) {
  return <div className="info"><span>{label}</span><strong>{value}</strong></div>;
}

function Badge({ children, tone = 'good' }: { children: React.ReactNode; tone?: 'good' | 'risk' | 'watch' | 'neutral' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function Avatar({ name }: { name: string }) {
  return <span className="avatar">{name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>;
}

function taskUrgency(dueISO: string): { state: 'overdue' | 'today' | 'upcoming'; label: string; dateLabel: string } {
  const due = new Date(dueISO);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDue = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const timeLabel = due.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
  const dateLabel =
    startDue === startToday
      ? `Aujourd'hui ${timeLabel}`
      : due.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' }) + ` ${timeLabel}`;
  if (startDue < startToday) return { state: 'overdue', label: 'En retard', dateLabel };
  if (startDue === startToday) return { state: 'today', label: "Aujourd'hui", dateLabel };
  return { state: 'upcoming', label: 'À venir', dateLabel };
}

function DealCard({ deal, isSelected, onSelect }: { deal: Deal; isSelected: boolean; onSelect: (id: string) => void }) {
  const property = properties.find((p) => p.id === deal.propertyId);
  const owner = agents.find((a) => a.id === deal.ownerId);
  const openTasks = tasks
    .filter((t) => t.dealId === deal.id && t.status === 'open')
    .sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
  const nextTask = openTasks[0];
  const nextUrgency = nextTask ? taskUrgency(nextTask.dueDate) : null;
  const score = property?.score ?? 70;
  const photo = property?.image;
  const propertyTitle = property?.title ?? deal.title;
  const ownerFirstName = owner?.name.split(' ')[0] ?? '';
  const othersCount = Math.max(0, openTasks.length - 1);

  return (
    <button
      className={`deal-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(deal.id)}
    >
      <div className="deal-card-media">
        {photo ? <img src={photo} alt="" className="deal-card-photo" /> : <div className="deal-card-photo placeholder" />}
        <ScoreRing score={score} />
        {openTasks.length > 0 && (
          <div className="deal-card-badges">
            <span className="deal-badge neutral">
              {openTasks.length} tâche{openTasks.length > 1 ? 's' : ''}
            </span>
            {nextUrgency && nextUrgency.state !== 'upcoming' && (
              <span className={`deal-badge ${nextUrgency.state === 'overdue' ? 'risk' : 'watch'}`}>
                {nextUrgency.label}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="deal-card-title">
        <span className="deal-ref">{deal.reference}</span>
        <hr />
        <strong>{propertyTitle}</strong>
      </div>

      <div className="deal-card-meta">
        <span>{property?.city}</span>
        <b>{money(deal.price)}</b>
      </div>

      {nextTask && nextUrgency && (
        <div className={`deal-card-task ${nextUrgency.state}`}>
          <div className="task-head">
            <span className="task-label">Prochaine tâche</span>
            <span className="task-state">{nextUrgency.label}</span>
            <span className="task-date">{nextUrgency.dateLabel}</span>
          </div>
          <div className="task-body">
            <span className="task-title">{nextTask.title}</span>
            {othersCount > 0 && (
              <span className="task-more">+{othersCount} autre{othersCount > 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      )}

      <hr className="deal-card-sep" />

      <div className="deal-card-footer">
        <span className="deal-owner">
          {owner?.avatar ? <img src={owner.avatar} alt="" className="deal-owner-avatar" /> : <span className="deal-owner-avatar placeholder" />}
          <span className="deal-owner-name">{ownerFirstName}</span>
        </span>
        <b className="deal-commission">{money(deal.commissionAmount)}</b>
      </div>
    </button>
  );
}

