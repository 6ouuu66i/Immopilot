# AGENTS.md - ImmoPilot

Reference guide for any AI assistant working on this repo.
Update this file whenever the product direction, architecture, or design system changes.

Last updated: 2026-05-27

---

## 1. Product Vision

ImmoPilot is a premium B2B SaaS for Belgian real estate agents and agencies.

The product is not a public real-estate marketplace. It is a CRM/workspace for online prospecting, follow-up, analysis, and mandate conversion.

Core pillars:

1. Automated prospecting: detect FSBO/private-seller listings and relevant online signals across Belgian real-estate sources.
2. CRM pipeline: help agents follow opportunities from discovery to contact, appointment, mandate, lost, or archived.
3. Intelligent analysis: surface price drops, listing age, reposts, seller motivation signals, and next best actions.

Target users:

- Belgian real-estate agencies and agents.
- Primary market: French-speaking Belgium first, NL support later.
- Users who currently lose time across Immoweb, Zimmo, Immovlan, 2ememain, Biddit, Immoffice, and spreadsheets.

Commercial target: September 2026.

---

## 2. Current Phase

The project is in UI/product prototyping.

Important constraints:

- Use mock/local data only unless the user explicitly asks for backend work.
- Do not connect Supabase or any real API without explicit instruction.
- Do not implement real scoring/business algorithms unless explicitly requested.
- The scraping/data pipeline exists as a separate project and is not part of this repo.
- Current priority: build a credible, usable CRM interface and a reusable frontend foundation.

Current implementation reality:

- The app currently uses Vite + React, but many screens are raw HTML templates imported with `?raw` and injected by `src/main.tsx`.
- The refactor direction is to migrate toward proper React components, page by page.
- The first refactor batch is: AppShell, Sidebar/Header, Dashboard, and Biens.

---

## 3. Technical Stack

Actual stack in this repo:

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` plus custom CSS tokens |
| Icons | Lucide React |
| Fonts | Self-hosted `@fontsource/inter`, `@fontsource/lora`, `@fontsource/jetbrains-mono` |
| Motion | `motion` |
| Maps | Google Maps integration through `src/lib/maps.ts` |
| Store | Custom local store in `src/lib/store.ts` |
| Backend | None in this repo yet |
| Planned backend | Supabase PostgreSQL + Auth later |

Do not assume Zustand, React Router, TanStack Table, shadcn/ui, Radix, or DnD libraries are installed unless `package.json` confirms it.

Before importing any third-party dependency, check `package.json`. If missing, ask or add it only when the user has approved the implementation direction.

---

## 4. Target Product Model

ImmoPilot should behave like an object-centric CRM for real estate.

Primary objects:

- Property: canonical real-estate asset, address, type, surface, price, internal status.
- Listing: source ad, URL, platform, shown price, publication date, photos, description.
- Owner: seller/contact, identity if known, contact data, confidence, source.
- Signal: detected event such as price drop, long time online, FSBO, repost, anomaly.
- Opportunity: commercial opportunity created from one or more signals.
- Task: concrete next action: call, send letter, verify info, follow up.
- Activity: timeline entry: call, email, note, status change, interaction.
- Mandate: converted or potential mandate.

Mental model:

- Dashboard = what to look at today.
- Biens = central property database.
- Signaux = why a property is interesting now.
- Opportunites = what to work commercially.
- Contacts = who to contact.
- Taches = what to do next.
- Fiche Bien = full decision dossier.

V1 pipeline stages:

- A analyser
- A contacter
- Contacte
- RDV
- Mandat potentiel
- Perdu / Archive

---

## 5. Official Design Direction

The previous "Croquis de l'Architecte" direction is retired for production UI.

New official direction:

**Notion + Twenty CRM inspired workspace**

Target feel:

- Calm, premium, mature, and professional.
- Dense enough for daily CRM work, but not visually noisy.
- More productivity/workspace than marketing dashboard.
- Real-estate photos are contextual thumbnails, not dominant marketplace cards.
- The interface should tell the agent what to do next, not only what to look at.

Inspiration ratio:

- 60-70% Twenty CRM for CRM structure, objects, records, views, side panels, and workflow logic.
- 30-40% Notion for calm visual language, database views, detail pages, saved views, and dossier-like records.

Important: this is inspiration, not a clone.

---

## 6. Design System Tokens

Use these as the default target tokens for new React UI.

| Token | Value | Usage |
|---|---|---|
| `app-bg` | `#F7F6F3` | Global app background |
| `surface` | `#FFFFFF` | Cards, panels, table surfaces |
| `surface-muted` | `#F3F2EF` | Hover, secondary zones |
| `border` | `#E6E4DF` | Default 1px borders |
| `text-primary` | `#1F1F1F` | Main text |
| `text-secondary` | `#6B6B6B` | Meta, labels |
| `text-tertiary` | `#9A9A9A` | Low-priority text |
| `hover` | `#F1F0ED` | Row/item hover |
| `accent` | `#1F1F1F` | Primary button/action |
| `success-soft` | `#EAF7EF` | Positive badge background |
| `warning-soft` | `#FFF3D8` | Warning badge background |
| `danger-soft` | `#FDEBEC` | Hot/risk badge background |

Typography:

- Use self-hosted typography through `@fontsource`; do not add Google Fonts runtime links.
- `--notion-sans`: Inter. Main UI font for app chrome, sidebar, tables, buttons, KPIs, labels, tasks, and operational text.
- `--notion-serif`: Lora. Editorial serif reserved for large page titles and premium display moments such as the dashboard title.
- `--notion-mono`: JetBrains Mono first, Fira Code fallback. Use for structured data, keyboard hints, technical codes, aligned numeric/meta snippets, and compact operational data when useful.
- Keep Lucide React as the active app icon family. Do not use the removed `doodle icons` folder unless the user explicitly reintroduces a compatible asset pack.
- Page title: 24-28px, semibold.
- Section title: 16-18px, semibold.
- Table/body: 13-14px.
- Labels: 12-13px, medium, secondary gray.
- Badges: 11-12px, medium.
- KPI values: 24-30px, semibold, never flashy.

Shape and spacing:

- Spacing scale: 4, 8, 12, 16, 20, 24, 32.
- Radius: 6px small, 10px medium, 14px large, 16px panels.
- Border: 1px solid `#E6E4DF`.
- Shadows: none or very subtle. Panels may use `0 8px 24px rgba(0,0,0,0.08)`.

Visual rules:

- No aggressive gradients.
- No sketchy/croquis borders on new production UI.
- No multicolor KPI cards everywhere.
- No generic admin-template chrome.
- No heavy shadows or 3D effects.
- No huge real-estate photos except in gallery/detail contexts.
- One primary action per zone.
- Badges must be informative, pastel, and readable.
- Hover states must be subtle but obvious.

---

## 7. UX Architecture

Target layout:

- AppShell: global app frame.
- Sidebar: main navigation and saved views.
- Topbar/Header: global search, command entry, page-level actions.
- Main content: object views, dashboard, table, kanban, detail pages.
- RecordSidePanel: quick preview without losing context.
- RecordPage: full dossier for a property/contact/opportunity.

Recommended navigation:

- Dashboard
- Recherche
- Biens
- Contacts
- Signaux
- Opportunites
- Taches
- Mandats
- Vues sauvegardees:
  - Particuliers recents
  - Baisses de prix
  - Opportunites chaudes
  - A rappeler aujourd'hui
  - Publie depuis +60 jours
  - Sans contact trouve

Global behavior:

- Single click on a row opens/selects a side panel preview.
- Double click or explicit action opens the full record page.
- Saved views preserve useful filters.
- Each object must expose one clear primary action.
- Tables must remain fast and readable; prepare for pagination or virtualization later.

---

## 8. First Refactor Batch

The first approved implementation batch is:

1. React design system foundation.
2. React AppShell, Sidebar, Topbar/Header.
3. Dashboard rebuilt in React with the new Notion/Twenty visual language.
4. Biens page rebuilt in React as the central CRM database/table.

Other pages can remain as legacy HTML templates temporarily.

Do not attempt to refactor the whole SaaS in one pass unless the user explicitly asks for a full-batch refactor.

---

## 9. Page Specifications

### Dashboard

Goal: tell the agent what to inspect and do today.

Required zones:

- PageHeader with title and short operational subtitle.
- KPI row: hot opportunities, price drops, follow-ups due, new private sellers.
- Main left: priority opportunities.
- Main right: today's tasks.
- Secondary: latest detected signals and recent activity.

Design:

- Sober KPI cards.
- Flat surfaces and thin borders.
- Short lists, 5-8 items max per section.
- The user should see the hottest opportunities in under 5 seconds.

### Biens

Goal: central real-estate CRM database.

Required zones:

- PageHeader: Biens.
- ViewTabs: Tous, Particuliers, Baisses de prix, Chauds, Carte, Archive.
- Toolbar: search, filters, sort, columns, optional export.
- DatabaseTable.

Recommended columns:

- Thumbnail
- Adresse
- Commune
- Type
- Prix actuel
- Baisse
- Source
- Seller type
- Score
- Statut
- Prochaine action
- Last seen

Interaction:

- Click row: preview/select.
- Double click or button: open full record later.

### Fiche Bien / Side Panel

Not part of first batch unless explicitly included later.

Target structure:

- Header with address/title, commune/type, source, status, score.
- Property grid: current price, initial price, price drop, surface, bedrooms, seller type, days online, linked contact, next action.
- Sections: AI summary, price analysis, price history, signals, owner/contact, tasks, notes, timeline, photos/source.

---

## 10. Code Conventions

TypeScript:

- Prefer explicit business types.
- Avoid `any`.
- Keep domain types centralized or clearly imported.
- Add adapters when legacy mock data shape differs from target UI models.

React:

- Functional components only.
- Props typed with named interfaces: `ComponentNameProps`.
- One reusable component per focused file when practical.
- Prefer composition over page-specific duplicated markup.

Styling:

- Tailwind v4 utilities are allowed.
- CSS custom properties in `src/index.css` should hold global tokens.
- Avoid inline `style={{ }}` except for dynamic measured values or justified one-offs.
- Keep UI states: default, hover, active, selected, loading, empty, error.

State:

- Use the existing `src/lib/store.ts` unless a refactor explicitly introduces a new state layer.
- Do not mutate store data directly from components.

Legacy HTML:

- Legacy `src/pages/*.html` templates are allowed to remain during migration.
- New major UI work should prefer React components.
- Do not add more large script-heavy HTML templates unless it is a deliberate temporary bridge.

---

## 11. Licensing, References, and Code Reuse

The user authorizes using external repos as a base only when legally and technically safe.

Rules:

- It is allowed to study public repos and reproduce concepts, flows, architecture, and UI patterns.
- It is allowed to copy/adapt code from this repo or code generated specifically for ImmoPilot.
- It is allowed to copy/adapt third-party code only when the license is compatible with a closed commercial SaaS, and attribution/license requirements are preserved.
- Do not copy code, CSS, assets, tokens, or components from Notion.
- Do not copy code, CSS, assets, or tokens from Twenty CRM into this repo unless a future legal/license decision explicitly allows it.
- Do not use Twenty files marked `@license Enterprise`.
- Do not copy from repos with missing, unclear, AGPL-only, or incompatible licensing.
- The previously cloned `Lostovayne/SaaS-Notion-Clone` should be treated as inspiration only unless its license is verified as compatible.

Practical rule:

If license status is unclear, do not copy. Rebuild the pattern from scratch.

External inspiration already reviewed:

- Twenty CRM: useful for object-centric CRM thinking, side panels, records, views, workflows.
- Notion: useful for calm databases, saved views, page-like records, properties, relation/rollup concepts.
- `Lostovayne/SaaS-Notion-Clone`: useful as a small reference for sidebar/search/document-list patterns, but not a codebase to integrate.

---

## 12. Things Not To Do

- Do not bring back the "Croquis de l'Architecte" DA for new production UI.
- Do not make ImmoPilot look like a generic admin template.
- Do not turn the product into an Immoweb-style photo marketplace.
- Do not build a full Notion block editor for V1.
- Do not let users create arbitrary databases in V1.
- Do not add deep customization that makes the product vague.
- Do not branch Supabase or a real API without explicit instruction.
- Do not implement real scoring logic without explicit instruction.
- Do not silently remove TODO/FIXME comments without addressing them.

---

## 13. Environment Variables

Prepared for later Supabase work only.

```bash
# .env.local - never commit real values
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Vite exposes variables through `import.meta.env.VITE_*`, not `process.env`.

---

## 14. Verification

For UI implementation work, run when feasible:

```bash
npm run lint
npm run build
```

For frontend visual work, verify at least:

- `http://127.0.0.1:3000/#dashboard`
- `http://127.0.0.1:3000/#biens`

Check:

- Desktop and mobile layout.
- No text overflow.
- No unreadable badges.
- Search/header alignment.
- Sidebar active state.
- Row hover/selected states.
- Empty/loading/error states if the component supports them.

---

## 15. Skill Routing

When the user's request matches an available skill, invoke it.

Key routing rules:

- Product ideas / brainstorming -> `/office-hours`
- Strategy / scope -> `/plan-ceo-review`
- Architecture -> `/plan-eng-review`
- Design system / design plan -> `/design-consultation` or `/plan-design-review`
- Visual polish / rendered UI audit -> `/design-review`
- QA/testing site behavior -> `/qa` or `/qa-only`
- Bugs/errors -> `/investigate`
- Code review/diff check -> `/review`
- Full review pipeline -> `/autoplan`
- Ship/deploy/PR -> `/ship` or `/land-and-deploy`
- Save progress -> `/context-save`
- Resume context -> `/context-restore`
