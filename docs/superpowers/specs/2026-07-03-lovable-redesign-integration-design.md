# ImmoPilot Lovable Redesign Integration Design

Date: 2026-07-03
Status: Proposed for user review

## Context

ImmoPilot is moving to the Lovable export as the final visual direction for the SaaS. The Lovable export lives in `_external/lovable-immopilot-vision` and contains a sandbox implementation with a monolithic React file and a large CSS file:

- `_external/lovable-immopilot-vision/src/components/ImmoPilotApp.tsx`
- `_external/lovable-immopilot-vision/src/styles/immopilot.css`
- `_external/lovable-immopilot-vision/LOVABLE_INTEGRATION_NOTES.md`
- `_external/lovable-immopilot-vision/LOVABLE_DESIGN_TOKENS.md`

The export is not production-ready as-is. It uses local mock data, local state, no real routing, no real store mutations, and no complete responsive behavior. The existing ImmoPilot repo already has important product interactions in React pages and shared store logic. The redesign must therefore be integrated page by page, not pasted wholesale.

## Final Design Direction

Lovable is now the official final DA for ImmoPilot.

The target interface must feel like a premium 199 EUR/month B2B CRM workspace: calm, precise, expensive, and operational. It should not feel like a generic admin template, a public property marketplace, or a rough prototype.

Core visual rules:

- Use the Lovable typography exactly: Archivo for titles and key numbers, Inter for UI/body, JetBrains Mono for structured numeric/meta data.
- Use the Lovable palette: warm white surfaces, near-black text, deep green primary, muted gray text, subtle ocre/red semantic states.
- Use the Lovable flat CRM style: thin borders, minimal shadows, 4px default radius, tight but readable spacing.
- Remove the previous croquis/cottage/sketch visual language from new production UI.
- Use consistent components everywhere: same buttons, badges, toolbars, panels, score rings, tabs, cards, and tables.
- Real estate photos are supporting context, not marketplace hero content, except inside cards and galleries.

## Integration Approach

Use the Lovable export as a visual and structural source, but keep the production app architecture.

Chosen approach:

1. Extract Lovable tokens, typography, spacing, radius, shadows, and states into the current app design system.
2. Rebuild shared UI components in the current React architecture using the Lovable patterns.
3. Migrate pages incrementally, preserving existing store-backed behavior.
4. Verify each page visually and functionally before moving to the next one.

Do not copy `ImmoPilotApp.tsx` into production as a single component. It should be treated as a reference and extraction source.

## Page Scope

### Dashboard

Dashboard should follow the Lovable structure as closely as possible.

Rules:

- Replace the current dashboard layout with the Lovable dashboard composition.
- Keep it sober and decision-oriented.
- Do not keep unnecessary current KPI modules if they weaken the Lovable direction.
- Reconnect visible numbers/lists to existing local store data where practical.
- Use the Lovable premium CRM visual rhythm rather than the current dashboard cards.

Success criteria:

- The dashboard looks like the Lovable reference, not like the old ImmoPilot dashboard.
- The user immediately sees what matters today.
- No large decorative legacy banners or croquis treatment remain.

### Biens

Biens is the most important page and must be treated as a hybrid:

- Keep the current SaaS list/table view behavior.
- Keep existing filters, search, sort, tabs, favorites, status changes, contact linking, task creation, deal creation/opening, signal visibility, and photo lightbox behavior.
- Redesign the table/list, toolbar, tabs, cards, and side panel with the Lovable DA.
- Keep/refit the Lovable property cards, because the user wants the card design preserved.
- Remove the current page KPIs from Biens; they are not useful for this workspace.
- Preserve the current CRM database function, but make it look and feel like the Lovable system.

Mini fiche Bien:

- The mini fiche structure should match Lovable as closely as possible.
- Existing ImmoPilot data and interactions must be mapped into that structure.
- The panel should remain the central decision dossier: photos, score/signals, summary, price, history, characteristics, seller/contact, tasks, timeline/activity, and linked deal actions.
- The structure should not regress to the old panel layout unless the existing feature has no equivalent section in Lovable.

Success criteria:

- Biens feels like a premium object database, not a marketplace grid.
- Filters and table interactions remain useful.
- The mini fiche looks like Lovable and still does real work.

### Pipeline

Pipeline should adopt the Lovable visual structure while retaining current functional behavior.

Keep:

- Kanban stages.
- Moving deals between stages.
- Deal mini fiche.
- Next actions.
- Linked property/contact.
- RDV/offre/mandat potentiel milestones.
- Automatic activity entries on relevant status changes.

Apply:

- Lovable card styling.
- Lovable columns, spacing, typography, and score/commission treatment.
- Consistent side panel design.

### Contacts

Contacts should adopt the Lovable structure and visual language while keeping the current connected behavior.

Keep:

- Contact list/table.
- Contact side panel.
- Linked properties.
- Linked deals.
- Activity history.
- Contact tasks.
- Mock call/email/WhatsApp actions.
- Contact-linked task creation visible in Agenda.

Apply:

- Lovable table/list styling.
- Lovable panel structure and typography.
- Shared badges, buttons, empty states, and relation cards.

### Agenda

Lovable does not provide a complete Agenda page, so Agenda should be redesigned from the Lovable design system rather than copied from the export.

Keep:

- Overdue/today/week/all views.
- Task completion.
- Manual task creation.
- Date/time edits.
- Opening linked objects through hash deep links.

Apply:

- Lovable tokens, density, buttons, panels, task rows, empty states, and badges.
- CRM task-hub layout that feels native to the redesigned app.

## Components To Extract Or Rebuild

Shared components should live in the existing `src/components/ui` structure where appropriate, or focused feature folders when the component is highly domain-specific.

Priority components:

- AppShell, Sidebar, Topbar.
- Page header pattern.
- Lovable-style toolbar/filter row.
- View tabs.
- Buttons and icon buttons.
- Status and signal badges.
- ScoreRing.
- PropertyCard.
- DealCard.
- Object table/list rows.
- RecordSidePanel shell.
- Mini fiche Bien sections.
- Activity timeline.
- Task rows/list.
- Empty states.
- Image gallery/lightbox integration.

Component quality rules:

- Components should be typed with explicit TypeScript props.
- Domain-specific logic should stay in pages/store helpers, not buried in visual primitives.
- Shared UI should use tokens, not raw hex values.
- Avoid one-off visual hacks unless they are scoped and documented.

## Data And Store Strategy

Use the existing `src/lib/store.ts` and relation helpers as the source of truth for production behavior.

Lovable mock fields should be mapped to existing ImmoPilot domain data rather than replacing the store model. When Lovable has presentational fields that do not exist in the store, create adapters/selectors that derive the display model.

Rules:

- Do not connect a new backend.
- Do not introduce Supabase work in this redesign pass.
- Do not implement real scoring algorithms.
- Do not mutate store data directly from components.
- Prefer small mapping helpers over spreading display transformation logic across pages.

## Assets Strategy

Use current repo assets/mock data for property imagery and app visuals.

Rules:

- Do not rely on Lovable Unsplash URLs as the final source for production mock UI.
- Lovable image URLs may be used only as temporary fallback if an existing asset is missing.
- Existing property/card/deal imagery should be adapted into the new components.
- Remove or avoid old decorative croquis banners on redesigned pages unless explicitly kept for a non-production preview.

## Typography Loading

The user asked to match Lovable exactly. The implementation should use the Lovable font stack:

- Archivo
- Inter
- JetBrains Mono

Because the current repo uses self-hosted `@fontsource` packages, the implementation should prefer adding `@fontsource/archivo` rather than runtime Google Fonts links if feasible. This preserves the exact Lovable typography while matching the repo's existing font-loading pattern.

If `@fontsource/archivo` is added, update `package.json` and import the needed weights once at app entry.

## CSS And Token Strategy

The current `src/index.css` is large and contains legacy croquis/cottage styles. The redesign should introduce a clean Lovable token layer and migrate pages/components onto it.

Recommended path:

1. Add Lovable foundation tokens to `:root`.
2. Keep backward-compatible aliases only where needed during migration.
3. Avoid wholesale replacement of `index.css` in one step because many pages still depend on existing classes.
4. As each page migrates, remove or stop using old page-specific visual classes.
5. Consolidate duplicated CSS once the priority pages are stable.

No component should hardcode the Lovable colors directly when a token exists.

## Responsive Strategy

The Lovable export is desktop-first and incomplete on mobile. The production integration must cover at least:

- Desktop workspace layout.
- Tablet/narrow desktop behavior.
- Mobile fallback for key pages.

Minimum responsive rules:

- Sidebar collapses or becomes a drawer on small screens.
- Side panels become overlays or full-screen sheets on mobile.
- Tables become horizontally scrollable or switch to readable list rows.
- Kanban remains usable on narrower screens.
- No text overflow in buttons, cards, badges, or panels.

## Verification

For every migrated page, run:

- `npm run lint`
- `npm run build`

For visual QA, verify at minimum:

- `http://127.0.0.1:3000/#dashboard`
- `http://127.0.0.1:3000/#biens`
- `http://127.0.0.1:3000/#pipeline`
- `http://127.0.0.1:3000/#contacts`
- `http://127.0.0.1:3000/#agenda`

Visual QA checklist:

- Lovable DA is consistent across all priority pages.
- No old croquis/cottage design language leaks into redesigned pages.
- Typography matches Lovable: Archivo, Inter, JetBrains Mono.
- Radius, borders, hover states, active states, and spacing are consistent.
- Biens has no useless KPI block.
- Biens filters/table behavior remains available.
- Mini fiche Bien follows the Lovable structure.
- Property/deal cards feel premium and not marketplace-heavy.
- Side panels do not overflow or hide important actions.
- Desktop and mobile layouts are usable.
- Empty states are calm, useful, and on-brand.

## Implementation Order

1. Design foundation: fonts, tokens, global shell compatibility, and shared primitive styles.
2. AppShell/sidebar/topbar alignment with Lovable.
3. Dashboard Lovable rebuild.
4. Biens visual rebuild: toolbar/tabs, table/list, property cards, mini fiche.
5. Pipeline visual rebuild.
6. Contacts visual rebuild.
7. Agenda Lovable-system adaptation.
8. Cleanup old styles and run full QA.

## Non Goals

- No Supabase/backend implementation.
- No real scraping pipeline.
- No new scoring/business algorithm.
- No complete Notion-style database builder.
- No public marketplace experience.
- No wholesale import of Lovable template dependencies.
- No full rewrite of unrelated admin/settings/commissions/transfers pages in the first pass, unless needed for shell consistency.

## Open Decisions

No blocking product decisions remain for the design spec. Implementation may still uncover component-level tradeoffs, especially around Biens table/card view composition and mobile behavior.

