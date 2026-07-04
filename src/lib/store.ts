import { 
  Agent, Property, PropertySignal, Deal, Contact, Task,
  TransferRequest, Notification, Commission, AuditLog, UserPropertyMark, UserRole,
  Activity, CommissionStatus, DealRelations, DealStage, PipelineStage, PropertyRelations,
  ContactRelations, TransferStatus, NotificationType, PropertyInternalStatus
} from '../types';

// Constants for Mock Generation
const PHOTO_SETS = [
  [
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
    'https://images.unsplash.com/photo-1600566753086-00f18fe6ede1?w=800&q=80'
  ],
  [
    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80',
    'https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=800&q=80',
    'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80'
  ],
  [
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80'
  ],
  [
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&q=80',
    'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&q=80'
  ],
  [
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80'
  ]
];

const CITIES = ['Lasne', 'Ixelles', 'Uccle', 'Waterloo', 'Bruxelles', 'Wavre', 'Rixensart', 'Etterbeek', 'Uccle', 'Saint-Gilles'];
const SOURCES = ['Zimmo', 'Immoweb', 'Immovlan', 'Biddit'];
const TITLES = [
  'Villa basse énergie', 'Appartement lumineux', 'Maison 3 façades', 'Penthouse vue parc', 
  'Triplex art-déco', 'Maison de campagne', 'Loft industriel', 'Duplex terrasse', 
  'Studio rénové moderne', 'Maison de Maître contemporaine', 'Villa d\'architecte'
];

export const MOCK_AGENTS: Agent[] = [
  { id: 'thomas', name: 'Thomas Martin', role: 'agent', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80', status: 'En ligne' },
  { id: 'sarah', name: 'Sarah Vermeulen', role: 'admin', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80', status: 'En ligne' },
  { id: 'adam', name: 'Adam Dubois', role: 'agent', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80', status: 'En rendez-vous' },
  { id: 'nora', name: 'Nora Peeters', role: 'agent', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&q=80', status: 'En ligne' },
  { id: 'lucas', name: 'Lucas Martin', role: 'agent', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80', status: 'En déplacement' }
];

export const MOCK_CONTACTS: Contact[] = [
  { id: 'c1', reference: 'CTC-0001', name: 'Jean-Marc Cloquet', email: 'jm.cloquet@gmail.com', phone: '+32 475 22 88 11', roles: ['vendeur', 'propriétaire'], notes: ['Souhaite vendre rapidement suite à déménagement.'], assignedDeals: ['deal-1'], assignedProperties: [1] },
  { id: 'c2', reference: 'CTC-0002', name: 'Annelies De Graeve', email: 'annelies.dg@outlook.com', phone: '+32 486 33 22 99', roles: ['vendeur'], notes: ['Très pointilleuse sur le prix de réserve.'], assignedDeals: ['deal-2'], assignedProperties: [2] },
  { id: 'c3', reference: 'CTC-0003', name: 'Benoît Poelvoorde', email: 'ben.poel@skynet.be', phone: '+32 495 11 44 22', roles: ['propriétaire'], notes: ['Client historique de l\'agence.'], assignedDeals: [], assignedProperties: [3] },
  { id: 'c4', reference: 'CTC-0004', name: 'Chantal Ladesou', email: 'chantal.ladesou@rtbf.be', phone: '+32 471 88 33 44', roles: ['prospect', 'acheteur'], notes: ['Recherche un loft insolite pour un projet artistique.'], assignedDeals: ['deal-4'], assignedProperties: [] },
  { id: 'c5', reference: 'CTC-0005', name: 'Marc Coucke', email: 'marc@coucke-invest.be', phone: '+32 488 99 00 22', roles: ['investisseur', 'acheteur'], notes: ['Gros dossier, cherche immeubles de rapport.'], assignedDeals: [], assignedProperties: [] },
  { id: 'c6', reference: 'CTC-0006', name: 'Sarah Dubois', email: 'sarah.dubois@gmail.com', phone: '+32 475 12 34 56', roles: ['acheteur'], notes: ['Budget flexible, coup de coeur uniquement.'], assignedDeals: [], assignedProperties: [] },
  { id: 'c7', reference: 'CTC-0007', name: 'Philippe Lambert', email: 'philippe.lambert@skynet.be', phone: '+32 495 55 66 77', roles: ['vendeur', 'propriétaire'], notes: ['Propriétaire d\'une villa d\'architecte.'], assignedDeals: [], assignedProperties: [4] }
];

type ReferencePrefix = 'DEAL' | 'CTC';

const isReadableReference = (value: unknown, prefix: ReferencePrefix): value is string =>
  typeof value === 'string' && new RegExp(`^${prefix}-\\d{4}$`).test(value);

const nextReference = (items: Array<{ reference?: string }>, prefix: ReferencePrefix): string => {
  const max = items.reduce((highest, item) => {
    if (!isReadableReference(item.reference, prefix)) return highest;
    return Math.max(highest, Number(item.reference.slice(prefix.length + 1)));
  }, 0);

  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
};

// Generate 35 properties (satisfies requirement of at least 30 properties)
const generateProperties = (): Property[] => {
  const list: Property[] = [];
  
  // Custom design the first 6 properties for hyper-realism and pre-linked deals
  const firstSix: Partial<Property>[] = [
    {
      id: 1,
      title: 'Villa basse énergie',
      city: 'Lasne',
      price: 895000,
      photos: PHOTO_SETS[0],
      tag: 'Baisse de prix',
      score: 82,
      peb: 'A',
      surface: 210,
      bedrooms: 4,
      bathrooms: 2,
      source: 'Zimmo',
      reserved: true,
      ownerId: 'thomas',
      fsbo: false,
      publishedDays: 5,
      floodZone: 'Sûre',
      notes: ['Excellente PEB (A). Pompes à chaleur installées en 2023. Double vitrage partout.'],
      yieldEstimate: '3.8%',
      description: 'Superbe propriétés contemporaine à basse consommation d\'énergie sise dans un charmant quartier résidentiel de Lasne. Environnement verdoyant et calme absolu.',
      priceHistory: [
        { date: '2026-05-10', price: 925000 },
        { date: '2026-05-20', price: 895000 }
      ]
    },
    {
      id: 2,
      title: 'Appartement lumineux',
      city: 'Ixelles',
      price: 495000,
      photos: PHOTO_SETS[1],
      tag: 'FSBO',
      score: 78,
      peb: 'B',
      surface: 120,
      bedrooms: 3,
      bathrooms: 1,
      source: 'Immoweb',
      reserved: true,
      ownerId: 'adam',
      fsbo: true,
      publishedDays: 14,
      floodZone: 'Faible',
      notes: ['Offre ferme attendue sous peu. Appartement remis à neuf récemment.'],
      yieldEstimate: '4.5%',
      description: 'Appartement baigné de lumière situé à proximité immédiate de la place Flagey. Idéal pour colocation de standing ou jeune couple actif.',
      priceHistory: [
        { date: '2026-05-01', price: 495000 }
      ]
    },
    {
      id: 3,
      title: 'Maison 3 façades avec jardin',
      city: 'Wavre',
      price: 670000,
      photos: PHOTO_SETS[2],
      tag: 'Nouveau',
      score: 85,
      peb: 'C',
      surface: 165,
      bedrooms: 3,
      bathrooms: 2,
      source: 'Immovlan',
      reserved: true,
      ownerId: 'thomas',
      fsbo: false,
      publishedDays: 2,
      floodZone: 'Sûre',
      notes: ['Mandat à faire signer d\'ici fin de semaine si feedback positif.'],
      yieldEstimate: '4.1%',
      description: 'Charmante maison sise dans un clos résidentiel fort prisé. Grand jardin arboré orienté Sud-Ouest. Garage fermé inclus.',
      priceHistory: [
        { date: '2026-05-23', price: 670000 }
      ]
    },
    {
      id: 4,
      title: 'Penthouse contemporain vue parc',
      city: 'Bruxelles',
      price: 1250000,
      photos: PHOTO_SETS[3],
      tag: 'Coup de cœur',
      score: 93,
      peb: 'A',
      surface: 195,
      bedrooms: 4,
      bathrooms: 3,
      source: 'Biddit',
      reserved: false,
      ownerId: null,
      fsbo: false,
      publishedDays: 1,
      floodZone: 'Sûre',
      notes: ['Client fortuné cherche précisément ce type de prestation.'],
      yieldEstimate: '3.2%',
      description: 'Somptueux Penthouse au dernier étage d\'une résidence de prestige. Vastes réceptions, cuisine super-équipée dernier cri, terrasses panoramiques de 60m².',
      priceHistory: [
        { date: '2026-05-24', price: 1250000 }
      ]
    },
    {
      id: 5,
      title: 'Maison de maître victorienne',
      city: 'Uccle',
      price: 1450000,
      photos: PHOTO_SETS[4],
      tag: 'Republié',
      score: 91,
      peb: 'D',
      surface: 320,
      bedrooms: 5,
      bathrooms: 3,
      source: 'Zimmo',
      reserved: true,
      ownerId: 'nora',
      fsbo: false,
      publishedDays: 45,
      floodZone: 'Faible',
      notes: ['Annonce republiée plusieurs fois par le propriétaire. Commission négociable.'],
      yieldEstimate: '3.0%',
      description: 'Exceptionnelle maison bourgeoise ayant conservé tous ses éléments d\'époque (moulures, cheminées, parquets d\'origine). Jardin de ville clos de murs.',
      priceHistory: [
        { date: '2026-04-10', price: 1550000 },
        { date: '2026-05-02', price: 1450000 }
      ]
    },
    {
      id: 6,
      title: 'Loft industriel rénové',
      city: 'Waterloo',
      price: 560000,
      photos: PHOTO_SETS[0],
      tag: 'Nouveau',
      score: 72,
      peb: 'C',
      surface: 150,
      bedrooms: 2,
      bathrooms: 1,
      source: 'Immoweb',
      reserved: false,
      ownerId: null,
      fsbo: false,
      publishedDays: 3,
      floodZone: 'Sûre',
      notes: ['À proposer rapidement à la liste de prospects inscrits.'],
      yieldEstimate: '5.2%',
      description: 'Ancienne usine réhabilitée en magnifiques lofts. Hauteur sous plafond remarquable, poutres métalliques apparentes et béton ciré.',
      priceHistory: [
        { date: '2026-05-22', price: 560000 }
      ]
    }
  ];

  // Populate first 6
  firstSix.forEach((p) => {
    list.push(p as Property);
  });

  // Programmatically generate remaining 29 properties (till index 35) to reach 35
  for (let i = 7; i <= 35; i++) {
    const photos = PHOTO_SETS[i % PHOTO_SETS.length];
    const city = CITIES[i % CITIES.length];
    const source = SOURCES[i % SOURCES.length];
    const title = TITLES[i % TITLES.length] + ' ' + (i % 3 === 0 ? 'rénové' : 'exclusif');
    const price = 250000 + (i * 37919) % 1100000;
    const peb = ['A', 'B', 'C', 'D', 'E'][i % 5];
    const score = 65 + (i * 11) % 31;
    const isReserved = i % 5 === 0;

    let targetOwnerId: string | null = null;
    if (isReserved) {
      targetOwnerId = ['thomas', 'adam', 'nora', 'lucas'][i % 4];
    }

    const tagList = ['FSBO', 'Baisse de prix', 'Republié', 'Coup de cœur', 'Nouveau'];
    const tag = tagList[i % tagList.length];

    list.push({
      id: i,
      title: title,
      city: city,
      price: price,
      photos: photos,
      tag: tag,
      score: score,
      peb: peb,
      surface: 80 + (i * 7) % 180,
      bedrooms: 1 + (i % 4),
      bathrooms: 1 + (i % 3),
      source: source,
      reserved: isReserved,
      ownerId: targetOwnerId,
      fsbo: tag === 'FSBO',
      publishedDays: i * 2,
      floodZone: i % 7 === 0 ? 'Moyenne' : i % 13 === 0 ? 'Élevée' : 'Sûre',
      notes: ['Propriété collectée automatiquement par le scraper.'],
      yieldEstimate: (3 + (i % 4) * 0.7).toFixed(1) + '%',
      description: `Magnifique opportunité d'achat située dans un quartier prisé de la commune de ${city}. ${title} offrant d'excellents volumes et une belle luminosité.`,
      priceHistory: [
        { date: '2026-05-01', price: price + 25000 },
        { date: '2026-05-15', price: price }
      ]
    });
  }

  return list;
};

// Generate initial list of deals
const generateInitialDeals = (props: Property[]): Deal[] => {
  return [
    {
      id: 'deal-1',
      reference: 'DEAL-0001',
      propertyId: 1, // Villa basse énergie, owned by thomas (Thomas Martin)
      contactId: 'c1',
      ownerId: 'thomas',
      stage: 'Visite',
      commissionStatus: 'brouillon',
      commissionAmount: 26850,
      title: 'deal - Villa basse énergie - Lasne',
      price: 895000,
      notes: [
        'Vendeur très réceptif aux premières visites de ce weekend.',
        'Intérêt fort d\'un acquéreur potentiel de l\'agence.'
      ],
      tasks: ['task-1', 'task-2'],
      activities: [
        { id: 'act-1', type: 'creation', text: 'Deal créé automatiquement depuis le bien.', date: '2026-05-20', agentId: 'thomas', agentName: 'Thomas Martin' },
        { id: 'act-2', type: 'stage_change', text: 'Changement de statut : de Nouveau à Qualifié', date: '2026-05-21', agentId: 'thomas', agentName: 'Thomas Martin' },
        { id: 'act-3', type: 'stage_change', text: 'Changement de statut : de Qualifié à Visite', date: '2026-05-22', agentId: 'thomas', agentName: 'Thomas Martin' }
      ]
    },
    {
      id: 'deal-2',
      reference: 'DEAL-0002',
      propertyId: 2, // Appartement lumineux, owned by adam (Adam Dubois)
      contactId: 'c2',
      ownerId: 'adam',
      stage: 'Proposition',
      commissionStatus: 'prévue',
      commissionAmount: 14850,
      title: 'deal - Appartement lumineux - Ixelles',
      price: 495000,
      notes: [
        'Offre écrite reçue à 480.000€, sous réserve de financement.'
      ],
      tasks: ['task-3'],
      activities: [
        { id: 'act-4', type: 'creation', text: 'Deal créé suite à contact téléphonique direct.', date: '2026-05-15', agentId: 'adam', agentName: 'Adam Dubois' },
        { id: 'act-5', type: 'stage_change', text: 'Changement de statut : de Nouveau à Visite', date: '2026-05-18', agentId: 'adam', agentName: 'Adam Dubois' },
        { id: 'act-6', type: 'stage_change', text: 'Changement de statut : de Visite à Proposition', date: '2026-05-24', agentId: 'adam', agentName: 'Adam Dubois' }
      ]
    },
    {
      id: 'deal-3',
      reference: 'DEAL-0003',
      propertyId: 3, // Maison 3 façades, owned by thomas
      contactId: 'c3',
      ownerId: 'thomas',
      stage: 'Contact',
      commissionStatus: 'brouillon',
      commissionAmount: 20100,
      title: 'deal - Maison 3 façades - Wavre',
      price: 670000,
      notes: [
        'Estimation des travaux demandée par le prospect.'
      ],
      tasks: ['task-4'],
      activities: [
        { id: 'act-7', type: 'creation', text: 'Création du dossier suite à alerte scraper Zimmo.', date: '2026-05-24', agentId: 'thomas', agentName: 'Thomas Martin' },
        { id: 'act-8', type: 'stage_change', text: 'Changement de statut : de Nouveau à Contact', date: '2026-05-25', agentId: 'thomas', agentName: 'Thomas Martin' }
      ]
    },
    {
      id: 'deal-4',
      reference: 'DEAL-0004',
      propertyId: 5, // Maison victorienne, owned by nora
      contactId: 'c4',
      ownerId: 'nora',
      stage: 'Mandat signé',
      commissionStatus: 'prévue',
      commissionAmount: 43500,
      title: 'deal - Maison victorienne - Uccle',
      price: 1450000,
      notes: [
        'Mandat exclusif signé ce matin en agence !'
      ],
      tasks: [],
      activities: [
        { id: 'act-9', type: 'creation', text: 'Lead identifié.', date: '2026-05-02', agentId: 'nora', agentName: 'Nora Peeters' },
        { id: 'act-10', type: 'stage_change', text: 'Changement de statut : de Visite à Mandat signé', date: '2026-05-24', agentId: 'nora', agentName: 'Nora Peeters' }
      ]
    }
  ];
};

const generateInitialSignals = (): PropertySignal[] => {
  return [
    { id: 'sig-1', type: 'drop', propertyId: 1, heading: 'Baisse de prix -5,2%', info: 'Maison basse énergie - Lasne', date: '2026-05-25', time: '16:45', value: '-30.000 €', source: 'Zimmo', ignoredByAgents: [] },
    { id: 'sig-2', type: 'repub', propertyId: 2, heading: 'Annonce republiée par le propriétaire', info: 'Appartement lumineux - Ixelles', date: '2026-05-25', time: '16:15', value: 'Retravaillé', source: 'Immoweb', ignoredByAgents: [] },
    { id: 'sig-3', type: 'high', propertyId: 4, heading: 'Opportunité à haut score IA (93)', info: 'Penthouse contemporain - Bruxelles', date: '2026-05-25', time: '15:30', value: 'Très chaud', source: 'Biddit', ignoredByAgents: [] },
    { id: 'sig-4', type: 'fsbo', propertyId: 2, heading: 'Détection Vente de Particulier à Particulier (FSBO)', info: 'Appartement lumineux - Ixelles', date: '2026-05-25', time: '14:20', value: 'FSBO', source: 'Immoweb', ignoredByAgents: [] },
    { id: 'sig-5', type: 'new', propertyId: 6, heading: 'Nouvelle annonce collectée', info: 'Loft industriel rénové - Waterloo', date: '2026-05-25', time: '12:00', value: 'Nouveau', source: 'Immoweb', ignoredByAgents: [] },
    { id: 'sig-6', type: 'old', propertyId: 5, heading: 'Annonce sur le marché depuis +90 jours', info: 'Maison victorienne - Uccle', date: '2026-05-24', time: '09:00', value: 'Ancien', source: 'Zimmo', ignoredByAgents: [] }
  ];
};

const generateInitialTasks = (): Task[] => {
  return [
    { id: 'task-1', title: 'Renvoyer le dossier technique', date: '2026-05-25', time: '18:00', priority: 'haute', done: false, agentId: 'thomas', dealId: 'deal-1', propertyId: 1, place: 'En ligne' },
    { id: 'task-2', title: 'Appeler Jean-Marc pour coordonner la visite de mardi', date: '2026-05-26', time: '10:00', priority: 'moyenne', done: false, agentId: 'thomas', dealId: 'deal-1', propertyId: 1, contactId: 'c1' },
    { id: 'task-3', title: 'Relancer l\'offre écrite', date: '2026-05-25', time: '14:00', priority: 'haute', done: true, agentId: 'adam', dealId: 'deal-2', propertyId: 2, contactId: 'c2' },
    { id: 'task-4', title: 'Organiser l\'estimation par l\'entrepreneur', date: '2026-05-27', time: '15:30', priority: 'haute', done: false, agentId: 'thomas', dealId: 'deal-3', propertyId: 3, contactId: 'c3', place: 'Wavre' },
    { id: 'task-5', title: 'Remplir les fiches d\'enregistrement', date: '2026-05-25', time: '17:30', priority: 'basse', done: false, agentId: 'thomas', place: 'Bureau Wavre' },
    { id: 'task-6', title: 'Relancer l\'investisseur Coucke sur le rapport de Bruxelles', date: '2026-05-27', time: '11:00', priority: 'haute', done: false, agentId: 'thomas', contactId: 'c5' }
  ];
};

const generateInitialTransfers = (): TransferRequest[] => {
  return [
    { id: 'tr-1', propertyId: 2, dealId: 'deal-2', fromAgentId: 'thomas', toAgentId: 'adam', status: 'accepté', date: '2026-05-24' },
    { id: 'tr-2', propertyId: 5, dealId: 'deal-4', fromAgentId: 'thomas', toAgentId: 'nora', status: 'en_attente', date: '2026-05-25' }
  ];
};

const generateInitialNotifications = (): Notification[] => {
  return [
    { id: 'not-1', type: 'transfer_pending', title: 'Demande de transfert en attente', text: 'Sarah Vermeulen souhaite vous transférer le dossier Villa contemporaine sise à Uccle.', date: '2026-05-25', read: false, actionLink: '#pipeline' },
    { id: 'not-2', type: 'task_due', title: 'Rappel tâche urgente', text: 'Votre tâche "Renvoyer le dossier technique" arrive à échéance à 18h00 aujourd\'hui.', date: '2026-05-25', read: false, actionLink: '#agenda' },
    { id: 'not-3', type: 'commission_ready', title: 'Commission débloquée !', text: 'La commission de "deal - Maison victorienne" est en statut Brouillon et demande validation.', date: '2026-05-24', read: true, actionLink: '#admin' }
  ];
};

const generateInitialCommissions = (): Commission[] => {
  return [
    { id: 'com-1', dealId: 'deal-4', agentId: 'nora', amount: 43500, status: 'prévue', date: '2026-05-24', propertyTitle: 'Maison victorienne — Uccle', agentName: 'Nora Peeters' },
    { id: 'com-2', dealId: 'deal-2', agentId: 'adam', amount: 14850, status: 'payable', date: '2026-05-18', propertyTitle: 'Appartement lumineux — Ixelles', agentName: 'Adam Dubois' },
    { id: 'com-3', dealId: 'deal-1', agentId: 'thomas', amount: 26850, status: 'brouillon', date: '2026-05-22', propertyTitle: 'Villa basse énergie — Lasne', agentName: 'Thomas Martin' }
  ];
};

const generateInitialAuditLogs = (): AuditLog[] => {
  return [
    { id: 'log-1', timestamp: '2026-05-25 14:15:22', action: 'Création Deal', agentName: 'Thomas Martin', details: 'Création du deal deal-3 pour la Maison 3 façades à Wavre.' },
    { id: 'log-2', timestamp: '2026-05-25 15:30:11', action: 'Transfert Accepté', agentName: 'Adam Dubois', details: 'Adam Dubois a accepté le transfert pour le deal appartement lumineux.' },
    { id: 'log-3', timestamp: '2026-05-25 16:22:45', action: 'Modification Stage', agentName: 'Nora Peeters', details: 'Le deal victorien a été déplacé vers le stage "Mandat signé".' }
  ];
};

// Store Implementation
export class ImmoPilotStore {
  private properties: Property[] = [];
  private deals: Deal[] = [];
  private contacts: Contact[] = [];
  private tasks: Task[] = [];
  private signals: PropertySignal[] = [];
  private transfers: TransferRequest[] = [];
  private notifications: Notification[] = [];
  private commissions: Commission[] = [];
  private auditLogs: AuditLog[] = [];
  private currentAgentId: string = 'thomas';
  private userMarks: UserPropertyMark[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const storedProps = localStorage.getItem('ip_properties');
      const storedDeals = localStorage.getItem('ip_deals');
      const storedContacts = localStorage.getItem('ip_contacts');
      const storedTasks = localStorage.getItem('ip_tasks');
      const storedSignals = localStorage.getItem('ip_signals');
      const storedTransfers = localStorage.getItem('ip_transfers');
      const storedNotifs = localStorage.getItem('ip_notifications');
      const storedComms = localStorage.getItem('ip_commissions');
      const storedLogs = localStorage.getItem('ip_audit_logs');
      const storedMarks = localStorage.getItem('ip_user_marks');
      const storedAgent = localStorage.getItem('ip_current_agent_id');

      if (storedProps) this.properties = JSON.parse(storedProps);
      else {
        this.properties = generateProperties();
        this.saveProperties();
      }

      if (storedDeals) this.deals = JSON.parse(storedDeals);
      else {
        this.deals = generateInitialDeals(this.properties);
        this.saveDeals();
      }

      if (storedContacts) this.contacts = JSON.parse(storedContacts);
      else {
        this.contacts = MOCK_CONTACTS;
        this.saveContacts();
      }

      this.ensureReadableReferences();

      if (storedTasks) this.tasks = JSON.parse(storedTasks);
      else {
        this.tasks = generateInitialTasks();
        this.saveTasks();
      }

      if (storedSignals) this.signals = JSON.parse(storedSignals);
      else {
        this.signals = generateInitialSignals();
        this.saveSignals();
      }

      if (storedTransfers) this.transfers = JSON.parse(storedTransfers);
      else {
        this.transfers = generateInitialTransfers();
        this.saveTransfers();
      }

      if (storedNotifs) this.notifications = JSON.parse(storedNotifs);
      else {
        this.notifications = generateInitialNotifications();
        this.saveNotifications();
      }

      if (storedComms) this.commissions = JSON.parse(storedComms);
      else {
        this.commissions = generateInitialCommissions();
        this.saveCommissions();
      }

      if (storedLogs) this.auditLogs = JSON.parse(storedLogs);
      else {
        this.auditLogs = generateInitialAuditLogs();
        this.saveAuditLogs();
      }

      if (storedMarks) this.userMarks = JSON.parse(storedMarks);
      else {
        // Initialize marks
        this.userMarks = [];
      }

      if (storedAgent) this.currentAgentId = storedAgent;
      else this.currentAgentId = 'thomas';

      this.normalizeData();

    } catch (e) {
      console.error('Failed to load ImmoPilot store:', e);
    }
  }

  private ensureReadableReferences() {
    let dealsChanged = false;
    let contactsChanged = false;
    const assignedDealRefs = new Set<string>();
    const assignedContactRefs = new Set<string>();

    this.deals.forEach((deal) => {
      if (isReadableReference(deal.reference, 'DEAL') && !assignedDealRefs.has(deal.reference)) {
        assignedDealRefs.add(deal.reference);
        return;
      }

      deal.reference = nextReference([...this.deals, ...Array.from(assignedDealRefs).map(reference => ({ reference }))], 'DEAL');
      assignedDealRefs.add(deal.reference);
      dealsChanged = true;
    });

    this.contacts.forEach((contact) => {
      if (isReadableReference(contact.reference, 'CTC') && !assignedContactRefs.has(contact.reference)) {
        assignedContactRefs.add(contact.reference);
        return;
      }

      contact.reference = nextReference([...this.contacts, ...Array.from(assignedContactRefs).map(reference => ({ reference }))], 'CTC');
      assignedContactRefs.add(contact.reference);
      contactsChanged = true;
    });

    if (dealsChanged) this.saveDeals();
    if (contactsChanged) this.saveContacts();
  }

  private normalizeData() {
    this.properties.forEach((property) => {
      property.photos = property.photos ?? [];
      property.notes = property.notes ?? [];
      property.priceHistory = property.priceHistory ?? [];
      property.fsbo = Boolean(property.fsbo || property.tag === 'FSBO');
      property.reserved = Boolean(property.reserved || property.ownerId);
      property.status = property.status ?? (property.reserved ? 'réservé' : 'disponible');
    });

    this.contacts.forEach((contact) => {
      contact.roles = contact.roles ?? ['prospect'];
      contact.notes = contact.notes ?? [];
      contact.assignedDeals = contact.assignedDeals ?? [];
      contact.assignedProperties = contact.assignedProperties ?? [];
    });

    this.deals.forEach((deal) => {
      deal.activities = deal.activities ?? [];
      deal.notes = deal.notes ?? [];
      deal.tasks = deal.tasks ?? [];
      deal.activeTransferId = deal.activeTransferId ?? null;

      const property = this.properties.find((item) => item.id === deal.propertyId);
      if (property) {
        property.reserved = true;
        property.ownerId = property.ownerId ?? deal.ownerId;
        property.status = 'réservé';
      }

      const contact = this.contacts.find((item) => item.id === deal.contactId);
      if (contact) {
        if (!contact.assignedDeals.includes(deal.id)) contact.assignedDeals.push(deal.id);
        if (!contact.assignedProperties.includes(deal.propertyId)) contact.assignedProperties.push(deal.propertyId);
      }
    });

    this.tasks.forEach((task) => {
      task.done = Boolean(task.done);
      task.priority = task.priority ?? 'moyenne';

      if (task.dealId) {
        const deal = this.deals.find((item) => item.id === task.dealId);
        if (deal && !deal.tasks.includes(task.id)) deal.tasks.push(task.id);
      }
    });

    this.signals.forEach((signal) => {
      signal.ignoredByAgents = signal.ignoredByAgents ?? [];
      signal.status = signal.status ?? (signal.ignoredByAgents.includes(this.currentAgentId) ? 'ignoré' : 'nouveau');
    });

    this.saveProperties();
    this.saveDeals();
    this.saveContacts();
    this.saveTasks();
    this.saveSignals();
  }

  // Savings helper
  private saveProperties() { localStorage.setItem('ip_properties', JSON.stringify(this.properties)); }
  private saveDeals() { localStorage.setItem('ip_deals', JSON.stringify(this.deals)); }
  private saveContacts() { localStorage.setItem('ip_contacts', JSON.stringify(this.contacts)); }
  private saveTasks() { localStorage.setItem('ip_tasks', JSON.stringify(this.tasks)); }
  private saveSignals() { localStorage.setItem('ip_signals', JSON.stringify(this.signals)); }
  private saveTransfers() { localStorage.setItem('ip_transfers', JSON.stringify(this.transfers)); }
  private saveNotifications() { localStorage.setItem('ip_notifications', JSON.stringify(this.notifications)); }
  private saveCommissions() { localStorage.setItem('ip_commissions', JSON.stringify(this.commissions)); }
  private saveAuditLogs() { localStorage.setItem('ip_audit_logs', JSON.stringify(this.auditLogs)); }
  private saveUserMarks() { localStorage.setItem('ip_user_marks', JSON.stringify(this.userMarks)); }

  // LOGGED IN USER SERVICES
  public getCurrentAgent(): Agent {
    return MOCK_AGENTS.find(a => a.id === this.currentAgentId) || MOCK_AGENTS[0];
  }

  public getAgents(): Agent[] {
    return MOCK_AGENTS;
  }

  public setCurrentAgent(agentId: string) {
    this.currentAgentId = agentId;
    localStorage.setItem('ip_current_agent_id', agentId);
    this.createAuditLog('Changement Utilisateur Connecté', `Le profil actif a été basculé sur ${this.getCurrentAgent().name}.`);
    
    // Dispatch general event for reload
    window.dispatchEvent(new CustomEvent('ip-agent-changed', { detail: { agentId } }));
  }

  // PROPERTY SERVICES
  public getProperties(): Property[] {
    return this.properties;
  }

  public getProperty(id: number): Property | undefined {
    return this.properties.find(p => p.id === id);
  }

  public getPropertySignals(propertyId: number): PropertySignal[] {
    return this.signals.filter((signal) => signal.propertyId === propertyId);
  }

  public getPropertyTasks(propertyId: number): Task[] {
    return this.tasks.filter((task) => task.propertyId === propertyId);
  }

  public getPropertyDeal(propertyId: number): Deal | undefined {
    return this.deals.find((deal) => deal.propertyId === propertyId);
  }

  public getPropertyContact(propertyId: number): Contact | undefined {
    const deal = this.getPropertyDeal(propertyId);
    if (deal) return this.getContact(deal.contactId);
    return this.contacts.find((contact) => contact.assignedProperties.includes(propertyId));
  }

  public getPropertyActivities(propertyId: number): Activity[] {
    const dealActivities = this.deals
      .filter((deal) => deal.propertyId === propertyId)
      .flatMap((deal) => deal.activities);

    const signalActivities: Activity[] = this.getPropertySignals(propertyId).map((signal) => ({
      id: `activity-${signal.id}`,
      type: 'signal',
      text: signal.heading,
      date: signal.date,
      agentId: 'system',
      agentName: 'ImmoPilot',
      entityType: 'signal',
      entityId: signal.id,
    }));

    return [...dealActivities, ...signalActivities].sort((a, b) => b.date.localeCompare(a.date));
  }

  public getPropertyRelations(propertyId: number): PropertyRelations | undefined {
    const property = this.getProperty(propertyId);
    if (!property) return undefined;

    const deal = this.getPropertyDeal(propertyId);
    const contact = deal ? this.getContact(deal.contactId) : this.getPropertyContact(propertyId);

    return {
      property,
      contact,
      deal,
      tasks: this.getPropertyTasks(propertyId),
      signals: this.getPropertySignals(propertyId),
      activities: this.getPropertyActivities(propertyId),
    };
  }

  public registerNoteToProperty(propertyId: number, noteText: string) {
    const prop = this.properties.find(p => p.id === propertyId);
    if (prop) {
      if (!prop.notes) prop.notes = [];
      prop.notes.unshift(noteText);
      this.saveProperties();
      this.createAuditLog('Note Ajoutée', `Ajout d'une note sur le bien "${prop.title}": ${noteText.substring(0, 30)}...`);
    }
  }

  public updatePropertyStatus(propertyId: number, status: PropertyInternalStatus): Property | undefined {
    const prop = this.properties.find(p => p.id === propertyId);
    if (!prop) return undefined;

    const previousStatus = prop.status ?? (prop.reserved ? 'réservé' : 'disponible');
    prop.status = status;

    if (status === 'réservé') {
      prop.reserved = true;
      prop.ownerId = prop.ownerId ?? this.currentAgentId;
    } else {
      prop.reserved = false;
      prop.ownerId = null;
    }

    this.saveProperties();
    this.createAuditLog('Statut Bien', `Le bien "${prop.title}" est passé de "${previousStatus}" à "${status}".`);
    window.dispatchEvent(new CustomEvent('ip-state-changed'));
    return prop;
  }

  public linkPropertyToContact(propertyId: number, contactId: string): Contact | undefined {
    const prop = this.properties.find(p => p.id === propertyId);
    const contact = this.contacts.find(c => c.id === contactId);
    if (!prop || !contact) return undefined;

    this.contacts.forEach((item) => {
      item.assignedProperties = item.assignedProperties.filter((id) => id !== propertyId);
    });

    if (!contact.assignedProperties.includes(propertyId)) {
      contact.assignedProperties.push(propertyId);
    }

    const deal = this.getPropertyDeal(propertyId);
    if (deal) {
      deal.contactId = contactId;
      if (!contact.assignedDeals.includes(deal.id)) contact.assignedDeals.push(deal.id);
      this.saveDeals();
    }

    this.saveContacts();
    this.createAuditLog('Contact lié', `Le contact "${contact.name}" a été lié au bien "${prop.title}".`);
    window.dispatchEvent(new CustomEvent('ip-state-changed'));
    return contact;
  }

  public createPropertyTask(propertyId: number, title: string, options: Partial<Omit<Task, 'id' | 'title' | 'done' | 'propertyId'>> = {}): Task {
    const prop = this.properties.find(p => p.id === propertyId);
    if (!prop) throw new Error('Property not found');

    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const deal = this.getPropertyDeal(propertyId);
    const contact = this.getPropertyContact(propertyId);

    return this.createTask({
      title,
      date: options.date ?? tomorrow,
      time: options.time ?? '09:00',
      priority: options.priority ?? 'moyenne',
      agentId: options.agentId ?? this.currentAgentId,
      propertyId,
      dealId: options.dealId ?? deal?.id ?? null,
      contactId: options.contactId ?? contact?.id ?? null,
      place: options.place ?? prop.city,
    });
  }

  public freeReservedProperty(propertyId: number) {
    const prop = this.properties.find(p => p.id === propertyId);
    if (prop) {
      const originalOwner = prop.ownerId;
      prop.reserved = false;
      prop.ownerId = null;
      this.saveProperties();

      // Find deal linked to this and cancel / delete it
      this.deals = this.deals.filter(d => d.propertyId !== propertyId);
      this.saveDeals();

      this.createAuditLog('Libération Bien', `Le bien "${prop.title}" a été libéré administrativement.`);
      this.addNotification(
        'property_reserved',
        'Bien libéré',
        `Le bien "${prop.title}" (précédemment réservé) est maintenant disponible.`,
        '#biens'
      );
      
      window.dispatchEvent(new CustomEvent('ip-state-changed'));
    }
  }

  // USER MARKS (Favorites / Ignored)
  public getMarks(propertyId: number): UserPropertyMark {
    const existing = this.userMarks.find(m => m.propertyId === propertyId && m.agentId === this.currentAgentId);
    if (existing) return existing;
    return { propertyId, agentId: this.currentAgentId, favorite: false, ignored: false };
  }

  public togglePropertyFavorite(propertyId: number) {
    let index = this.userMarks.findIndex(m => m.propertyId === propertyId && m.agentId === this.currentAgentId);
    let favVal = true;
    if (index !== -1) {
      this.userMarks[index].favorite = !this.userMarks[index].favorite;
      favVal = this.userMarks[index].favorite;
    } else {
      this.userMarks.push({ propertyId, agentId: this.currentAgentId, favorite: true, ignored: false });
    }
    this.saveUserMarks();
    
    const prop = this.properties.find(p => p.id === propertyId);
    this.createAuditLog(
      favVal ? 'Favori Ajouté' : 'Favori Retiré', 
      `Le bien "${prop?.title || propertyId}" a été ${favVal ? 'mis en' : 'retiré des'} favoris.`
    );

    window.dispatchEvent(new CustomEvent('ip-state-changed'));
  }

  public togglePropertyIgnored(propertyId: number) {
    let index = this.userMarks.findIndex(m => m.propertyId === propertyId && m.agentId === this.currentAgentId);
    let ignoreVal = true;
    if (index !== -1) {
      this.userMarks[index].ignored = !this.userMarks[index].ignored;
      ignoreVal = this.userMarks[index].ignored;
      if (this.userMarks[index].ignored) {
        this.userMarks[index].favorite = false;
      }
    } else {
      this.userMarks.push({ propertyId, agentId: this.currentAgentId, favorite: false, ignored: true });
    }
    this.saveUserMarks();

    const prop = this.properties.find(p => p.id === propertyId);
    this.createAuditLog(
      ignoreVal ? 'Bien Ignoré' : 'Bien Réactivé', 
      `Le bien "${prop?.title || propertyId}" a été ${ignoreVal ? 'masqué/ignoré' : 'réactivé'}.`
    );

    window.dispatchEvent(new CustomEvent('ip-state-changed'));
  }

  // DEALS & PIPELINE SERVICES
  public getDeals(): Deal[] {
    return this.deals;
  }

  public getDeal(id: string): Deal | undefined {
    return this.deals.find(d => d.id === id);
  }

  public getDealByReference(reference: string): Deal | undefined {
    return this.deals.find(d => d.reference === reference);
  }

  public getDealTasks(dealId: string): Task[] {
    return this.tasks.filter((task) => task.dealId === dealId);
  }

  public getDealRelations(dealId: string): DealRelations | undefined {
    const deal = this.getDeal(dealId);
    if (!deal) return undefined;

    return {
      deal,
      property: this.getProperty(deal.propertyId),
      contact: this.getContact(deal.contactId),
      tasks: this.getDealTasks(dealId),
      activities: deal.activities,
    };
  }

  public createDeal(propertyId: number, contactId: string, customStage: DealStage = 'Nouveau'): Deal {
    const prop = this.properties.find(p => p.id === propertyId);
    if (!prop) throw new Error('Biens non existant / Property not found');
    
    // Guard: already reserved?
    if (prop.reserved) {
      throw new Error('Ce bien est déjà réservé par un autre agent. Veuillez initier une demande de transfert.');
    }

    // Reserve property
    prop.reserved = true;
    prop.ownerId = this.currentAgentId;
    this.saveProperties();

    const contact = this.contacts.find(c => c.id === contactId) || this.contacts[0];
    const dealId = 'deal-' + Date.now();
    const dealPrice = prop.price;
    const commAmt = Math.floor(dealPrice * 0.03); // Standard 3% commission

    const newDeal: Deal = {
      id: dealId,
      reference: nextReference(this.deals, 'DEAL'),
      propertyId: propertyId,
      contactId: contactId,
      ownerId: this.currentAgentId,
      stage: customStage,
      commissionStatus: 'brouillon',
      commissionAmount: commAmt,
      title: `deal - ${prop.title} - ${prop.city}`,
      price: dealPrice,
      notes: ['Dossier prospect créé.'],
      tasks: [],
      activities: [
        {
          id: 'act-' + Date.now(),
          type: 'creation',
          text: `Création du deal rattaché à ${contact.name}`,
          date: new Date().toISOString().split('T')[0],
          agentId: this.currentAgentId,
          agentName: this.getCurrentAgent().name
        }
      ]
    };

    this.deals.unshift(newDeal);
    this.saveDeals();

    this.createAuditLog('Création Deal', `Deal ${dealId} associé au bien "${prop.title}" par ${this.getCurrentAgent().name}.`);
    
    // Add default tasks
    this.createTask({
      id: 'task-' + Date.now() + '-1',
      title: `Vérification technique de la villa ${prop.city}`,
      date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      time: '14:00',
      priority: 'moyenne',
      agentId: this.currentAgentId,
      propertyId: propertyId,
      dealId: dealId,
      place: prop.city
    });

    window.dispatchEvent(new CustomEvent('ip-state-changed'));
    return newDeal;
  }

  public moveDealStage(dealId: string, newStage: DealStage) {
    const deal = this.deals.find(d => d.id === dealId);
    if (deal) {
      const oldStage = deal.stage;
      if (oldStage !== newStage) {
        deal.stage = newStage;
        
        // Add activity
        deal.activities.unshift({
          id: 'act-' + Date.now(),
          type: 'stage_change',
          text: `Statut modifié de "${oldStage}" à "${newStage}"`,
          date: new Date().toISOString().split('T')[0],
          agentId: this.currentAgentId,
          agentName: this.getCurrentAgent().name
        });

        // Log
        this.createAuditLog(
          'Pipeline Déplacement', 
          `Le deal "${deal.title}" est passé de "${oldStage}" à "${newStage}".`
        );

        // Manage commission rules
        if (newStage === 'Bien vendu') {
          deal.commissionStatus = 'payable';
          this.addNotification(
            'commission_ready',
            'Commission de vente prête !',
            `Le bien rattaché au deal "${deal.title}" est vendu. Commission de ${deal.commissionAmount.toLocaleString()}€ débloquée.`,
            '#admin'
          );
          
          // Verify or update commission objects
          const prop = this.getProperty(deal.propertyId);
          this.commissions.push({
            id: 'comm-' + Date.now(),
            dealId: deal.id,
            agentId: deal.ownerId,
            amount: deal.commissionAmount,
            status: 'payable',
            date: new Date().toISOString().split('T')[0],
            propertyTitle: prop?.title || 'Bien',
            agentName: MOCK_AGENTS.find(a => a.id === deal.ownerId)?.name || 'Agent'
          });
          this.saveCommissions();

        } else if (newStage === 'Mandat signé' || newStage === 'Mandat potentiel') {
          // Add drafted commission
          const prop = this.getProperty(deal.propertyId);
          const exists = this.commissions.some(c => c.dealId === dealId);
          if (!exists) {
            this.commissions.push({
              id: 'comm-' + Date.now(),
              dealId: deal.id,
              agentId: deal.ownerId,
              amount: deal.commissionAmount,
              status: 'brouillon',
              date: new Date().toISOString().split('T')[0],
              propertyTitle: prop?.title || 'Bien',
              agentName: MOCK_AGENTS.find(a => a.id === deal.ownerId)?.name || 'Agent'
            });
            this.saveCommissions();
          }
        } else if (newStage === 'Perdu') {
          // Free property!
          const prop = this.properties.find(p => p.id === deal.propertyId);
          if (prop) {
            prop.reserved = false;
            prop.ownerId = null;
            this.saveProperties();
          }
        }

        this.saveDeals();
        window.dispatchEvent(new CustomEvent('ip-state-changed'));
      }
    }
  }

  public registerNoteToDeal(dealId: string, noteText: string) {
    const deal = this.deals.find(d => d.id === dealId);
    if (deal) {
      deal.notes.unshift(noteText);
      // activity
      deal.activities.unshift({
        id: 'act-' + Date.now(),
        type: 'note',
        text: `Consultation Note ajoutée par l'agent: "${noteText}"`,
        date: new Date().toISOString().split('T')[0],
        agentId: this.currentAgentId,
        agentName: this.getCurrentAgent().name
      });
      this.saveDeals();
      this.createAuditLog('Note Deal', `Ajout note au deal "${deal.title}".`);
      window.dispatchEvent(new CustomEvent('ip-state-changed'));
    }
  }

  public createDealNextAction(
    dealId: string,
    title: string,
    options: Partial<Omit<Task, 'id' | 'title' | 'done' | 'dealId'>> = {}
  ): Task {
    const deal = this.deals.find(d => d.id === dealId);
    if (!deal) throw new Error('Deal not found');

    const property = this.getProperty(deal.propertyId);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const task = this.createTask({
      title,
      date: options.date ?? tomorrow,
      time: options.time ?? '09:00',
      priority: options.priority ?? 'moyenne',
      agentId: options.agentId ?? this.currentAgentId,
      propertyId: options.propertyId ?? deal.propertyId,
      dealId,
      contactId: options.contactId ?? deal.contactId,
      place: options.place ?? property?.city,
    });

    deal.activities.unshift({
      id: 'act-' + Date.now() + '-next',
      type: 'task_done',
      text: `Prochaine action ajoutée : "${title}"`,
      date: new Date().toISOString().split('T')[0],
      agentId: this.currentAgentId,
      agentName: this.getCurrentAgent().name,
      entityType: 'task',
      entityId: task.id,
    });
    this.saveDeals();
    this.createAuditLog('Action Deal', `Prochaine action créée sur le deal "${deal.title}".`);
    window.dispatchEvent(new CustomEvent('ip-state-changed'));
    return task;
  }

  public linkDealToContact(dealId: string, contactId: string): Contact | undefined {
    const deal = this.deals.find(d => d.id === dealId);
    const contact = this.contacts.find(c => c.id === contactId);
    if (!deal || !contact) return undefined;

    const previousContact = this.contacts.find(c => c.id === deal.contactId);
    if (previousContact) {
      previousContact.assignedDeals = previousContact.assignedDeals.filter(id => id !== dealId);
    }

    deal.contactId = contactId;
    if (!contact.assignedDeals.includes(dealId)) contact.assignedDeals.push(dealId);
    if (!contact.assignedProperties.includes(deal.propertyId)) contact.assignedProperties.push(deal.propertyId);

    deal.activities.unshift({
      id: 'act-' + Date.now() + '-contact',
      type: 'contact',
      text: `Contact lié au deal : ${contact.name}`,
      date: new Date().toISOString().split('T')[0],
      agentId: this.currentAgentId,
      agentName: this.getCurrentAgent().name,
      entityType: 'contact',
      entityId: contactId,
    });

    this.saveContacts();
    this.saveDeals();
    this.createAuditLog('Contact Deal', `Le contact "${contact.name}" a été lié au deal "${deal.title}".`);
    window.dispatchEvent(new CustomEvent('ip-state-changed'));
    return contact;
  }

  public linkDealToProperty(dealId: string, propertyId: number): Property | undefined {
    const deal = this.deals.find(d => d.id === dealId);
    const property = this.properties.find(p => p.id === propertyId);
    if (!deal || !property) return undefined;

    const previousPropertyId = deal.propertyId;
    deal.propertyId = propertyId;
    deal.price = property.price;
    deal.commissionAmount = Math.floor(property.price * 0.03);
    deal.title = `deal - ${property.title} - ${property.city}`;

    const previousPropertyStillUsed = this.deals.some(d => d.id !== dealId && d.propertyId === previousPropertyId);
    const previousProperty = this.properties.find(p => p.id === previousPropertyId);
    if (previousProperty && !previousPropertyStillUsed) {
      previousProperty.reserved = false;
      previousProperty.ownerId = null;
      previousProperty.status = 'disponible';
    }

    property.reserved = true;
    property.ownerId = deal.ownerId;
    property.status = 'réservé';

    const contact = this.contacts.find(c => c.id === deal.contactId);
    if (contact && !contact.assignedProperties.includes(propertyId)) {
      contact.assignedProperties.push(propertyId);
    }

    this.tasks.forEach((task) => {
      if (task.dealId === dealId) task.propertyId = propertyId;
    });

    deal.activities.unshift({
      id: 'act-' + Date.now() + '-property',
      type: 'status_change',
      text: `Bien lié au deal : ${property.title}`,
      date: new Date().toISOString().split('T')[0],
      agentId: this.currentAgentId,
      agentName: this.getCurrentAgent().name,
      entityType: 'property',
      entityId: propertyId,
    });

    this.saveProperties();
    this.saveContacts();
    this.saveTasks();
    this.saveDeals();
    this.createAuditLog('Bien Deal', `Le bien "${property.title}" a été lié au deal "${deal.title}".`);
    window.dispatchEvent(new CustomEvent('ip-state-changed'));
    return property;
  }

  public markDealMilestone(dealId: string, milestone: 'rdv' | 'offre' | 'mandat_potentiel'): Deal | undefined {
    const stageByMilestone: Record<typeof milestone, DealStage> = {
      rdv: 'Visite',
      offre: 'Proposition',
      mandat_potentiel: 'Mandat potentiel',
    };
    const labelByMilestone: Record<typeof milestone, string> = {
      rdv: 'RDV marqué',
      offre: 'Offre marquée',
      mandat_potentiel: 'Mandat potentiel marqué',
    };

    const nextStage = stageByMilestone[milestone];
    this.moveDealStage(dealId, nextStage);

    const deal = this.deals.find(d => d.id === dealId);
    if (!deal) return undefined;

    deal.activities.unshift({
      id: 'act-' + Date.now() + '-' + milestone,
      type: 'status_change',
      text: labelByMilestone[milestone],
      date: new Date().toISOString().split('T')[0],
      agentId: this.currentAgentId,
      agentName: this.getCurrentAgent().name,
    });
    this.saveDeals();
    this.createAuditLog('Jalon Deal', `${labelByMilestone[milestone]} sur "${deal.title}".`);
    window.dispatchEvent(new CustomEvent('ip-state-changed'));
    return deal;
  }

  // CONTACT SERVICES
  public getContacts(): Contact[] {
    return this.contacts;
  }

  public getContact(id: string): Contact | undefined {
    return this.contacts.find(c => c.id === id);
  }

  public getContactByReference(reference: string): Contact | undefined {
    return this.contacts.find(c => c.reference === reference);
  }

  public getContactDeals(contactId: string): Deal[] {
    return this.deals.filter((deal) => deal.contactId === contactId);
  }

  public getContactProperties(contactId: string): Property[] {
    const contact = this.getContact(contactId);
    const propertyIds = new Set<number>([
      ...(contact?.assignedProperties ?? []),
      ...this.getContactDeals(contactId).map((deal) => deal.propertyId),
    ]);

    return this.properties.filter((property) => propertyIds.has(property.id));
  }

  public getContactTasks(contactId: string): Task[] {
    return this.tasks.filter((task) => task.contactId === contactId);
  }

  public getContactActivities(contactId: string): Activity[] {
    return this.getContactDeals(contactId)
      .flatMap((deal) => deal.activities)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  public getContactRelations(contactId: string): ContactRelations | undefined {
    const contact = this.getContact(contactId);
    if (!contact) return undefined;

    return {
      contact,
      properties: this.getContactProperties(contactId),
      deals: this.getContactDeals(contactId),
      tasks: this.getContactTasks(contactId),
      activities: this.getContactActivities(contactId),
    };
  }

  public createContact(c: Omit<Contact, 'id' | 'reference' | 'assignedDeals' | 'assignedProperties'>): Contact {
    const id = 'c' + (this.contacts.length + 1);
    const newContact: Contact = {
      ...c,
      id,
      reference: nextReference(this.contacts, 'CTC'),
      assignedDeals: [],
      assignedProperties: []
    };
    this.contacts.push(newContact);
    this.saveContacts();
    this.createAuditLog('Création Contact', `Nouveau contact inséré: ${newContact.name}.`);
    window.dispatchEvent(new CustomEvent('ip-state-changed'));
    return newContact;
  }

  public assignNoteToContact(contactId: string, note: string) {
    const contact = this.contacts.find(c => c.id === contactId);
    if (contact) {
      if (!contact.notes) contact.notes = [];
      contact.notes.unshift(note);
      this.saveContacts();
      window.dispatchEvent(new CustomEvent('ip-state-changed'));
    }
  }

  // TASK SERVICES
  public getTasks(): Task[] {
    return this.tasks;
  }

  public getTask(id: string): Task | undefined {
    return this.tasks.find((task) => task.id === id);
  }

  public getOpenTasks(): Task[] {
    return this.tasks.filter((task) => !task.done);
  }

  public getTasksForDate(date: string): Task[] {
    return this.tasks
      .filter((task) => task.date === date)
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  public getTasksForAgent(agentId: string = this.currentAgentId): Task[] {
    return this.tasks.filter((task) => task.agentId === agentId);
  }

  public createTask(t: Omit<Task, 'id' | 'done'> & { id?: string }): Task {
    const id = t.id || 'task-' + Date.now();
    const newTask: Task = {
      ...t,
      id,
      done: false
    };
    this.tasks.unshift(newTask);
    this.saveTasks();

    // If attached to a deal, update deal active list
    if (t.dealId) {
      const deal = this.deals.find(d => d.id === t.dealId);
      if (deal) {
        if (!deal.tasks) deal.tasks = [];
        deal.tasks.push(id);
        this.saveDeals();
      }
    }

    this.createAuditLog('Création Tâche', `Tâche créée: "${newTask.title}" pour l'agent ${newTask.agentId}.`);
    window.dispatchEvent(new CustomEvent('ip-state-changed'));
    return newTask;
  }

  public createManualTask(input: {
    title: string;
    date: string;
    time: string;
    priority?: Task['priority'];
    propertyId?: number | null;
    dealId?: string | null;
    contactId?: string | null;
    place?: string;
  }): Task {
    return this.createTask({
      title: input.title,
      date: input.date,
      time: input.time,
      priority: input.priority ?? 'moyenne',
      agentId: this.currentAgentId,
      propertyId: input.propertyId ?? null,
      dealId: input.dealId ?? null,
      contactId: input.contactId ?? null,
      place: input.place,
    });
  }

  public updateTask(
    taskId: string,
    updates: Partial<Pick<Task, 'title' | 'date' | 'time' | 'priority' | 'propertyId' | 'dealId' | 'contactId' | 'place'>>
  ): Task | undefined {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return undefined;

    Object.assign(task, updates);
    this.saveTasks();
    this.createAuditLog('Modification Tâche', `Tâche mise à jour: "${task.title}".`);
    window.dispatchEvent(new CustomEvent('ip-state-changed'));
    return task;
  }

  public toggleTask(taskId: string) {
    const t = this.tasks.find(tk => tk.id === taskId);
    if (t) {
      t.done = !t.done;
      this.saveTasks();

      if (t.dealId && t.done) {
        const deal = this.deals.find(d => d.id === t.dealId);
        if (deal) {
          deal.activities.unshift({
            id: 'act-' + Date.now(),
            type: 'task_done',
            text: `Tâche validée : "${t.title}"`,
            date: new Date().toISOString().split('T')[0],
            agentId: this.currentAgentId,
            agentName: this.getCurrentAgent().name
          });
          this.saveDeals();
        }
      }

      this.createAuditLog('Mise à jour Tâche', `La tâche "${t.title}" a été marquée comme ${t.done ? 'terminée' : 'en cours'}.`);
      window.dispatchEvent(new CustomEvent('ip-state-changed'));
    }
  }

  // SIGNALS (INBOX OPPORTUNITIES)
  public getSignals(): PropertySignal[] {
    return this.signals;
  }

  public getSignal(id: string): PropertySignal | undefined {
    return this.signals.find((signal) => signal.id === id);
  }

  public getActiveSignals(): PropertySignal[] {
    return this.signals.filter((signal) => !signal.ignoredByAgents.includes(this.currentAgentId) && signal.status !== 'ignoré');
  }

  public getSignalsByType(type: PropertySignal['type']): PropertySignal[] {
    return this.getActiveSignals().filter((signal) => signal.type === type);
  }

  public ignoreSignal(signalId: string) {
    const sig = this.signals.find(s => s.id === signalId);
    if (sig) {
      if (!sig.ignoredByAgents) sig.ignoredByAgents = [];
      if (!sig.ignoredByAgents.includes(this.currentAgentId)) sig.ignoredByAgents.push(this.currentAgentId);
      sig.status = 'ignoré';
      this.saveSignals();
      
      this.createAuditLog('Signal Ignoré', `Le signal "${sig.heading}" a été archivé par l'agent.`);
      window.dispatchEvent(new CustomEvent('ip-state-changed'));
    }
  }

  // TRANSFER SERVICE
  public getTransfers(): TransferRequest[] {
    return this.transfers;
  }

  public createTransferRequest(propertyId: number, dealId: string, toAgentId: string): TransferRequest {
    // Current owner is the transferee
    const prop = this.properties.find(p => p.id === propertyId);
    const fromAgentId = prop?.ownerId || 'adam';
    
    // Guard: already requested and pending?
    const exists = this.transfers.some(t => t.propertyId === propertyId && t.status === 'en_attente');
    if (exists) {
      throw new Error(`Une demande de transfert est déjà en attente sur ce bien.`);
    }

    const id = 'tr-' + Date.now();
    const request: TransferRequest = {
      id,
      propertyId,
      dealId,
      fromAgentId, // Owner current
      toAgentId,   // Requestor (usually thomas / me)
      status: 'en_attente',
      date: new Date().toISOString().split('T')[0]
    };

    this.transfers.unshift(request);
    this.saveTransfers();

    // Mark deal of current owner with transfer flag
    const deal = this.deals.find(d => d.id === dealId);
    if (deal) {
      deal.activeTransferId = id;
      this.saveDeals();
    }

    // Add alert notification for the transferee
    const agentSender = MOCK_AGENTS.find(a => a.id === toAgentId)?.name || 'Un autre agent';
    this.addNotification(
      'transfer_pending',
      'Portefeuille : Demande de transfert',
      `${agentSender} sollicite la reprise du deal "${prop?.title}". Action requise.`,
      deal?.reference ? `#pipeline?deal=${encodeURIComponent(deal.reference)}` : `#pipeline?dealId=${dealId}`,
      fromAgentId // Specific target agent id
    );

    this.createAuditLog('Demande Transfert', `Demande de transfert de ${fromAgentId} vers ${toAgentId} pour le bien "${prop?.title}".`);
    window.dispatchEvent(new CustomEvent('ip-state-changed'));
    return request;
  }

  public handleTransferRequest(requestId: string, status: Extract<TransferStatus, 'accepté' | 'refusé'>) {
    const tr = this.transfers.find(tObject => tObject.id === requestId);
    if (tr) {
      tr.status = status;
      this.saveTransfers();

      const prop = this.properties.find(p => p.id === tr.propertyId);
      const deal = this.deals.find(d => d.id === tr.dealId);

      if (deal) {
        deal.activeTransferId = null;
      }

      const originalOwnerName = MOCK_AGENTS.find(a => a.id === tr.fromAgentId)?.name || 'Ancien agent';
      const receiverName = MOCK_AGENTS.find(a => a.id === tr.toAgentId)?.name || 'Nouvel agent';

      if (status === 'accepté') {
        // Change property ownership
        if (prop) {
          prop.ownerId = tr.toAgentId;
          this.saveProperties();
        }

        // Change deal ownership
        if (deal) {
          deal.ownerId = tr.toAgentId;
          deal.activities.unshift({
            id: 'act-' + Date.now(),
            type: 'transfer',
            text: `Dossier transféré de ${originalOwnerName} à ${receiverName}. Accès accordé.`,
            date: new Date().toISOString().split('T')[0],
            agentId: this.currentAgentId,
            agentName: this.getCurrentAgent().name
          });
          this.saveDeals();
        }

        // Send notifications
        this.addNotification(
          'transfer_accepted',
          'Transfert de dossier validé',
          `Le transfert de la fiche "${prop?.title}" a été accepté par ${originalOwnerName}.`,
          deal?.reference ? `#pipeline?deal=${encodeURIComponent(deal.reference)}` : `#pipeline?dealId=${tr.dealId}`,
          tr.toAgentId
        );

        this.createAuditLog('Transfert Accepté', `Dossier "${prop?.title}" officiellement transféré de ${originalOwnerName} à ${receiverName}.`);

      } else {
        // Declined
        this.addNotification(
          'transfer_refused',
          'Transfert de dossier refusé',
          `${originalOwnerName} a décliné le transfert du bien "${prop?.title}".`,
          '#biens',
          tr.toAgentId
        );

        this.createAuditLog('Transfert Refusé', `Dossier "${prop?.title}" refusé par ${originalOwnerName} pour ${receiverName}.`);
      }

      this.saveDeals();
      window.dispatchEvent(new CustomEvent('ip-state-changed'));
    }
  }

  public getPipelineStages(): PipelineStage[] {
    const stored = localStorage.getItem('ip_pipeline_stages');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {}
    }
    return [
      { id: 'nouveau', name: 'Nouveau', icon: '✦', color: '#C67A13' },
      { id: 'qualifie', name: 'Qualifié', icon: '👤', color: 'var(--forest)' },
      { id: 'contact', name: 'Contact', icon: '📞', color: '#2B3A8C' },
      { id: 'visite', name: 'Visite', icon: '👁', color: '#8F55C9' },
      { id: 'proposition', name: 'Proposition', icon: '📝', color: '#2B3A8C' },
      { id: 'mandat', name: 'Mandat potentiel', icon: '✍️', color: 'var(--forest)' },
      { id: 'vendu', name: 'Bien vendu', icon: '🔑', color: '#C67A13' },
      { id: 'perdu', name: 'Perdu', icon: '✕', color: '#C0553D' },
    ];
  }

  public savePipelineStages(stages: PipelineStage[]) {
    localStorage.setItem('ip_pipeline_stages', JSON.stringify(stages));
    this.createAuditLog('Admin Configuration', 'Les étapes du pipeline de vente ont été mises à jour.');
    window.dispatchEvent(new CustomEvent('ip-state-changed'));
  }

  // NOTIFICATION SERVICES
  public getNotifications(): Notification[] {
    return this.notifications.filter((notification) => !notification.agentId || notification.agentId === this.currentAgentId);
  }

  public addNotification(type: NotificationType, title: string, text: string, actionLink: string, specificAgentId?: string) {
    const id = 'not-' + Date.now();
    const newNotif: Notification = {
      id,
      type,
      title,
      text,
      date: 'À l\'instant',
      read: false,
      actionLink,
      agentId: specificAgentId
    };

    this.notifications.unshift(newNotif);
    this.saveNotifications();
    
    window.dispatchEvent(new CustomEvent('ip-notification-received', { detail: newNotif }));
    window.dispatchEvent(new CustomEvent('ip-state-changed'));
  }

  public markNotificationRead(id: string) {
    const not = this.notifications.find(n => n.id === id);
    if (not) {
      not.read = true;
      this.saveNotifications();
      window.dispatchEvent(new CustomEvent('ip-state-changed'));
    }
  }

  public markAllNotificationsRead() {
    this.notifications.forEach(n => n.read = true);
    this.saveNotifications();
    window.dispatchEvent(new CustomEvent('ip-state-changed'));
  }

  // COMMISSION SERVICES
  public getCommissions(): Commission[] {
    return this.commissions;
  }

  public updateCommissionStatus(commissionId: string, status: CommissionStatus) {
    const comm = this.commissions.find(c => c.id === commissionId);
    if (comm) {
      const old = comm.status;
      comm.status = status;
      this.saveCommissions();

      // update deal state too if linked
      const deal = this.deals.find(d => d.id === comm.dealId);
      if (deal) {
        deal.commissionStatus = status;
        this.saveDeals();
      }

      this.createAuditLog(
        'Commission Mise à jour',
        `Mise à jour de la commission pour ${comm.propertyTitle} : passée de "${old}" à "${status}".`
      );
      window.dispatchEvent(new CustomEvent('ip-state-changed'));
    }
  }

  // AUDIT LOGS
  public getAuditLogs(): AuditLog[] {
    return this.auditLogs;
  }

  public createAuditLog(action: string, details: string) {
    const newLog: AuditLog = {
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      action,
      agentName: this.getCurrentAgent().name,
      details
    };
    this.auditLogs.unshift(newLog);
    this.saveAuditLogs();
    
    // Dispatch general event for reload
    window.dispatchEvent(new CustomEvent('ip-log-added'));
  }
}

// Global Store Singleton
if (!(window as any).ImmoPilotStore) {
  (window as any).ImmoPilotStore = new ImmoPilotStore();
}

export const store = (window as any).ImmoPilotStore as ImmoPilotStore;
