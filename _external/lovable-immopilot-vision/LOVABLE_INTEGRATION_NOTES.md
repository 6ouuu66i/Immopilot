# ImmoPilot — Lovable Integration Notes

> Cible : repo React 19 + Vite + TS + Tailwind v4 + Lucide, sans backend.
> Objectif : intégrer cette refonte page par page dans le repo existant sans casser le store métier.

---

## 1. Résumé global

La refonte est **une seule SPA monolithique** (`src/components/ImmoPilotApp.tsx`, ~1 180 lignes) associée à **une seule feuille de style** (`src/styles/immopilot.css`, ~2 950 lignes). Elle simule un workspace CRM immobilier avec 4 sections navigables via un state local (`route`), aucune vraie route TanStack pour ces sous-pages.

- Stack utilisée dans la sandbox : React 19, TypeScript, Vite, Tailwind v4 (uniquement pour la page 404 racine — **la refonte elle-même n'utilise pas Tailwind**), CSS custom avec design tokens en `:root`, Lucide React pour les icônes.
- Pas de shadcn, pas de Radix, pas de Zustand, pas de React Router DOM, pas de TanStack Table dans la refonte. TanStack Router n'est utilisé que pour la route `/` du template.
- Pas de backend. Toutes les données sont mockées dans le même fichier.
- Fonts chargées via `<link>` dans `__root.tsx` (Google Fonts : Archivo, Inter, JetBrains Mono).
- Le fichier CSS est le vrai design system. À traiter comme du code de production.

**Ce qui est réellement fonctionnel** : navigation entre sections, sélection d'un bien/deal/contact, ouverture/fermeture de la mini-fiche latérale, carrousel photos, favoris (state local), collapse sidebar. **Ce qui est mocké** : recherche, filtres, tri, création, drag & drop Kanban, notifications, sync.

---

## 2. Arborescence

```
src/
├── components/
│   ├── ImmoPilotApp.tsx      ← TOUTE la refonte (pages, composants, mocks)
│   └── ui/                   ← shadcn du template, NON utilisé par la refonte
├── routes/
│   ├── __root.tsx            ← charge fonts + CSS global, monte QueryClient
│   ├── index.tsx             ← route "/" → <ImmoPilotApp />
│   └── README.md
├── styles/
│   └── immopilot.css         ← design system + tous les styles de la refonte
├── styles.css                ← Tailwind v4 + tokens shadcn (utilisé UNIQUEMENT par la 404)
├── router.tsx
├── start.ts
├── server.ts
├── hooks/
├── lib/
└── routeTree.gen.ts          ← généré, ne pas éditer
```

**À copier dans le repo cible** :
- `src/components/ImmoPilotApp.tsx` (à découper, voir §9)
- `src/styles/immopilot.css` (à conserver globalement dans un premier temps)
- `<link>` Google Fonts dans le `<head>` de l'app cible

**À ignorer** :
- `src/components/ui/*` (shadcn du template, pas référencé)
- `src/styles.css` (Tailwind, pas utilisé par la refonte)
- Fichiers TanStack (`router.tsx`, `start.ts`, `server.ts`, `routeTree.gen.ts`)

---

## 3. Types de données

Tous dans `ImmoPilotApp.tsx` lignes 41–138. À déplacer dans `src/types/immopilot.ts`.

```ts
export type Route = 'dashboard' | 'biens' | 'pipeline' | 'contacts';
export type PropertyStatus = 'Disponible' | 'Reserve' | 'Archive';
export type Stage = 'A analyser' | 'A contacter' | 'Contacte' | 'RDV' | 'Mandat potentiel';

export interface PriceEvent { date: string; from?: number; to: number; label: string; delta?: string }
export interface Listing { platform: string; ref: string; publishedAt: string }

export interface Property {
  // --- champs NÉCESSAIRES à l'UI (card + toolbar) ---
  id: number;
  title: string;
  city: string;
  type: string;                    // 'Maison' | 'Appartement' | 'Villa' | 'Terrain' ...
  price: number;
  previousPrice: number;
  source: string;                  // 'Immoweb' | 'Zimmo' | 'Immovlan' | 'Biddit' ...
  seller: 'Particulier' | 'Agence' | 'Notaire';
  score: number;                   // 0-100, drive le ScoreRing et le tier hot/warm/cool
  status: PropertyStatus;
  nextAction: string;
  lastSeen: string;                // libre, ex. 'auj.' | '6 j'
  surface: number;                 // m²
  bedrooms: number;
  daysOnline: number;
  signal: string;                  // legacy, fallback si `primarySignal` absent
  image: string;                   // photo principale (URL)

  // --- champs OPTIONNELS utilisés par la mini-fiche ---
  photos?: string[];               // galerie carrousel
  signals?: string[];              // badges secondaires
  primarySignal?: string;          // badge principal (remplace `signal`)
  tag?: string;                    // fallback pour primarySignal
  opportunityReason?: string;      // texte AI résumé
  publishedDays?: number;
  fsbo?: boolean;                  // For Sale By Owner
  bathrooms?: number;
  publishedAgo?: string;           // ex. 'il y a 2h'
  photosCount?: number;            // total réel (pour le badge +14)
  aiSummary?: string;
  tags?: string[];
  terrain?: number;                // m²
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
  listings?: Listing[];            // détection multi-plateformes
  sellerName?: string;
  sellerPhone?: string;
  sellerEmail?: string;

  // --- relations ---
  contactId?: string;
}

export interface Deal {
  id: string;
  reference: string;               // 'DL-2401'
  title: string;
  propertyId: number;              // → Property.id
  contactId: string;               // → Contact.id
  ownerId: string;                 // → Agent.id
  stage: Stage;
  value: number;
  price: number;
  commission: number;              // €
  commissionAmount: number;
  nextAction: string;
}

export interface Contact {
  id: string;
  name: string;
  role: string;                    // 'Proprietaire vendeur' | 'Prospect acheteur' ...
  phone: string;
  email: string;
  status: string;                  // 'A relancer' | 'Client actif' | 'Nouveau'
  properties: number[];            // → Property.id[]
  deals: string[];                 // → Deal.id[]
  lastActivity: string;
  nextAction: string;
}

export interface Agent { id: string; name: string; avatar: string }

export interface Task {
  id: string;
  dealId: string;                  // → Deal.id
  title: string;
  dueDate: string;                 // ISO
  status: 'open' | 'done';
}
```

### Relations
```
Contact ──1..N──> Property        (Contact.properties = Property.id[])
Contact ──1..N──> Deal            (Contact.deals = Deal.id[])
Deal    ──1────> Property         (Deal.propertyId)
Deal    ──1────> Contact          (Deal.contactId)
Deal    ──1────> Agent            (Deal.ownerId)
Task    ──1────> Deal             (Task.dealId)
```

### Mocks fournis (lignes 140–357 du fichier)
- `properties: Property[]` — 4 biens (id 101–104)
- `contacts: Contact[]` — 3 contacts (ct-1, ct-2, ct-3)
- `agents: Agent[]` — 3 agents (ag-1, ag-2, ag-3), avatars `i.pravatar.cc`
- `deals: Deal[]` — 3 deals (deal-1, 2, 3)
- `tasks: Task[]` — 5 tâches, dates générées via helper `iso(offset, h, m)`
- `stages: Stage[]` — ordre des colonnes Kanban

### Champs "décoratifs" (safe à retirer)
- `Property.aiSummary`, `opportunityReason`, `marketAvgPricePerM2`, `listings`, `sellerName/Phone/Email` — utilisés uniquement dans la mini-fiche, pas dans la grille.
- `Agent.avatar` — pas rendu (avatars remplacés par initiales dans la sidebar).

### Champs **obligatoires** pour la grille de biens
`id, title, city, type, price, previousPrice, source, seller, score, status, surface, bedrooms, daysOnline, signal, image` — le reste est optionnel.

---

## 4. Design system

Tokens définis dans `src/styles/immopilot.css` lignes 1–17. **Ne pas hardcoder de couleurs ailleurs.**

### Palette

| Token | Hex / valeur | Usage |
|---|---|---|
| `--app-bg` | `#FAFAF9` | fond global du shell |
| `--surface` | `#FFFFFF` | fond cartes, panels, topbar |
| `--text` | `#101613` | texte principal |
| `--muted` | `rgba(16,22,19,0.62)` | texte secondaire |
| `--faint` | `rgba(16,22,19,0.42)` | labels, meta |
| `--border` | `rgba(16,22,19,0.14)` | bordures fines |
| `--border-strong` | `rgba(16,22,19,0.24)` | hover borders |
| `--hover` | `#F7F8F6` | fond hover subtil |
| `--green` | `#1E5A3A` | primaire (CTA, ring "hot", selected) |
| `--green-hover` | `#16442C` | hover primaire |
| `--red` | `#B3402E` | risque, urgence, delta négatif |
| `--ocre` | `#8A6D1F` | warning, ring "warm" (score 65–79) |

### Typographies (Google Fonts)

| Token | Famille | Usage |
|---|---|---|
| `--title` | **Archivo** 500/600/700 | h1, h2, KPI values, prix |
| `--sans` | **Inter** 400/500/600/700 | body, UI |
| `--mono` | **JetBrains Mono** 500/700 | scores, chiffres tabulaires, refs, labels caps |

Charger via `<link>` dans le `<head>` (voir `src/routes/__root.tsx` ligne 92-95). **Ne pas** `@import` d'URL dans le CSS (Tailwind v4 / Lightning CSS bloque).

### Échelle typographique (approximative, extraite du CSS)

| Niveau | Font-size | Font-family |
|---|---|---|
| Page title (h1) | 24–28px | title |
| Section title (h2) | 15–17px | title |
| Card title (h3) | 15px | sans, 600 |
| KPI value | 26–32px | title, 700 |
| Body | 13–14px | sans |
| Meta / secondary | 12px | sans, muted |
| Labels caps | 10px, uppercase, letter-spacing 0.08em | mono |
| Badges / pills | 11px | mono |
| Kbd (⌘K) | 11px | mono |

### Spacing scale
Multiples de 4 : 4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 24 / 32.

### Border radius
- **3–4px** partout (cards, boutons, inputs, badges) — style "brutaliste léger". Éviter les `rounded-lg` shadcn.
- Score ring et avatars : `50%`.

### Shadows
- Repos : aucun (design flat).
- Hover card : `0 8px 22px -14px rgba(16,22,19,.35), 0 2px 4px -2px rgba(16,22,19,.06)`
- Panel latéral : bordure gauche `1px var(--border)`, pas d'ombre.

### États
- **Hover** : `border-color: var(--border-strong)`, fond `--hover`, léger `translateY(-2px)` sur les PropertyCards.
- **Selected** : `border-color: var(--green)`, `box-shadow: inset 0 0 0 1px var(--green)`, fond `#f7faf8`.
- **Active button primaire** : fond `--green-hover`.
- **Tiers score** : `.tier-hot` (≥80, vert), `.tier-warm` (65-79, ocre), `.tier-cool` (<65, faint).

### Empty states
**Absents de la refonte** — à créer côté repo cible (grille vide, panel vide, kanban vide). Pattern suggéré : icône lucide 32px `--faint` + libellé 13px + CTA secondaire.

### Panel / mini-fiche
- Largeur fixe (~380–420px selon `.detail-panel`).
- Toujours à droite du main content.
- Ouverture/fermeture : booléen local, pas d'animation de slide (juste `display`). **Animations ajoutées** : crossfade photos, score ring animé, stagger cards.

### Modals
**Aucune modale dans la refonte.** À créer.

### Responsive
La refonte est **desktop-only** (~1280px+). Aucun breakpoint défini pour < 900px. Prévoir un layout mobile n'est pas fait.

### Animations (ajoutées en dernière itération, fin du CSS)
- `pp-fade-up` — stagger 45ms/card sur la grille
- `pp-crossfade` — 260ms sur `.pc-photo` et `.pp-gallery img` (key-based)
- `pp-ring-draw` — 900ms sur le stroke du score ring
- Hover lift + scale(1.03) sur `.pc-photo`
- Respect `prefers-reduced-motion`

---

## 5. Composants

Tous dans **`ImmoPilotApp.tsx`** (à découper). Aucune dépendance externe hors Lucide.

### AppShell (`ImmoPilotApp`, ligne 365)
- **Props** : aucune (composant racine)
- **State** : `route`, `selectedPropertyId`, `selectedDealId`, `selectedContactId`, `sidebarCollapsed`, `propertyPanelOpen`, `dealPanelOpen`, `contactPanelOpen`
- **Structure** : `.app-shell` (flex) → `<aside class="sidebar">` + `<section class="workspace">` (topbar + page + panel)
- **Rôle** : orchestre navigation locale, sélection, ouverture panels

### Sidebar (inline dans AppShell, ligne 384)
- Brand + bouton collapse
- `<nav>` avec 4 `NavButton`
- Bloc "Vues sauvegardées" (buttons décoratifs)
- Carte agent en bas (avatar initiales + statut en ligne)
- **Classes CSS clés** : `.sidebar`, `.sidebar.collapsed`, `.brand`, `.nav-item`, `.saved-views`, `.agent-card`

### NavButton (ligne 451)
- **Props** : `icon` (Lucide), `label`, `active`, `count?`, `collapsed?`, `onClick`
- Rend l'icône, le label (sauf collapsed), un compteur `<em>`

### Topbar (inline, ligne 431)
- Recherche globale (input non fonctionnel + kbd `⌘K`)
- Sync pill décorative
- Bell notifications
- Bouton "Nouveau" (mocké)

### Dashboard (ligne 461)
- **Props** : `onOpenProperty(id)`
- KPIs (4), grille "biens chauds", timeline agent
- Utilise `Kpi`, `Sparkline`, `PropertyCard`, tâches inline

### Biens (ligne 537)
- **Props** : `selected`, `onSelect`, `panelOpen`, `onClosePanel`, `onOpenPanel`
- Tabs + Toolbar + `.property-grid` de `PropertyCard` + `PropertyPanel` conditionnel

### Pipeline (ligne 557)
- Kanban 5 colonnes (`stages`), rend `DealCard`, panel `DealPanel`
- **Pas de drag & drop réel**

### Contacts (ligne 593)
- Table simple + `ContactPanel`

### PropertyCard (ligne 709) — 🔑 composant central
- **Props** : `property: Property`, `selected`, `onClick`, `index?` (pour stagger delay)
- **State** : `carouselIndex`, `isFavorite`, `linked`
- **Structure** : `.pc-media` (img + badges + nav carrousel + favori) + `.pc-body` (titre, prix, specs, signals, contact)
- **Interactions** : click card → sélection, chevrons ← → → change photo, cœur → toggle favori
- Utilisé dans : Dashboard (biens chauds), Biens (grille)

### PropertyPanel (ligne 827) — mini-fiche 13 sections
Toutes les sections détaillées dans la spec utilisateur (header, galerie, score IA, résumé IA, prix, historique prix, caractéristiques, PEB, description, détection multi-plateformes, analyse marché, adresse, sources, vendeur, footer actions).
- Sous-composants : `MiniPanel`, `Info`, `Signal`, `Badge`, `Avatar`, `ScoreRing`

### DealCard (ligne 1108)
- Rend une carte Kanban : photo bien + titre + score + prix + commission + prochaine action + tâche urgente

### DealPanel (ligne 1013), ContactPanel (ligne 1038)
Panels latéraux similaires au PropertyPanel mais plus simples.

### Primitives réutilisables
- **Kpi** (ligne 649) — label, value, delta, tone, spark, hint
- **Sparkline** (ligne 663) — SVG inline, points normalisés
- **ScoreRing** (ligne 680) — SVG double-circle avec stroke-dashoffset animé
- **ScoreVerdict** (ligne 697) — Ring + verdict textuel
- **Badge** (ligne 1085) — tone `good | risk | watch | neutral`
- **Signal** (ligne 1077) — label + valeur + tone
- **Info** (ligne 1081) — paire label/value verticale
- **Avatar** (ligne 1089) — initiales sur cercle vert
- **Task** (ligne 1073) — checkbox + libellé + meta
- **MiniPanel** (ligne 1069) — wrapper de section avec titre + compteur
- **PageHead** (ligne 629), **Toolbar** (ligne 638)
- **`money(value)`** (ligne 359) — helper Intl.NumberFormat fr-BE
- **`taskUrgency(iso)`** (ligne 1093) — retourne `{state, label, dateLabel}`

---

## 6. Interactions à conserver

| Interaction | Où | State modifié | Statut |
|---|---|---|---|
| Click PropertyCard | Grille Biens, Dashboard | `selectedPropertyId` + `propertyPanelOpen=true` | ✅ fonctionnel |
| Click DealCard | Kanban | `selectedDealId` + `dealPanelOpen=true` | ✅ |
| Click Contact row | Contacts | `selectedContactId` + `contactPanelOpen=true` | ✅ |
| Ouvrir/fermer mini-fiche | Bouton PageHead + croix panel | `*PanelOpen` | ✅ |
| Collapse sidebar | Bouton brand | `sidebarCollapsed` | ✅ |
| Carrousel photos (card) | Chevrons dans `.pc-media` | `carouselIndex` local | ✅ + crossfade |
| Carrousel photos (panel) | Chevrons `.pp-gallery` | `idx` local | ✅ + crossfade |
| Toggle favori | Cœur PropertyCard | `isFavorite` local | ✅ visuel uniquement |
| Link contact | Bouton "Lier contact" card | `linked` local | ✅ visuel uniquement |
| Navigation route | Sidebar NavButton | `route` | ✅ |
| Recherche globale ⌘K | Topbar input | — | ❌ mocké |
| Filtres / tri / tabs | Toolbar + tabs | — | ❌ mocké |
| Drag & drop Kanban | — | — | ❌ absent |
| Créer deal / tâche / contact | Boutons "Nouveau" | — | ❌ mocké |
| Cocher tâche | `Task` component | — | ❌ statique |
| Notifications Bell | — | — | ❌ mocké |
| Responsive mobile | — | — | ❌ absent |

---

## 7. Dépendances

### npm réellement utilisées par la refonte
```json
{
  "react": "^19",
  "react-dom": "^19",
  "lucide-react": "^0.575"
}
```

### Non utilisées par la refonte (peuvent rester ou être retirées côté repo cible)
- shadcn/ui, `@radix-ui/*` — **non requis**
- `@tanstack/react-router`, `@tanstack/react-query`, `@tanstack/react-start` — spécifique au template Lovable
- `tailwindcss` v4 — **non requis** par la refonte elle-même (styles.css / Tailwind sert uniquement à la 404 racine)
- `recharts`, `embla-carousel-react`, `date-fns`, `zod`, `react-hook-form`, `cmdk`, `sonner`, `vaul`, etc.

### Icônes
Toutes de **`lucide-react`**. Liste exacte importée (ligne 3-38 de `ImmoPilotApp.tsx`) :
```
Bath, BedDouble, Bell, BriefcaseBusiness, Building2, CalendarClock,
CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle,
ContactRound, Filter, Globe, Grid2X2, Heart, Home, LayoutGrid, List,
Mail, MapPin, MessageCircle, MoreHorizontal, PanelLeftClose,
PanelLeftOpen, Phone, Plus, Ruler, Search, SlidersHorizontal, Star,
TrendingDown, UserRound, X
```

### Fonts
Google Fonts, chargées via `<link>` : **Archivo** (500/600/700), **Inter** (400/500/600/700), **JetBrains Mono** (500/700).

### Animation
Aucune lib (pas de framer-motion). Uniquement CSS keyframes définis en fin de `immopilot.css`.

---

## 8. Assets

### Images (toutes externes, remplaçables)
- **Photos biens** : `images.unsplash.com/photo-*` (~15 URLs, lignes 165–286)
- **Avatars agents** : `i.pravatar.cc/64?img=15|32|12` (ligne 330–332)
- **Photo fallback** : constante `UNSPLASH_FALLBACK` ligne 707

Aucun asset local, aucun asset généré par Lovable. Toutes les URLs sont safe à remplacer par des placeholders du repo cible (ex. `/public/mock-property-*.jpg`).

### Favicon
`/favicon.ico` — référencé dans `__root.tsx` ligne 100, du template.

---

## 9. Plan d'intégration recommandé

### Étape 0 — Préparation
- Créer `src/features/immopilot/` (ou équivalent) pour isoler la refonte.
- Copier `src/styles/immopilot.css` → `src/styles/immopilot.css` du repo cible.
- Importer ce CSS **une seule fois** au niveau du layout parent (`main.tsx`, `App.tsx`, ou route parent) : `import './styles/immopilot.css'`.
- Ajouter le `<link>` Google Fonts dans le `<head>` (`index.html` ou head de la route racine).

**Test** : les tokens `--green`, `--surface`, etc. doivent être disponibles ; les fonts Archivo/Inter/JetBrains Mono doivent se charger (Network tab).

**Risque** : conflits de CSS globaux si le repo cible utilise déjà un reset ou définit `body { margin }`. La règle `* { box-sizing: border-box }` et le style sur `body` peuvent écraser l'existant → scoper au besoin sous un `.immopilot-root` (chercher/remplacer dans le CSS).

### Étape 1 — Types & mocks
Créer :
- `src/features/immopilot/types.ts` (§3)
- `src/features/immopilot/mocks/properties.ts`, `contacts.ts`, `deals.ts`, `agents.ts`, `tasks.ts`
- `src/features/immopilot/lib/format.ts` (money, taskUrgency)

Reconnecter au store existant : mapper les types du store cible vers `Property/Contact/Deal/Task`. Les champs optionnels de `Property` peuvent rester `undefined` sans casser l'UI.

**Test** : `import { properties }` puis rendre `properties.length` — doit afficher un nombre.

### Étape 2 — Composants partagés
Extraire dans `src/features/immopilot/components/primitives/` :
- `ScoreRing.tsx`, `Sparkline.tsx`, `Badge.tsx`, `Avatar.tsx`, `Kpi.tsx`
- `Signal.tsx`, `Info.tsx`, `MiniPanel.tsx`, `Task.tsx`
- `PageHead.tsx`, `Toolbar.tsx`, `NavButton.tsx`

**Test** : render isolé de chaque primitive avec props minimales.

**Risque** : `taskUrgency` dépend de `new Date()`, mocker le temps dans les tests.

### Étape 3 — AppShell + Sidebar + Topbar
Créer `src/features/immopilot/AppShell.tsx` avec la sidebar + topbar. Remplacer le state local `route` par un vrai router (React Router / TanStack) selon la stack cible.

**Fichiers concernés** : `AppShell.tsx`, `Sidebar.tsx`, `Topbar.tsx`
**Test** : navigation entre `/dashboard`, `/biens`, `/pipeline`, `/contacts`, collapse sidebar persistant en `localStorage`.

### Étape 4 — Page Dashboard
Extraire `Dashboard` → `src/features/immopilot/pages/DashboardPage.tsx`. Brancher les KPIs sur le vrai store (fallback aux mocks si non dispo).

**Reconnexion** : `properties.filter(p => p.score >= 80)` → utiliser le vrai store.
**Test** : les 4 KPIs s'affichent, la sparkline rend, cliquer un bien chaud ouvre la page Biens avec ce bien sélectionné.

### Étape 5 — Page Biens
Extraire `Biens`, `PropertyCard`, `PropertyPanel` (13 sections).

**Fichiers** : `pages/BiensPage.tsx`, `components/PropertyCard.tsx`, `components/PropertyPanel/*.tsx` (découper les 13 sections en sous-composants)

**Reconnexion** : source `properties`, action `onSelect`, favori et link contact à brancher sur le store (mutations).

**Risque** : la mini-fiche est longue (~200 lignes). Découper par section (`PanelHeader`, `PanelGallery`, `PanelAIScore`, ...) pour rester maintenable.

**Test** : ouverture/fermeture panel, carrousel photos, crossfade, score ring animé au montage, favori togglable.

### Étape 6 — Contacts
Extraire `Contacts`, `ContactPanel`. Table simple → remplacer par le composant Table existant si présent, ou garder `<table>` HTML.

**Test** : sélection contact ouvre panel, données mockées visibles.

### Étape 7 — Pipeline
Extraire `Pipeline`, `DealCard`, `DealPanel`.

**À ajouter** (non couvert par la refonte) : drag & drop entre colonnes → utiliser `@dnd-kit/core` ou équivalent. La refonte se limite au visuel.

**Test** : 5 colonnes rendues, cartes cliquables, panel ouvre.

### Étape 8 — Agenda / Tâches
**Non présent dans la refonte.** Créer une page à part si nécessaire, en réutilisant `Task`, `Badge`, `taskUrgency`.

### Étape 9 — Empty states, modals, responsive
- Ajouter les empty states manquants (§4).
- Créer les modales "Nouveau bien / contact / deal" en s'appuyant sur les primitives Radix/shadcn du repo cible.
- Adapter en responsive : la sidebar devient drawer < 900px, la mini-fiche passe en overlay plein écran.

---

## 10. Points d'attention

### Données hardcodées
- Tous les mocks sont dans le même fichier. Extraire vers `mocks/` (§9 étape 1).
- IDs numériques pour `Property.id` (101–104) et string pour les autres — cohérence à revoir selon le store cible.

### Couplage
- `ImmoPilotApp.tsx` est un god-component : à découper impérativement.
- Les sous-composants lisent parfois directement `contacts`, `properties`, `agents` en top-level (ex. `PropertyCard` fait `contacts.find(...)`). À remplacer par des props ou un hook `useContact(id)`.

### Styles globaux à surveiller
- `body { margin: 0; background; color; font-family }` — peut casser un layout existant.
- `* { box-sizing: border-box }` — probablement déjà présent.
- `::-webkit-scrollbar` — style custom, à valider avec la charte cible.
- Le CSS n'est pas scopé. Envisager un préfixe `.ip-` sur toutes les classes si conflit (chercher/remplacer massif). Sinon, tout monter sous un wrapper `.immopilot-root { ... }` et wrapper le CSS via un préprocesseur.

### Responsive incomplet
Aucun `@media` en dessous de 900px. La sidebar, le kanban, la mini-fiche cassent en mobile. À traiter en étape dédiée.

### Interactions simulées
Favori, link contact, filtres, tri, recherche, drag & drop, notifications, sync : tout est visuel. Prévoir les vraies mutations côté store.

### Dépendances absentes
Si le repo cible n'a pas `lucide-react`, l'ajouter : `npm i lucide-react`. Aucune autre lib requise.

### Code à nettoyer
- Le fichier CSS contient des sections dupliquées (ex. `.property-card` défini plusieurs fois lignes 674, 1259, 1566, 1597 — historique d'itérations). Un pass de consolidation est recommandé.
- `Agent.avatar` défini mais non rendu.
- Certains champs `Property` optionnels ne sont peuplés que sur 1 seul bien (id 103) → attention aux tests avec les autres biens.

### Logique métier manquante
- Aucun scoring réel (score = valeur hardcodée).
- Pas de calcul de commission, pas de pipeline value totale (juste `deals.length`).
- `daysOnline` / `publishedAgo` non dérivés d'une date réelle.

### Duplication
- `signal` (legacy string) + `signals[]` + `primarySignal` + `tag` — 4 façons de dire la même chose. Choisir un seul champ dans le store cible et adapter le mapping.
- `price` et `value` dans `Deal` — même valeur, garder un seul champ.

### Non fait / hors périmètre
- Aucune modale.
- Pas de dark mode.
- Pas de settings / profil.
- Pas d'onboarding.
- Pas d'i18n (tout en français hardcodé).

---

## Fichiers à copier tels quels
1. `src/styles/immopilot.css` → à copier intégralement, éventuellement scoper sous `.immopilot-root`.
2. Le bloc `<link>` Google Fonts du `<head>` (voir §4).

## Fichiers à adapter (extraire depuis `ImmoPilotApp.tsx`)
Voir découpage §9. Le fichier monolithique n'est pas à copier tel quel dans un repo de production.

## Fichiers purement sandbox
- `src/routes/*`, `src/router.tsx`, `src/start.ts`, `src/server.ts`, `src/routeTree.gen.ts` — spécifique TanStack Start, à ignorer.
- `src/components/ui/*` — shadcn du template, non utilisé.
- `src/styles.css` — Tailwind base, non utilisé par la refonte.

---

_Fin du document. Généré pour intégration ImmoPilot._
