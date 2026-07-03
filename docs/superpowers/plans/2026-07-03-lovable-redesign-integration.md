# Lovable Redesign Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the Lovable export as ImmoPilot's final premium DA across Dashboard, Biens, Pipeline, Contacts, and Agenda while preserving existing store-backed CRM behavior.

**Architecture:** Treat `_external/lovable-immopilot-vision` as a design/source reference, not as production code. Extract tokens, fonts, and visual patterns into the current Vite/React app, then migrate the priority pages incrementally using the existing `src/lib/store.ts` relationships and current page interactions.

**Tech Stack:** React 19, TypeScript, Vite 6, Tailwind v4 global pipeline, local store in `src/lib/store.ts`, Lucide React, self-hosted fontsource packages.

---

## File Structure Map

- Modify `package.json` and `package-lock.json`: add `@fontsource/archivo` so the Lovable typography is self-hosted.
- Modify `src/main.tsx`: import Archivo weights once next to Inter and JetBrains Mono.
- Modify `src/index.css`: add Lovable foundation tokens, typography aliases, flat radius/shadow/state variables, and page-level migration classes while avoiding a destructive rewrite.
- Modify `src/components/AppShell.tsx`: align shell, sidebar, topbar, nav, search, and active state with Lovable.
- Modify `src/components/ui/StatusBadge.tsx`: apply Lovable badge tone system.
- Modify `src/components/ui/DataToolbar.tsx`: align search/filter/action toolbar with Lovable.
- Modify `src/components/ui/ViewTabs.tsx`: align database tabs with Lovable.
- Modify `src/components/ui/RecordSidePanel.tsx`: align panel chrome with Lovable.
- Modify `src/components/ui/TaskList.tsx`: align task rows with Lovable Agenda/Dashboard treatment.
- Modify `src/components/ui/ActivityTimeline.tsx`: align activity rows with Lovable panel/timeline treatment.
- Modify `src/components/ui/EmptyState.tsx`: create calm premium empty states.
- Modify `src/components/biens/ScoreRing.tsx`: match Lovable score ring behavior and colors.
- Modify `src/components/biens/PropertyCard.tsx`: preserve current data/actions while adopting Lovable property card layout.
- Modify `src/pages/Dashboard.tsx`: rebuild using Lovable dashboard composition.
- Modify `src/pages/Biens.tsx`: remove page KPIs, keep filters/table/list behavior, apply Lovable cards and mini fiche structure.
- Modify `src/components/pipeline/KanbanBoard.tsx`: apply Lovable column/card density.
- Modify `src/components/pipeline/PipelineListView.tsx`: apply Lovable table/list treatment.
- Modify `src/components/pipeline/DealFichePanel.tsx`: align deal panel with Lovable side-panel style.
- Modify `src/components/pipeline/pipeline.css`: consolidate pipeline-specific Lovable styling only where shared CSS is insufficient.
- Modify `src/pages/Pipeline.tsx`: compose updated kanban/list/panel without functional regressions.
- Modify `src/pages/Contacts.tsx`: apply Lovable list/table and side panel treatment while keeping relation actions.
- Modify `src/pages/Agenda.tsx`: adapt current task hub to Lovable system because Lovable has no Agenda page.

## Task 1: Install And Load Lovable Typography

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/main.tsx`

- [ ] **Step 1: Add Archivo font package**

Run:

```bash
npm install @fontsource/archivo
```

Expected:

```text
added 1 package
```

- [ ] **Step 2: Import Archivo weights in the app entry**

In `src/main.tsx`, add these imports after the existing React imports and before `./index.css`:

```ts
import '@fontsource/archivo/500.css';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/700.css';
```

Expected: `src/main.tsx` imports Archivo, Inter, Lora, and JetBrains Mono without duplicate import lines.

- [ ] **Step 3: Run type check**

Run:

```bash
npm run lint
```

Expected: TypeScript completes without a new error caused by the font imports.

- [ ] **Step 4: Commit typography setup**

Run:

```bash
git add package.json package-lock.json src/main.tsx
git commit -m "style: load lovable typography"
```

## Task 2: Add Lovable Foundation Tokens Without Breaking Legacy Pages

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add the Lovable token block near the top of `src/index.css`**

Insert this block after `@import "tailwindcss";`:

```css
:root {
  --lv-app-bg: #FAFAF9;
  --lv-surface: #FFFFFF;
  --lv-surface-soft: #F7F8F6;
  --lv-text: #101613;
  --lv-muted: rgba(16, 22, 19, 0.62);
  --lv-faint: rgba(16, 22, 19, 0.42);
  --lv-border: rgba(16, 22, 19, 0.14);
  --lv-border-strong: rgba(16, 22, 19, 0.24);
  --lv-green: #1E5A3A;
  --lv-green-hover: #16442C;
  --lv-green-tint: #F1F6F3;
  --lv-red: #B3402E;
  --lv-ocre: #8A6D1F;
  --lv-font-title: 'Archivo', 'Inter', system-ui, sans-serif;
  --lv-font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --lv-font-mono: 'JetBrains Mono', 'IBM Plex Mono', Consolas, monospace;
  --lv-fs-display: 28px;
  --lv-fs-h1: 22px;
  --lv-fs-h2: 18px;
  --lv-fs-h3: 15px;
  --lv-fs-body: 13px;
  --lv-fs-meta: 12px;
  --lv-fs-micro: 11px;
  --lv-space-1: 4px;
  --lv-space-2: 8px;
  --lv-space-3: 12px;
  --lv-space-4: 16px;
  --lv-space-5: 20px;
  --lv-space-6: 24px;
  --lv-radius-xs: 2px;
  --lv-radius-sm: 3px;
  --lv-radius-md: 4px;
  --lv-radius-lg: 6px;
  --lv-shadow-card: 0 1px 2px rgba(16, 22, 19, 0.06);
  --lv-shadow-hover: 0 8px 22px -14px rgba(16, 22, 19, 0.35), 0 2px 4px -2px rgba(16, 22, 19, 0.06);
  --lv-shadow-focus: 0 0 0 3px rgba(30, 90, 58, 0.22);
  --lv-transition: 140ms ease;
  --app-bg: var(--lv-app-bg);
  --surface: var(--lv-surface);
  --surface-muted: var(--lv-surface-soft);
  --border: var(--lv-border);
  --text-primary: var(--lv-text);
  --text-secondary: var(--lv-muted);
  --text-tertiary: var(--lv-faint);
  --accent: var(--lv-green);
  --notion-sans: var(--lv-font-sans);
  --notion-mono: var(--lv-font-mono);
}
```

- [ ] **Step 2: Add Lovable base utility classes**

Append this CSS after the token block:

```css
.lv-page {
  min-height: 100%;
  background: var(--lv-app-bg);
  color: var(--lv-text);
  font-family: var(--lv-font-sans);
  letter-spacing: 0;
}

.lv-title {
  font-family: var(--lv-font-title);
  font-weight: 700;
  letter-spacing: 0;
}

.lv-mono {
  font-family: var(--lv-font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
}

.lv-surface {
  background: var(--lv-surface);
  border: 1px solid var(--lv-border);
  border-radius: var(--lv-radius-md);
  box-shadow: var(--lv-shadow-card);
}

.lv-surface-hover {
  transition: border-color var(--lv-transition), background var(--lv-transition), box-shadow var(--lv-transition), transform var(--lv-transition);
}

.lv-surface-hover:hover {
  background: var(--lv-surface-soft);
  border-color: var(--lv-border-strong);
  box-shadow: var(--lv-shadow-hover);
}
```

- [ ] **Step 3: Run type check and build**

Run:

```bash
npm run lint
npm run build
```

Expected: both commands complete successfully.

- [ ] **Step 4: Commit design foundations**

Run:

```bash
git add src/index.css
git commit -m "style: add lovable design foundations"
```

## Task 3: Align AppShell With Lovable Shell

**Files:**
- Modify: `src/components/AppShell.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Inspect current AppShell props and navigation**

Run:

```bash
rg -n "interface AppShell|function AppShell|export function AppShell|activeRoute|ip-shell|ip-sidebar|ip-topbar" src/components/AppShell.tsx src/index.css
```

Expected: output shows the current shell API and CSS selectors that must remain compatible with `src/main.tsx`.

- [ ] **Step 2: Keep the current AppShell public API**

Ensure `AppShell` still accepts the current props shape used by `src/main.tsx`:

```ts
interface AppShellProps {
  activeRoute: string;
  store: typeof store;
  children: React.ReactNode;
}
```

If the exact interface already differs, preserve the existing fields and do not require a routing rewrite.

- [ ] **Step 3: Apply Lovable shell classes**

Update shell markup so the root and major regions use this shape while preserving current route links and existing user/profile behavior:

```tsx
<div className={`ip-shell lv-page ${isCollapsed ? 'is-collapsed' : ''}`}>
  <aside className="ip-sidebar lv-shell-sidebar">
    {/* existing brand, nav groups, saved views, profile */}
  </aside>
  <section className="ip-workspace">
    <header className="ip-topbar lv-shell-topbar">
      {/* existing search, route actions, notifications */}
    </header>
    <main className="ip-main">{children}</main>
  </section>
</div>
```

- [ ] **Step 4: Add Lovable shell CSS overrides**

In `src/index.css`, add focused overrides for `.lv-shell-sidebar`, `.lv-shell-topbar`, `.ip-sidebar-link`, `.ip-icon-button`, and `.ip-main` using only `--lv-*` tokens.

Use this exact baseline:

```css
.lv-shell-sidebar {
  background: color-mix(in srgb, var(--lv-surface) 72%, transparent);
  border-right: 1px solid var(--lv-border);
  padding: var(--lv-space-4);
}

.lv-shell-topbar {
  min-height: 58px;
  border-bottom: 1px solid var(--lv-border);
  background: color-mix(in srgb, var(--lv-app-bg) 88%, transparent);
}

.ip-sidebar-link {
  border-radius: var(--lv-radius-md);
  color: var(--lv-muted);
  font-family: var(--lv-font-sans);
}

.ip-sidebar-link:hover {
  background: var(--lv-surface-soft);
  color: var(--lv-text);
}

.ip-sidebar-link.is-active {
  background: var(--lv-green-tint);
  color: var(--lv-green);
  font-weight: 650;
}
```

- [ ] **Step 5: Verify shell routes still render**

Run:

```bash
npm run lint
npm run build
```

Expected: no TypeScript errors and no missing AppShell prop errors.

- [ ] **Step 6: Commit shell alignment**

Run:

```bash
git add src/components/AppShell.tsx src/index.css
git commit -m "style: align app shell with lovable"
```

## Task 4: Convert Shared UI Primitives To Lovable DA

**Files:**
- Modify: `src/components/ui/StatusBadge.tsx`
- Modify: `src/components/ui/DataToolbar.tsx`
- Modify: `src/components/ui/ViewTabs.tsx`
- Modify: `src/components/ui/RecordSidePanel.tsx`
- Modify: `src/components/ui/TaskList.tsx`
- Modify: `src/components/ui/ActivityTimeline.tsx`
- Modify: `src/components/ui/EmptyState.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Inventory shared component class names**

Run:

```bash
rg -n "className=|StatusBadge|DataToolbar|ViewTabs|RecordSidePanel|TaskList|ActivityTimeline|EmptyState" src/components/ui
```

Expected: output identifies the class names and prop APIs to preserve.

- [ ] **Step 2: Preserve component props**

For each component, keep its exported component name and existing prop names. If a visual prop needs expansion, add an optional prop instead of renaming existing fields:

```ts
interface ExampleProps {
  className?: string;
}
```

- [ ] **Step 3: Apply Lovable badge treatment**

`StatusBadge.tsx` should render tone classes like:

```tsx
<span className={`lv-badge lv-badge-${tone} ${className ?? ''}`}>
  {children}
</span>
```

Add CSS:

```css
.lv-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 22px;
  border: 1px solid var(--lv-border);
  border-radius: 999px;
  padding: 0 8px;
  font-family: var(--lv-font-mono);
  font-size: var(--lv-fs-micro);
  font-weight: 700;
  line-height: 1;
}

.lv-badge-good {
  background: var(--lv-green-tint);
  border-color: color-mix(in srgb, var(--lv-green) 28%, transparent);
  color: var(--lv-green);
}

.lv-badge-risk {
  background: #F8EAE6;
  border-color: color-mix(in srgb, var(--lv-red) 28%, transparent);
  color: var(--lv-red);
}

.lv-badge-watch {
  background: #F8F0DA;
  border-color: color-mix(in srgb, var(--lv-ocre) 28%, transparent);
  color: var(--lv-ocre);
}

.lv-badge-neutral {
  background: var(--lv-surface-soft);
  color: var(--lv-muted);
}
```

- [ ] **Step 4: Apply Lovable toolbar and tabs treatment**

Update `DataToolbar.tsx` and `ViewTabs.tsx` markup to use `lv-toolbar`, `lv-input`, `lv-button`, and `lv-tabs` classes while keeping current handlers.

Add CSS:

```css
.lv-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--lv-space-2);
}

.lv-input,
.lv-select {
  height: 34px;
  border: 1px solid var(--lv-border);
  border-radius: var(--lv-radius-md);
  background: var(--lv-surface);
  color: var(--lv-text);
  font: 500 var(--lv-fs-body) / 1 var(--lv-font-sans);
  outline: 0;
}

.lv-input:focus,
.lv-select:focus {
  border-color: var(--lv-green);
  box-shadow: var(--lv-shadow-focus);
}

.lv-button {
  height: 34px;
  border: 1px solid var(--lv-border);
  border-radius: var(--lv-radius-md);
  background: var(--lv-surface);
  color: var(--lv-text);
  font: 700 var(--lv-fs-body) / 1 var(--lv-font-sans);
}

.lv-button-primary {
  border-color: var(--lv-green);
  background: var(--lv-green);
  color: white;
}

.lv-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
}

.lv-tab {
  min-height: 30px;
  border: 1px solid transparent;
  border-radius: var(--lv-radius-md);
  background: transparent;
  color: var(--lv-muted);
  padding: 0 10px;
  font: 700 var(--lv-fs-meta) / 1 var(--lv-font-sans);
}

.lv-tab.is-active {
  background: var(--lv-surface);
  border-color: var(--lv-border);
  color: var(--lv-text);
}
```

- [ ] **Step 5: Apply Lovable panel, task, timeline, and empty states**

Use `RecordSidePanel`, `TaskList`, `ActivityTimeline`, and `EmptyState` with classes backed by `--lv-*` tokens. Required visual result: white surface, 1px border, radius 4-6px, 13px body text, muted meta text, no heavy shadow.

- [ ] **Step 6: Verify shared components compile**

Run:

```bash
npm run lint
npm run build
```

Expected: no prop regressions in pages importing these shared components.

- [ ] **Step 7: Commit shared primitives**

Run:

```bash
git add src/components/ui src/index.css
git commit -m "style: update shared ui for lovable da"
```

## Task 5: Rebuild Dashboard From Lovable Reference

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Read Lovable dashboard reference**

Run:

```bash
rg -n "function Dashboard|const Dashboard|Kpi|PropertyCard|timeline|biens chauds" _external/lovable-immopilot-vision/src/components/ImmoPilotApp.tsx
```

Expected: output points to the dashboard section and its child primitives.

- [ ] **Step 2: Replace current Dashboard layout with Lovable composition**

Keep the export signature expected by `src/main.tsx`:

```tsx
export function Dashboard({ store }: DashboardProps) {
  const snapshot = store.getState();
  const hotProperties = snapshot.properties.filter((property) => property.score >= 80).slice(0, 3);

  return (
    <section className="dashboard-page lv-page">
      <header className="dashboard-hero">
        <div>
          <p className="lv-kicker">Tableau de bord</p>
          <h1 className="lv-title">Priorites du jour</h1>
        </div>
      </header>
      {/* Lovable dashboard sections: KPI strip, hot properties, tasks, timeline */}
    </section>
  );
}
```

If the current store API does not expose `getState()`, use the existing selector/subscription pattern already present in `Dashboard.tsx`.

- [ ] **Step 3: Remove old Dashboard decorative/croquis elements**

Delete imports and JSX for legacy dashboard banners or sketch/croquis-specific visuals from `src/pages/Dashboard.tsx`.

- [ ] **Step 4: Add Dashboard Lovable CSS**

Add classes for `.dashboard-page`, `.dashboard-hero`, `.dashboard-grid`, `.dashboard-panel`, `.dashboard-kpi`, and `.dashboard-list-row` using `--lv-*` tokens.

- [ ] **Step 5: Verify Dashboard**

Run:

```bash
npm run lint
npm run build
npm run dev
```

Open:

```text
http://127.0.0.1:3000/#dashboard
```

Expected: Dashboard visually follows Lovable, no legacy banner remains, and there are no console errors.

- [ ] **Step 6: Commit Dashboard**

Run:

```bash
git add src/pages/Dashboard.tsx src/index.css
git commit -m "feat: rebuild dashboard with lovable da"
```

## Task 6: Rework Biens Toolbar, Tabs, Table, Cards, And Remove KPIs

**Files:**
- Modify: `src/pages/Biens.tsx`
- Modify: `src/components/biens/PropertyCard.tsx`
- Modify: `src/components/biens/ScoreRing.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Identify current Biens KPI and view code**

Run:

```bash
rg -n "KPI|kpi|Metric|DataToolbar|ViewTabs|ObjectTable|PropertyCard|RecordSidePanel|ImageLightbox|filter|sort|search" src/pages/Biens.tsx src/components/biens
```

Expected: output identifies KPI JSX to remove and filter/table/card code to preserve.

- [ ] **Step 2: Remove Biens KPI block**

Delete the KPI strip/cards from `src/pages/Biens.tsx`. Keep the page header, tabs, toolbar, filters, table/list, card view, selected property, and side panel logic.

- [ ] **Step 3: Preserve functional handlers**

Keep handlers for:

```ts
onToggleFavorite
onChangeStatus
onLinkContact
onCreateTask
onCreateDeal
onOpenDeal
onOpenLightbox
```

If names differ in the current file, preserve the existing function bodies and connect them to redesigned controls.

- [ ] **Step 4: Apply Lovable PropertyCard structure**

Update `PropertyCard.tsx` to use Lovable structure:

```tsx
<article className={`property-card lv-surface lv-surface-hover ${selected ? 'is-selected' : ''}`}>
  <div className="property-card-media">
    <img src={imageUrl} alt={property.title} />
    <div className="property-card-badges">{/* source, seller, signal */}</div>
  </div>
  <div className="property-card-body">
    <div className="property-card-main">
      <h3>{property.title}</h3>
      <p>{property.city}</p>
    </div>
    <ScoreRing score={property.score} />
    {/* price, specs, next action, contact/deal actions */}
  </div>
</article>
```

Use current repo property images/assets first. Use Lovable/Unsplash URLs only as fallback when existing data has no image.

- [ ] **Step 5: Update ScoreRing to Lovable colors**

`ScoreRing.tsx` should classify scores with Lovable tiers:

```ts
function getScoreTone(score: number) {
  if (score >= 80) return 'hot';
  if (score >= 65) return 'warm';
  return 'cool';
}
```

Map tones to `--lv-green`, `--lv-ocre`, and `--lv-faint`.

- [ ] **Step 6: Redesign table/list while keeping current behavior**

In `Biens.tsx`, keep the current list/table state and sorting/filtering code. Update row classes to Lovable table classes:

```tsx
<div className="biens-table lv-surface">
  {/* existing table/list rows with Lovable classes */}
</div>
```

Required row behavior: click selects/opens mini fiche, hover is subtle, selected row uses green tint, badges remain readable.

- [ ] **Step 7: Verify Biens page behavior**

Run:

```bash
npm run lint
npm run build
npm run dev
```

Open:

```text
http://127.0.0.1:3000/#biens
```

Expected:

- No KPI block appears on Biens.
- Search/filter/sort/tabs still change visible results.
- Property card action buttons still work.
- List/table still opens the selected property.

- [ ] **Step 8: Commit Biens list/cards**

Run:

```bash
git add src/pages/Biens.tsx src/components/biens/PropertyCard.tsx src/components/biens/ScoreRing.tsx src/index.css
git commit -m "feat: restyle biens workspace with lovable da"
```

## Task 7: Rebuild Mini Fiche Bien With Lovable Structure

**Files:**
- Modify: `src/pages/Biens.tsx`
- Modify: `src/components/ui/RecordSidePanel.tsx`
- Modify: `src/components/ui/PhotoGallery.tsx`
- Modify: `src/components/ui/TaskList.tsx`
- Modify: `src/components/ui/ActivityTimeline.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Read Lovable mini fiche reference**

Run:

```bash
rg -n "function PropertyPanel|MiniPanel|ScoreVerdict|priceHistory|sellerName|listings|marketGap" _external/lovable-immopilot-vision/src/components/ImmoPilotApp.tsx
```

Expected: output points to the Lovable panel and section names.

- [ ] **Step 2: Map existing property data to Lovable panel sections**

Create a local display object inside `Biens.tsx` or a small helper next to existing Biens helpers:

```ts
const selectedPropertyView = selectedProperty
  ? {
      id: selectedProperty.id,
      title: selectedProperty.title,
      city: selectedProperty.city,
      price: selectedProperty.price,
      previousPrice: selectedProperty.previousPrice,
      score: selectedProperty.score,
      status: selectedProperty.status,
      photos: selectedProperty.photos,
      signals: linkedSignals,
      tasks: linkedTasks,
      activities: linkedActivities,
      contact: linkedContact,
      deal: linkedDeal,
    }
  : null;
```

Use existing variable names if the current page already computes these relationships.

- [ ] **Step 3: Render Lovable section order**

The mini fiche should render sections in this order:

```tsx
<RecordSidePanel>
  <PanelHeader />
  <PhotoGallery />
  <ScoreAndSignals />
  <SummarySection />
  <PriceSection />
  <CharacteristicsSection />
  <ContactSection />
  <DealSection />
  <TaskList />
  <ActivityTimeline />
  <PanelFooterActions />
</RecordSidePanel>
```

Use inline local components inside `Biens.tsx` only if they are under 80 lines each. If a section grows beyond that, extract it to `src/components/biens/`.

- [ ] **Step 4: Preserve existing mini fiche actions**

Wire the redesigned controls to existing handlers:

```tsx
<button onClick={() => onChangeStatus(selectedProperty.id, nextStatus)}>Changer statut</button>
<button onClick={() => onLinkContact(selectedProperty.id, contactId)}>Lier contact</button>
<button onClick={() => onCreateTask(selectedProperty.id)}>Creer tache</button>
<button onClick={() => onCreateDeal(selectedProperty.id)}>Creer deal</button>
```

Use the current function names and signatures from `Biens.tsx`; the snippet shows the required action coverage.

- [ ] **Step 5: Verify mini fiche**

Run:

```bash
npm run lint
npm run build
npm run dev
```

Open:

```text
http://127.0.0.1:3000/#biens
```

Expected:

- Clicking a property opens the Lovable-structured mini fiche.
- Status/contact/task/deal actions still mutate the local store.
- Photo lightbox still opens from the gallery.
- Linked signals, tasks, activity, contact, and deal remain visible.

- [ ] **Step 6: Commit mini fiche**

Run:

```bash
git add src/pages/Biens.tsx src/components/ui/RecordSidePanel.tsx src/components/ui/PhotoGallery.tsx src/components/ui/TaskList.tsx src/components/ui/ActivityTimeline.tsx src/index.css
git commit -m "feat: rebuild property fiche with lovable structure"
```

## Task 8: Restyle Pipeline With Lovable Kanban And Deal Panels

**Files:**
- Modify: `src/pages/Pipeline.tsx`
- Modify: `src/components/pipeline/KanbanBoard.tsx`
- Modify: `src/components/pipeline/PipelineListView.tsx`
- Modify: `src/components/pipeline/DealFichePanel.tsx`
- Modify: `src/components/pipeline/pipeline.css`
- Modify: `src/index.css`

- [ ] **Step 1: Inventory current Pipeline interactions**

Run:

```bash
rg -n "move|stage|on.*Deal|milestone|RDV|offre|mandat|activity|contact|property|DealFichePanel|KanbanBoard" src/pages/Pipeline.tsx src/components/pipeline src/lib/store.ts
```

Expected: output identifies handlers that move deals, open panels, link objects, and create activity entries.

- [ ] **Step 2: Preserve current Pipeline handlers**

Keep all handlers that update deal stage, next action, linked property/contact, milestones, and activity. Do not replace them with Lovable mock state.

- [ ] **Step 3: Apply Lovable column/card structure**

Update kanban cards to use:

```tsx
<article className="deal-card lv-surface lv-surface-hover">
  <div className="deal-card-header">
    <span className="lv-badge lv-badge-neutral">{deal.reference}</span>
    <ScoreRing score={property.score} />
  </div>
  <h3>{deal.title}</h3>
  <p>{contact.name}</p>
  <div className="deal-card-meta">{/* price, commission, next action */}</div>
</article>
```

Use current property/contact lookup helpers from the page or store.

- [ ] **Step 4: Align deal panel**

Update `DealFichePanel.tsx` to use Lovable panel chrome and section rhythm while preserving current action buttons and activity updates.

- [ ] **Step 5: Verify Pipeline**

Run:

```bash
npm run lint
npm run build
npm run dev
```

Open:

```text
http://127.0.0.1:3000/#pipeline
```

Expected:

- Kanban columns visually match Lovable density.
- Moving a deal still updates stage.
- Opening a deal still shows linked property/contact and actions.
- Activity entries still appear after status changes.

- [ ] **Step 6: Commit Pipeline**

Run:

```bash
git add src/pages/Pipeline.tsx src/components/pipeline/KanbanBoard.tsx src/components/pipeline/PipelineListView.tsx src/components/pipeline/DealFichePanel.tsx src/components/pipeline/pipeline.css src/index.css
git commit -m "feat: restyle pipeline with lovable da"
```

## Task 9: Restyle Contacts With Lovable Lists And Side Panel

**Files:**
- Modify: `src/pages/Contacts.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Inventory current Contacts interactions**

Run:

```bash
rg -n "selectedContact|linked|assignedProperties|deals|activity|task|WhatsApp|email|phone|ContactPanel|side panel|create" src/pages/Contacts.tsx src/lib/store.ts
```

Expected: output identifies contact selection, relation rendering, task creation, and mock communication actions.

- [ ] **Step 2: Preserve current Contacts behavior**

Keep:

```text
contact row click
side panel open/close
linked properties
linked deals
activity history
contact tasks
mock call/email/WhatsApp actions
contact-linked task creation
```

- [ ] **Step 3: Apply Lovable list/table styling**

Update table/list wrappers to use Lovable classes:

```tsx
<section className="contacts-page lv-page">
  <div className="contacts-table lv-surface">
    {/* existing rows */}
  </div>
</section>
```

Rows should use 13px Inter, muted meta, 1px separators, green tint when selected, and no old decorative header illustration.

- [ ] **Step 4: Apply Lovable side panel styling**

Use shared `RecordSidePanel` or matching Lovable panel classes for linked properties, deals, activity, tasks, and communication actions.

- [ ] **Step 5: Verify Contacts**

Run:

```bash
npm run lint
npm run build
npm run dev
```

Open:

```text
http://127.0.0.1:3000/#contacts
```

Expected:

- Clicking a contact opens a premium Lovable-style panel.
- Linked objects still open through existing hash/deep-link behavior.
- Contact task creation still appears in Agenda.

- [ ] **Step 6: Commit Contacts**

Run:

```bash
git add src/pages/Contacts.tsx src/index.css
git commit -m "feat: restyle contacts with lovable da"
```

## Task 10: Adapt Agenda To Lovable DA

**Files:**
- Modify: `src/pages/Agenda.tsx`
- Modify: `src/components/ui/TaskList.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Inventory Agenda task behavior**

Run:

```bash
rg -n "overdue|today|week|all|complete|toggle|date|time|linked|hash|task|create" src/pages/Agenda.tsx src/components/ui/TaskList.tsx src/lib/store.ts
```

Expected: output identifies current views, completion toggles, task creation, date/time editing, and linked object navigation.

- [ ] **Step 2: Keep Agenda behavior**

Preserve the current:

```text
overdue/today/week/all views
completion toggles
manual task creation
date/time edits
linked object opening
```

- [ ] **Step 3: Apply Lovable task hub layout**

Update page structure to:

```tsx
<section className="agenda-page lv-page">
  <header className="agenda-header">
    <div>
      <p className="lv-kicker">Taches</p>
      <h1 className="lv-title">Actions a traiter</h1>
    </div>
  </header>
  <div className="agenda-layout">
    <aside className="agenda-views lv-surface">{/* overdue/today/week/all */}</aside>
    <main className="agenda-tasks lv-surface">{/* current task list */}</main>
  </div>
</section>
```

- [ ] **Step 4: Verify Agenda**

Run:

```bash
npm run lint
npm run build
npm run dev
```

Open:

```text
http://127.0.0.1:3000/#agenda
```

Expected:

- View filters still change task grouping.
- Completion toggles persist in the local store.
- Linked object buttons still navigate to the relevant object.

- [ ] **Step 5: Commit Agenda**

Run:

```bash
git add src/pages/Agenda.tsx src/components/ui/TaskList.tsx src/index.css
git commit -m "feat: adapt agenda to lovable da"
```

## Task 11: Visual QA And Premium Polish Pass

**Files:**
- Modify only files touched by earlier tasks when QA exposes a concrete issue.

- [ ] **Step 1: Start the dev server**

Run:

```bash
npm run dev
```

Expected:

```text
Local:   http://localhost:3000/
```

- [ ] **Step 2: Verify priority routes manually**

Open each URL:

```text
http://127.0.0.1:3000/#dashboard
http://127.0.0.1:3000/#biens
http://127.0.0.1:3000/#pipeline
http://127.0.0.1:3000/#contacts
http://127.0.0.1:3000/#agenda
```

Expected:

```text
No page shows legacy croquis/cottage/sketch styling.
Typography is Archivo/Inter/JetBrains Mono.
Radius and borders are consistent with Lovable.
No card/table/button text overflows.
No console errors appear during normal interactions.
```

- [ ] **Step 3: Capture screenshots**

Use the available browser QA tool or Playwright to capture desktop and mobile screenshots for the five routes. Save temporary screenshots with `tmp-lovable-<route>-desktop.png` and `tmp-lovable-<route>-mobile.png`.

- [ ] **Step 4: Fix visual defects**

For each concrete defect found, make the smallest scoped fix in the related file. Examples:

```text
If a button label overflows, reduce horizontal padding or allow wrapping.
If a table row is too tall, reduce cell padding by one spacing token.
If a side panel hides footer actions, make the panel body scroll and keep footer sticky.
If a mobile table is unreadable, switch that breakpoint to horizontal overflow.
```

- [ ] **Step 5: Run final verification**

Run:

```bash
npm run lint
npm run build
```

Expected: both commands complete successfully.

- [ ] **Step 6: Commit QA polish**

Run:

```bash
git add src package.json package-lock.json
git commit -m "chore: polish lovable redesign qa"
```

## Self-Review Checklist

- Spec coverage: Tasks cover typography, tokens, shell, Dashboard, Biens, mini fiche, Pipeline, Contacts, Agenda, assets policy through implementation guidance, no backend/Supabase work, and visual QA.
- Placeholder scan: The plan avoids unfinished marker language and gives concrete commands, file paths, and expected outcomes.
- Type consistency: The plan preserves existing exported component APIs and instructs implementers to keep current handler names/signatures where they already exist.
- Scope check: The plan is one coherent redesign integration project with page-level commits; unrelated admin/settings/commissions/transfers redesign is excluded.
