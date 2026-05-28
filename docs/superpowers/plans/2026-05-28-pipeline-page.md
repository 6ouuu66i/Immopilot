# Pipeline Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `src/pages/pipeline.html` to `src/pages/Pipeline.tsx` keeping the exact same structural skeleton, applying the Notion/Twenty CRM design tokens, while leaving the deal card visuals and fiche panel structure unchanged.

**Architecture:** Single `Pipeline.tsx` page component manages view state (kanban/list) and selected deal state. Sub-components split by responsibility under `src/components/pipeline/`. A shared `pipeline.css` holds all class-based styles (fiche panel CSS copied verbatim, board/list CSS adapted to new DA). Inline styles for page-level layout, following the Biens pattern.

**Tech Stack:** React 19, TypeScript, inline styles + `pipeline.css` CSS classes, Lucide React (`Plus` icon only), native HTML5 drag-and-drop via React event handlers, `store.ts` mock data.

**Spec:** `docs/superpowers/specs/2026-05-28-pipeline-page-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/components/pipeline/pipeline.css` | Create | All CSS classes for board, columns, deal cards, list view, fiche panel |
| `src/components/pipeline/DealFichePanel.tsx` | Create | Faithful React port of `.fiche-panel` HTML (intouché) |
| `src/components/pipeline/KanbanBoard.tsx` | Create | Kanban grid, columns, deal cards, drag & drop |
| `src/components/pipeline/PipelineListView.tsx` | Create | List view grouped by stage, drag & drop |
| `src/pages/Pipeline.tsx` | Create | Page assembly: header, KPI row, view toggle, state |
| `src/main.tsx` | Modify | Remove `pipeline` from legacy routes, add `Pipeline` React component |

---

## Task 1: Create `pipeline.css`

**Files:**
- Create: `src/components/pipeline/pipeline.css`

This file has two sections:
1. **Board/list CSS** — adapted to Notion/Twenty DA (clean borders, 8-10px radius, `#F7F6F3` bg, no post-it)
2. **Fiche panel CSS** — copied verbatim from `pipeline.html` lines 747–1414 (intouché)

- [ ] **Step 1: Create the file with board/list CSS**

```css
/* src/components/pipeline/pipeline.css */

/* ── SHARED ── */
:root {
  --forest: #1E5A3A;
  --forest-soft: #CFE1D2;
  --sand: #F4EFE5;
  --sand-deep: #E3DED2;
  --bone: #FBF9F4;
  --ink: #1D1F1E;
  --stone: #6B6B6B;
  --stone-light: #9A9A9A;
}

/* ── KANBAN BOARD ── */
.kanban-board {
  display: grid;
  grid-template-columns: repeat(8, 260px);
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 18px;
  scrollbar-width: thin;
  scrollbar-color: #B8B0A0 rgba(29,31,30,0.04);
}
.kanban-board::-webkit-scrollbar { width: 8px; height: 8px; }
.kanban-board::-webkit-scrollbar-track { background: rgba(29,31,30,0.04); border-radius: 999px; }
.kanban-board::-webkit-scrollbar-thumb { background: #B8B0A0; border-radius: 999px; border: 2px solid #F7F6F3; }
.kanban-board::-webkit-scrollbar-thumb:hover { background: #6B6B6B; }

/* ── COLUMN ── */
.column {
  display: flex;
  flex-direction: column;
  background: #FFFFFF;
  border: 1px solid #E6E4DF;
  border-radius: 10px;
  align-self: start;
  transition: background 160ms ease, border-color 160ms ease;
}
.column.drag-over {
  background: #EAF7EF;
  border-color: #1E5A3A;
}
.column-head {
  padding: 12px 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-bottom: 1px solid #E6E4DF;
}
.column-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.column-name {
  font-family: var(--notion-mono, 'JetBrains Mono', monospace);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #1D1F1E;
  display: flex;
  align-items: center;
  gap: 7px;
}
.column-name::before {
  content: '';
  width: 7px; height: 7px;
  border-radius: 999px;
  background: var(--col-color, #9A9A9A);
  flex-shrink: 0;
}
.column-count {
  background: #F3F2EF;
  border: 1px solid #E6E4DF;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 10px;
  color: #6B6B6B;
  font-weight: 600;
}
.column-total {
  font-size: 11px;
  color: #6B6B6B;
  font-family: var(--notion-sans, 'Inter', sans-serif);
}
.column-total strong { color: #1D1F1E; font-weight: 600; }
.column-body {
  flex: 1;
  padding: 8px 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 380px;
}
.column-empty {
  margin: 10px 4px;
  padding: 20px 12px;
  border: 1px dashed #E6E4DF;
  border-radius: 8px;
  text-align: center;
  font-size: 11px;
  color: #9A9A9A;
  background: #F7F6F3;
}
.column-add {
  margin: 0 8px 8px;
  padding: 8px;
  border-radius: 8px;
  background: transparent;
  border: 1px dashed #E6E4DF;
  font-family: var(--notion-sans, 'Inter', sans-serif);
  font-size: 11.5px;
  font-weight: 500;
  color: #6B6B6B;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  transition: all 160ms;
}
.column-add:hover {
  border-color: #1E5A3A;
  color: #1E5A3A;
  border-style: solid;
  background: rgba(30,90,58,0.04);
}

/* Column stage colors */
.column[data-stage="nouveau"]     { --col-color: #8E8B83; }
.column[data-stage="qualifie"]    { --col-color: #7FA68E; }
.column[data-stage="contact"]     { --col-color: #4F7A95; }
.column[data-stage="visite"]      { --col-color: #C8A53B; }
.column[data-stage="proposition"] { --col-color: #C8893B; }
.column[data-stage="mandat"]      { --col-color: #1E5A3A; }
.column[data-stage="vendu"]       { --col-color: #1E5A3A; }
.column[data-stage="perdu"]       { --col-color: #C8553D; }

/* ── DEAL CARD ── */
.deal-card {
  background: #FFFFFF;
  border: 1px solid #E6E4DF;
  border-radius: 8px;
  position: relative;
  cursor: grab;
  transition: transform 200ms cubic-bezier(0.34, 1.2, 0.64, 1), box-shadow 200ms ease, border-color 160ms ease;
  isolation: isolate;
}
.deal-card::before {
  content: '';
  position: absolute;
  left: 0; top: 14px; bottom: 14px;
  width: 3px;
  background: #1E5A3A;
  border-radius: 0 2px 2px 0;
  opacity: 0;
  transform: scaleY(0.4);
  transform-origin: center;
  transition: opacity 200ms ease, transform 240ms cubic-bezier(0.34, 1.2, 0.64, 1);
}
.deal-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  border-color: #CFC8B7;
}
.deal-card:hover::before { opacity: 1; transform: scaleY(1); }
.deal-card:active { cursor: grabbing; }
.deal-card.dragging { visibility: hidden; }
.dc-img {
  position: relative;
  width: 100%;
  height: 110px;
  border-radius: 8px 8px 0 0;
  overflow: hidden;
  background: #E6E4DF;
}
.dc-img img {
  width: 100%; height: 100%; object-fit: cover; display: block;
  transition: transform 500ms cubic-bezier(0.32, 0.72, 0, 1);
}
.deal-card:hover .dc-img img { transform: scale(1.04); }
.dc-ai {
  position: absolute;
  top: 92px;
  right: 10px;
  width: 34px; height: 34px;
  border-radius: 999px;
  background: #FFFFFF;
  display: grid; place-items: center;
  z-index: 3;
  box-shadow: 0 3px 8px rgba(29,31,30,0.15), 0 0 0 1.5px #FFFFFF;
  padding: 1.5px;
}
.dc-body {
  padding: 10px 12px 10px;
  position: relative;
}
.dc-title {
  font-size: 13px;
  font-weight: 600;
  color: #1D1F1E;
  letter-spacing: -0.005em;
  line-height: 1.3;
  padding-right: 36px;
  word-break: break-word;
  margin-bottom: 3px;
}
.dc-city {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px;
  color: #6B6B6B;
  font-weight: 500;
}
.dc-city svg { color: #1E5A3A; }
.dc-price {
  position: absolute;
  top: 26px;
  right: 12px;
  font-size: 13px;
  font-weight: 700;
  color: #1D1F1E;
  letter-spacing: -0.01em;
}
.dc-foot {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px;
}
.dc-owner { display: flex; align-items: center; gap: 6px; }
.dc-avatar {
  width: 18px; height: 18px;
  border-radius: 999px;
  background-size: cover; background-position: center;
  box-shadow: 0 0 0 1.5px #FFFFFF, 0 0 0 2.5px #F4EFE5;
}
.dc-owner-name { font-size: 11px; color: #6B6B6B; font-weight: 500; }
.dc-commission { font-size: 11.5px; color: #1E5A3A; font-weight: 700; letter-spacing: -0.01em; }

/* ── SCORE BADGE SVG ── */
.sketch-double-score { width: 100%; height: 100%; }
.sketch-bg-fill { fill: #F7F6F3; stroke: none; }
.sketch-circle-back-1 { fill: none; stroke: #E6E4DF; stroke-width: 3; }
.sketch-circle-back-2 { fill: none; stroke: #F0EDE8; stroke-width: 2; opacity: 0.6; }
.sketch-progress-ribbon {
  fill: none;
  stroke-width: 6;
  stroke-linecap: round;
  stroke: #1E5A3A;
}
.sketch-text-score {
  fill: #1D1F1E;
  font-family: var(--notion-sans, 'Inter', sans-serif);
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: middle;
}
.score-excellent .sketch-progress-ribbon { stroke: #1E5A3A; }
.score-moderate .sketch-progress-ribbon  { stroke: #C8A53B; }
.score-critical  .sketch-progress-ribbon { stroke: #C8553D; }

/* ── LIST VIEW ── */
.list-view {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0 18px;
}
.list-group { display: flex; flex-direction: column; gap: 6px; }
.list-group-head {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--notion-mono, 'JetBrains Mono', monospace);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #1D1F1E;
  padding: 4px 6px 4px 0;
}
.list-group-head::before {
  content: '';
  width: 7px; height: 7px;
  border-radius: 999px;
  background: var(--col-color, #9A9A9A);
  flex-shrink: 0;
}
.list-group-count {
  background: #F3F2EF;
  border: 1px solid #E6E4DF;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 10px;
  color: #6B6B6B;
  font-weight: 600;
  font-family: var(--notion-sans, 'Inter', sans-serif);
  text-transform: none;
  letter-spacing: 0;
}
.list-group-total {
  margin-left: auto;
  font-size: 11px;
  color: #6B6B6B;
  font-family: var(--notion-sans, 'Inter', sans-serif);
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}
.list-group-total strong { color: #1D1F1E; font-weight: 600; }
.list-group[data-stage="nouveau"]     { --col-color: #8E8B83; }
.list-group[data-stage="qualifie"]    { --col-color: #7FA68E; }
.list-group[data-stage="contact"]     { --col-color: #4F7A95; }
.list-group[data-stage="visite"]      { --col-color: #C8A53B; }
.list-group[data-stage="proposition"] { --col-color: #C8893B; }
.list-group[data-stage="mandat"]      { --col-color: #1E5A3A; }
.list-group[data-stage="vendu"]       { --col-color: #1E5A3A; }
.list-group[data-stage="perdu"]       { --col-color: #C8553D; }
.list-group.drag-over { background: rgba(207,225,210,0.30); border-radius: 8px; }

.list-row {
  display: grid;
  grid-template-columns: 80px 1fr 100px 120px 140px 100px 60px 38px;
  gap: 14px;
  align-items: center;
  padding: 8px 14px 8px 8px;
  background: #FFFFFF;
  border: 1px solid #E6E4DF;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
  transition: border-color 160ms ease, box-shadow 160ms ease, background 120ms ease;
}
.list-row:hover {
  background: #F9F8F5;
  border-color: #CFC8B7;
  box-shadow: 0 4px 14px -6px rgba(29,31,30,0.10);
}
.list-row::before {
  content: '';
  position: absolute;
  left: 0; top: 10px; bottom: 10px;
  width: 3px;
  background: #1E5A3A;
  border-radius: 0 2px 2px 0;
  opacity: 0;
  transform: scaleY(0.4);
  transition: opacity 200ms ease, transform 240ms cubic-bezier(0.34, 1.2, 0.64, 1);
}
.list-row:hover::before { opacity: 1; transform: scaleY(1); }
.list-row.dragging { visibility: hidden; }
.lr-thumb {
  width: 80px; height: 56px;
  border-radius: 6px;
  overflow: hidden;
  background: #E6E4DF;
}
.lr-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.lr-title { font-size: 13px; font-weight: 600; color: #1D1F1E; margin-bottom: 2px; letter-spacing: -0.005em; }
.lr-city  { font-size: 11px; color: #6B6B6B; }
.lr-price { font-size: 14px; font-weight: 700; color: #1D1F1E; letter-spacing: -0.01em; text-align: right; }
.lr-commission { font-size: 13px; font-weight: 600; color: #1E5A3A; text-align: right; letter-spacing: -0.01em; }
.lr-owner { display: flex; align-items: center; gap: 7px; min-width: 0; }
.lr-avatar {
  width: 22px; height: 22px;
  border-radius: 999px;
  background-size: cover; background-position: center;
  box-shadow: 0 0 0 1.5px #FFFFFF, 0 0 0 2.5px #F4EFE5;
  flex-shrink: 0;
}
.lr-owner-name { font-size: 11.5px; color: #6B6B6B; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lr-score { width: 34px; height: 34px; display: grid; place-items: center; margin: 0 auto; }
.lr-actions { display: flex; align-items: center; justify-content: center; }
.lr-menu-btn {
  background: transparent; border: none;
  width: 30px; height: 30px;
  border-radius: 6px;
  display: grid; place-items: center;
  cursor: pointer; color: #6B6B6B;
  transition: all 140ms;
}
.lr-menu-btn:hover { background: #F3F2EF; color: #1D1F1E; }
.list-empty {
  padding: 12px;
  text-align: center;
  font-size: 11.5px;
  color: #9A9A9A;
  border: 1px dashed #E6E4DF;
  border-radius: 8px;
  background: #F7F6F3;
}

/* ── FICHE PANEL (INTOUCHÉ — copied verbatim from pipeline.html) ── */
.fiche-panel {
  width: 480px;
  position: fixed;
  top: 58px;
  right: 0;
  bottom: 0;
  background: #FFFFFF;
  border-left: 1px solid #E6E4DF;
  box-shadow: -4px 0 24px rgba(29,31,30,0.06);
  overflow-y: auto;
  z-index: 30;
  display: flex;
  flex-direction: column;
  font-family: var(--notion-sans, 'Inter', sans-serif);
}
@keyframes fiche-in {
  from { opacity: 0; transform: translateY(8px) scale(0.985); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.fiche-head {
  padding: 16px 18px 12px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #E3DED2;
  flex-shrink: 0;
}
.fiche-head-left { display: flex; align-items: center; gap: 10px; }
.deal-ref {
  font-family: var(--notion-mono, 'JetBrains Mono', monospace);
  font-size: 13px; font-weight: 700;
  color: #1D1F1E;
  letter-spacing: -0.01em;
}
.deal-status {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2.5px 8px;
  border-radius: 999px;
  font-size: 10.5px; font-weight: 600;
}
.deal-status.actif {
  background: #CFE1D2; color: #1E5A3A;
  position: relative; padding-left: 20px;
}
.deal-status.actif::after {
  content: '';
  position: absolute; left: 7px; top: 50%;
  width: 6px; height: 6px; border-radius: 999px;
  background: #1E5A3A;
  transform: translateY(-50%);
  animation: pulse-dot-fiche 2.2s ease-in-out infinite;
}
@keyframes pulse-dot-fiche {
  0%, 100% { box-shadow: 0 0 0 0 rgba(30,90,58,0.30); }
  60%       { box-shadow: 0 0 0 5px rgba(30,90,58,0); }
}
.deal-status.inact {
  background: #F4EFE5; color: #6B6B6B;
  position: relative; padding-left: 18px;
}
.deal-status.inact::before {
  content: '';
  position: absolute; left: 7px; top: 52%;
  width: 5px; height: 5px; border-radius: 999px;
  background: #6B6B6B; transform: translateY(-50%);
}
.fiche-close {
  background: none; border: none; cursor: pointer;
  width: 30px; height: 30px;
  display: grid; place-items: center;
  color: #6B6B6B; border-radius: 6px; flex-shrink: 0;
  transition: background 140ms, color 140ms;
}
.fiche-close:hover { background: #F4EFE5; color: #1D1F1E; }
.hero-wrap { position: relative; padding: 12px 16px 0; flex-shrink: 0; }
.hero {
  position: relative; width: 100%; height: 160px;
  background: #E3DED2; overflow: hidden; border-radius: 8px;
}
.hero img {
  width: 100%; height: 100%; object-fit: cover; display: block;
  transition: transform 800ms cubic-bezier(0.32, 0.72, 0, 1);
}
.hero:hover img { transform: scale(1.03); }
.ai-badge {
  position: absolute; bottom: -22px; right: 28px;
  width: 52px; height: 52px; border-radius: 999px;
  background: conic-gradient(from 180deg, #7FA68E 0%, #3D7A52 calc(var(--target-score, 70) * 0.4%), #1E5A3A calc(var(--target-score, 70) * 1%), #CFE1D2 0);
  display: grid; place-items: center; z-index: 4;
  box-shadow: 0 4px 12px rgba(29,31,30,0.14);
}
.ai-badge::before {
  content: ''; position: absolute; inset: 4px;
  border-radius: 999px; background: #FFFFFF;
}
.ai-badge-inner { position: relative; text-align: center; line-height: 1; }
.ai-badge-inner strong {
  display: block;
  font-family: var(--notion-serif, 'Lora', Georgia, serif);
  font-size: 16px; font-weight: 700; color: #1D1F1E;
}
.ai-badge-inner span {
  display: block;
  font-family: var(--notion-mono, 'JetBrains Mono', monospace);
  font-size: 8px; font-weight: 600; letter-spacing: 0.08em;
  color: #1E5A3A; text-transform: uppercase; margin-top: 1px;
}
.fiche-info { padding: 14px 18px 6px; background: #FFFFFF; flex-shrink: 0; }
.fiche-title {
  font-size: 18px; font-weight: 700; color: #1D1F1E;
  letter-spacing: -0.015em; text-align: left;
}
.fiche-title::before {
  content: ''; display: inline-block;
  width: 3px; height: 15px;
  background: #1E5A3A; margin-right: 7px;
  vertical-align: -2px; border-radius: 1.5px;
}
.fiche-loc-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-top: 4px;
}
.fiche-price { font-size: 16px; font-weight: 700; color: #1D1F1E; letter-spacing: -0.01em; white-space: nowrap; }
.fiche-loc { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 500; color: #6B6B6B; }
.fiche-loc svg { color: #1E5A3A; fill: #1E5A3A; }
.stepper-wrapper {
  display: flex; justify-content: space-between; align-items: flex-start;
  width: calc(100% - 32px); margin: 12px 16px;
  padding: 6px; border-radius: 8px;
  background: #FBF9F4; border: 1px solid #E3DED2;
  flex-shrink: 0;
}
.step { position: relative; display: flex; flex-direction: column; align-items: center; flex: 1; cursor: pointer; }
.step::before {
  content: ""; position: absolute; top: 5px; right: 50%; width: 100%; height: 1.5px;
  background-color: #E3DED2; z-index: 1; transition: background-color 0.3s ease;
}
.step:first-child::before { display: none; }
.step.completed::before, .step.active::before { background-color: #1E5A3A; }
.step-icon {
  position: relative; width: 12px; height: 12px; border-radius: 50%;
  background-color: #FFFFFF; border: 1.5px solid #E3DED2;
  display: flex; align-items: center; justify-content: center;
  z-index: 2; transition: all 0.3s ease; box-shadow: 0 0 0 2.5px #FBF9F4;
}
.step.completed .step-icon { background-color: #1E5A3A; border-color: #1E5A3A; }
.step.active .step-icon { border: 1.5px solid #1E5A3A; background-color: #FFFFFF; box-shadow: 0 0 0 2.5px rgba(30,90,58,0.12); }
.step.active .step-icon::after { content: ""; width: 4px; height: 4px; border-radius: 50%; background-color: #1E5A3A; }
.step-label { margin-top: 5px; font-size: 9px; color: #9A9A9A; font-weight: 500; text-align: center; max-width: 50px; line-height: 1.2; }
.step.completed .step-label { color: #1D1F1E; font-weight: 600; }
.step.active .step-label { color: #1E5A3A; font-weight: 700; }
.fiche-body { flex: 1; padding: 4px 16px 16px; overflow-y: auto; }
.body-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
.body-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.mc {
  background: #FFFFFF; border: 1px solid #E3DED2; border-radius: 8px;
  padding: 10px 12px; display: flex; flex-direction: column;
}
.mc-label {
  font-family: var(--notion-mono, 'JetBrains Mono', monospace);
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em;
  color: #9A9A9A; font-weight: 600; margin-bottom: 6px; text-align: left;
}
.mc-vendor-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.mc-vendor-avatar {
  width: 30px; height: 30px; border-radius: 999px;
  background: #F4EFE5; border: 1px solid #E3DED2;
  display: grid; place-items: center;
  font-size: 10px; font-weight: 700; color: #6B6B6B; flex-shrink: 0;
}
.mc-vendor-name { font-size: 11.5px; font-weight: 700; color: #1D1F1E; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mc-vendor-contact { display: flex; flex-direction: column; gap: 2px; font-size: 10px; color: #6B6B6B; }
.mc-vendor-contact span { display: flex; align-items: center; gap: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mc-vendor-contact svg { color: #9A9A9A; flex-shrink: 0; }
.mc-bien-row { display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 8px; align-items: flex-start; }
.mc-bien-icon { width: 30px; height: 30px; border-radius: 999px; background: #CFE1D2; display: grid; place-items: center; color: #1E5A3A; }
.mc-bien-title { font-size: 11.5px; font-weight: 700; color: #1D1F1E; }
.mc-bien-loc  { font-size: 10px; color: #6B6B6B; }
.mc-bien-specs { font-size: 9.5px; color: #9A9A9A; }
.mc-bien-link {
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  margin-top: 8px; padding-top: 6px;
  border-top: 1px solid #F4EFE5;
  font-size: 10.5px; font-weight: 600; color: #1E5A3A;
  cursor: pointer; background: none;
  border-left: 0; border-right: 0; border-bottom: 0;
  text-decoration: none;
  transition: color 140ms;
}
.mc-bien-link:hover { color: #1D1F1E; }
.task-list { display: flex; flex-direction: column; gap: 6px; }
.task-row { display: grid; grid-template-columns: 13px minmax(0, 1fr); column-gap: 8px; align-items: start; }
.task-check {
  width: 13px; height: 13px;
  border: 1.5px solid #E3DED2; border-radius: 3px;
  background: #FFFFFF; cursor: pointer; flex-shrink: 0;
  position: relative; transition: all 140ms; margin-top: 1.5px;
}
.task-check.checked { background: #1E5A3A; border-color: #1E5A3A; }
.task-check.checked::after {
  content: ''; position: absolute; left: 3px; top: 0px;
  width: 4px; height: 7px;
  border-right: 1.5px solid #FFFFFF; border-bottom: 1.5px solid #FFFFFF;
  transform: rotate(45deg);
}
.task-name { font-size: 11px; color: #1D1F1E; font-weight: 500; line-height: 1.25; }
.task-row.done .task-name { text-decoration: line-through; color: #9A9A9A; }
.task-meta { grid-column: 2; display: flex; align-items: center; gap: 6px; margin-top: 2px; }
.task-date { font-size: 9px; color: #9A9A9A; font-family: var(--notion-mono, monospace); }
.prio-chip { font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 999px; white-space: nowrap; }
.prio-chip.haute { background: #FDEBEC; color: #C8553D; }
.prio-chip.moy   { background: #FFF3D8; color: #8A6C20; }
.prio-chip.basse { background: #F4EFE5; color: #9A9A9A; }
.task-empty { text-align: center; padding: 10px 4px; color: #9A9A9A; font-size: 11px; border: 1px dashed #E3DED2; border-radius: 6px; }
.notes-input-row { display: flex; gap: 4px; }
.notes-input {
  flex: 1; height: 28px;
  border: 1px solid #E3DED2; border-radius: 5px;
  padding: 0 8px; font-size: 11px; color: #1D1F1E;
  background: #FBF9F4; outline: none;
  font-family: var(--notion-sans, 'Inter', sans-serif);
}
.notes-input:focus { border-color: #1E5A3A; background: #FFFFFF; }
.notes-list { display: flex; flex-direction: column; gap: 8px; }
.note-item { display: grid; grid-template-columns: 22px 1fr; gap: 6px; padding-bottom: 6px; border-bottom: 1px solid #FBF9F4; }
.note-item:last-child { border-bottom: none; }
.note-avatar { width: 22px; height: 22px; border-radius: 999px; background: #F4EFE5; display: grid; place-items: center; font-size: 9px; font-weight: 700; color: #6B6B6B; }
.note-header { display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 2px; }
.note-author { font-size: 10.5px; font-weight: 600; color: #1D1F1E; }
.note-date { font-size: 9px; color: #9A9A9A; font-family: var(--notion-mono, monospace); }
.note-text { font-size: 10.5px; color: #1D1F1E; line-height: 1.35; }
.commission-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 4px 0; font-size: 11px; border-bottom: 1px solid #FBF9F4; }
.commission-row:last-of-type { border-bottom: none; }
.commission-row .ck { color: #6B6B6B; }
.commission-row .cv { color: #1D1F1E; font-weight: 500; }
.commission-row .cv.amount { font-size: 12px; font-weight: 700; color: #1E5A3A; }
.commission-status { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 999px; font-size: 10px; font-weight: 600; background: #CFE1D2; color: #1E5A3A; }
.activity-list { display: flex; flex-direction: column; gap: 8px; }
.activity-row { display: grid; grid-template-columns: 8px minmax(0, 1fr); column-gap: 8px; align-items: start; }
.activity-dot { width: 8px; height: 8px; border-radius: 999px; background: #1E5A3A; margin-top: 3px; box-shadow: 0 0 0 2px rgba(30,90,58,0.10); }
.activity-title { font-size: 11px; color: #1D1F1E; font-weight: 600; }
.activity-meta { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
.activity-author { font-size: 10px; color: #6B6B6B; }
.activity-date { font-size: 9px; color: #9A9A9A; font-family: var(--notion-mono, monospace); white-space: nowrap; }
.fiche-actions {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
  padding: 12px 16px 16px;
  border-top: 1px solid #E3DED2; background: #FFFFFF;
  flex-shrink: 0;
}
.fiche-actions .btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 6px; height: 36px; border-radius: 6px;
  font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid transparent;
  font-family: var(--notion-sans, 'Inter', sans-serif);
  transition: all 140ms;
}
.fiche-actions .btn-secondary { background: #FFFFFF; color: #1D1F1E; border-color: #E3DED2; }
.fiche-actions .btn-secondary:hover { border-color: #9A9A9A; background: #FBF9F4; }
.fiche-actions .btn-primary { background: #1E5A3A; color: #FFFFFF; }
.fiche-actions .btn-primary:hover { background: #174A2F; }
.fiche-actions .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 2: Run build to verify CSS is valid**

```powershell
npm run build
```
Expected: build completes with no errors. CSS file is included in build output.

- [ ] **Step 3: Commit**

```powershell
git add src/components/pipeline/pipeline.css
git commit -m "feat(pipeline): add pipeline CSS with Notion/Twenty DA"
```

---

## Task 2: Create `DealFichePanel.tsx`

**Files:**
- Create: `src/components/pipeline/DealFichePanel.tsx`

React port of the fiche panel. Structure and class names match `pipeline.css` exactly. CSS animations (`fiche-in`, `pulse-dot-fiche`) are already defined in `pipeline.css`.

- [ ] **Step 1: Create the component**

```tsx
// src/components/pipeline/DealFichePanel.tsx
import { useState } from 'react';
import type { store as appStore } from '../../lib/store';
import type { Deal } from '../../types';

type Store = typeof appStore;

interface DealFichePanelProps {
  deal: Deal;
  store: Store;
  onClose: () => void;
  onMoveDeal: (dealId: string, stageName: string) => void;
}

const priceFormatter = new Intl.NumberFormat('fr-BE', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
});
function fmt(v: number) { return priceFormatter.format(v).replace(/\s?EUR/, ' €'); }

export function DealFichePanel({ deal, store, onClose, onMoveDeal }: DealFichePanelProps) {
  const [noteDraft, setNoteDraft] = useState('');

  const property = store.getProperty(deal.propertyId);
  const contact  = store.getContact(deal.contactId);
  const tasks    = store.getTasks().filter(t => t.dealId === deal.id).slice(0, 5);
  const stages   = store.getPipelineStages();
  const currentStageIdx = stages.findIndex(s => s.name === deal.stage);
  const isActive = !['Perdu', 'Bien vendu'].includes(deal.stage);

  const commStatus =
    deal.stage === 'Bien vendu' ? 'Reçue' :
    deal.stage === 'Perdu'      ? 'Annulée' : 'Ouverte';

  const sellerInitials = (contact?.name ?? deal.title)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase();

  const handleAddNote = () => {
    if (!noteDraft.trim()) return;
    store.registerNoteToDeal(deal.id, noteDraft.trim());
    setNoteDraft('');
  };

  const handleAdvanceStage = () => {
    if (currentStageIdx < stages.length - 1) {
      onMoveDeal(deal.id, stages[currentStageIdx + 1].name);
    }
  };

  const dealRef = `D-2026-${deal.id.replace('deal-', '').padStart(4, '0')}`;

  return (
    <aside className="fiche-panel">
      <div style={{ animation: 'fiche-in 380ms cubic-bezier(0.32, 0.72, 0, 1)', display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* ── Header ── */}
        <div className="fiche-head">
          <div className="fiche-head-left">
            <span className="deal-ref">Deal #{dealRef}</span>
            <span className={`deal-status ${isActive ? 'actif' : 'inact'}`}>
              {deal.stage === 'Bien vendu' ? 'Vendu' : deal.stage === 'Perdu' ? 'Perdu' : 'Actif'}
            </span>
          </div>
          <button className="fiche-close" type="button" onClick={onClose} aria-label="Fermer">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Hero image ── */}
        <div className="hero-wrap">
          <div className="hero">
            {property?.photos[0] && (
              <img src={property.photos[0]} alt={property.title} />
            )}
          </div>
          <div
            className="ai-badge"
            style={{ '--target-score': property?.score ?? 70 } as React.CSSProperties}
          >
            <div className="ai-badge-inner">
              <span>IA</span>
              <strong><span>{property?.score ?? 70}</span></strong>
            </div>
          </div>
        </div>

        {/* ── Info ── */}
        <div className="fiche-info">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <div className="fiche-title">{property?.title ?? deal.title}</div>
            <div className="fiche-price">{fmt(deal.price)}</div>
          </div>
          <div className="fiche-loc-row">
            <div className="fiche-loc">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2a8 8 0 0 0-8 8c0 5.5 8 12 8 12s8-6.5 8-12a8 8 0 0 0-8-8z" />
                <circle cx="12" cy="10" r="2.5" fill="#FFFFFF" stroke="none" />
              </svg>
              {property?.city ?? '—'} · Belgique
            </div>
          </div>
        </div>

        {/* ── Stepper ── */}
        <div className="stepper-wrapper">
          {stages.map((stage, idx) => {
            const cls =
              idx < currentStageIdx ? 'completed' :
              idx === currentStageIdx ? 'active' : '';
            return (
              <div
                key={stage.id}
                className={`step ${cls}`}
                onClick={() => onMoveDeal(deal.id, stage.name)}
              >
                <div className="step-icon">
                  {idx < currentStageIdx && (
                    <svg viewBox="0 0 24 24" fill="none" style={{ width: 7, height: 7 }} stroke="#FFFFFF" strokeWidth="3.2">
                      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="step-label">{stage.name}</div>
              </div>
            );
          })}
        </div>

        {/* ── Body ── */}
        <div className="fiche-body">
          <div className="body-grid-2">

            {/* Left column */}
            <div className="body-col">
              {/* Vendor */}
              <div className="mc">
                <div className="mc-label">Vendeur</div>
                <div className="mc-vendor-header">
                  <div className="mc-vendor-avatar">{sellerInitials}</div>
                  <div className="mc-vendor-name">{contact?.name ?? '—'}</div>
                </div>
                {contact && (
                  <div className="mc-vendor-contact">
                    <span>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      {contact.phone}
                    </span>
                    <span>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      {contact.email}
                    </span>
                  </div>
                )}
              </div>

              {/* Tasks */}
              <div className="mc">
                <div className="mc-label">Tâches liées</div>
                <div className="task-list">
                  {tasks.length === 0 ? (
                    <div className="task-empty">Aucune tâche liée</div>
                  ) : (
                    tasks.map(task => (
                      <div key={task.id} className={`task-row ${task.done ? 'done' : ''}`}>
                        <div
                          className={`task-check ${task.done ? 'checked' : ''}`}
                          onClick={() => store.toggleTask(task.id)}
                        />
                        <div className="task-name">{task.title}</div>
                        <div className="task-meta">
                          <span className="task-date">{task.date}</span>
                          <span className={`prio-chip ${task.priority === 'haute' ? 'haute' : task.priority === 'basse' ? 'basse' : 'moy'}`}>
                            {task.priority === 'haute' ? 'Haute' : task.priority === 'basse' ? 'Faible' : 'Moy.'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="mc">
                <div className="mc-label">Notes</div>
                <div className="notes-list">
                  {deal.notes.slice(0, 3).map((note, i) => (
                    <div key={i} className="note-item">
                      <div className="note-avatar">{sellerInitials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="note-header">
                          <span className="note-author">{contact?.name ?? 'Agent'}</span>
                        </div>
                        <div className="note-text">{note}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="notes-input-row" style={{ marginTop: 10 }}>
                  <input
                    className="notes-input"
                    value={noteDraft}
                    onChange={e => setNoteDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddNote(); }}
                    placeholder="Ajouter une note…"
                  />
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="body-col">
              {/* Property */}
              <div className="mc">
                <div className="mc-label">Bien lié</div>
                <div className="mc-bien-row">
                  <div className="mc-bien-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  </div>
                  <div>
                    <div className="mc-bien-title">{property?.title ?? '—'}</div>
                    <div className="mc-bien-loc">{property?.city ?? '—'}</div>
                    {property && (
                      <div className="mc-bien-specs">{property.surface} m² · {property.bedrooms} ch. · PEB {property.peb}</div>
                    )}
                  </div>
                </div>
                <a href="#biens" className="mc-bien-link">
                  Voir le bien
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </a>
              </div>

              {/* Commission */}
              <div className="mc">
                <div className="mc-label">Commission</div>
                <div className="commission-row">
                  <span className="ck">Estimation</span>
                  <span className="cv amount">{fmt(deal.commissionAmount)}</span>
                </div>
                <div className="commission-row">
                  <span className="ck">Pourcentage</span>
                  <span className="cv">3,00 %</span>
                </div>
                <div className="commission-row">
                  <span className="ck">Statut</span>
                  <span className="commission-status">{commStatus}</span>
                </div>
              </div>

              {/* Activities */}
              <div className="mc">
                <div className="mc-label">Activités</div>
                <div className="activity-list">
                  {deal.activities.slice(0, 5).map(act => (
                    <div key={act.id} className="activity-row">
                      <div className="activity-dot" />
                      <div>
                        <div className="activity-title">{act.text}</div>
                        <div className="activity-meta">
                          <span className="activity-author">{act.agentName}</span>
                          <span className="activity-date">{act.date}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className="fiche-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Fermer
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAdvanceStage}
            disabled={currentStageIdx >= stages.length - 1}
          >
            Avancer stage
          </button>
        </div>

      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Run build**

```powershell
npm run build
```
Expected: no TypeScript or build errors.

- [ ] **Step 3: Commit**

```powershell
git add src/components/pipeline/DealFichePanel.tsx
git commit -m "feat(pipeline): add DealFichePanel React component"
```

---

## Task 3: Create `KanbanBoard.tsx`

**Files:**
- Create: `src/components/pipeline/KanbanBoard.tsx`

Contains `KanbanBoard` (exported), `KanbanColumn`, and `DealCard` as internal sub-components. Drag & drop uses native HTML5 DnD via React handlers.

The `stageNameToId` utility maps deal stage names (e.g. `"Mandat signé"`) to CSS data-stage IDs (e.g. `"mandat"`). This is needed because the `Deal.stage` field stores full names while CSS uses short IDs.

- [ ] **Step 1: Create the file**

```tsx
// src/components/pipeline/KanbanBoard.tsx
import { useState } from 'react';
import type { store as appStore } from '../../lib/store';
import type { Deal } from '../../types';

type Store = typeof appStore;

interface KanbanBoardProps {
  deals: Deal[];
  stages: ReturnType<Store['getPipelineStages']>;
  onSelectDeal: (dealId: string) => void;
  onMoveDeal: (dealId: string, stageName: string) => void;
  selectedDealId: string | null;
  store: Store;
}

const priceFormatter = new Intl.NumberFormat('fr-BE', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
});
function fmt(v: number) { return priceFormatter.format(v).replace(/\s?EUR/, ' €'); }

function stageNameToId(name: string): string {
  const n = (name ?? '').trim().toLowerCase();
  if (n.includes('nouveau'))  return 'nouveau';
  if (n.includes('qualif'))   return 'qualifie';
  if (n.includes('contact'))  return 'contact';
  if (n.includes('visite'))   return 'visite';
  if (n.includes('propos'))   return 'proposition';
  if (n.includes('mandat'))   return 'mandat';
  if (n.includes('vend'))     return 'vendu';
  if (n.includes('perd'))     return 'perdu';
  return 'nouveau';
}

// ── Deal Card ──────────────────────────────────────────────────────────────────

interface DealCardProps {
  deal: Deal;
  store: Store;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function DealCard({ deal, store, selected, onSelect, onDragStart, onDragEnd }: DealCardProps) {
  const property = store.getProperty(deal.propertyId);
  const agent    = store.getAgents().find(a => a.id === deal.ownerId);
  const photo    = property?.photos[0] ?? '';
  const score    = property?.score ?? 70;
  const offset   = Math.round(180 - (180 * (score / 100)));
  const scoreClass =
    score >= 80 ? 'score-excellent' :
    score >= 60 ? 'score-moderate'  : 'score-critical';

  return (
    <article
      className="deal-card"
      style={{ outline: selected ? '2px solid #1E5A3A' : 'none', outlineOffset: 2 }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
    >
      <div className="dc-img">
        {photo && <img src={photo} alt={property?.title ?? ''} loading="lazy" />}
      </div>
      <div className="dc-ai">
        <svg viewBox="0 0 100 100" className={`sketch-double-score ${scoreClass}`}>
          <path d="M 50,11 C 71,9 87,25 89,49 C 91,73 75,89 50,87 C 25,85 9,69 11,49 C 13,29 29,13 50,11 Z" className="sketch-bg-fill" />
          <path d="M 50,11 C 71,9 87,25 89,49 C 91,73 75,89 50,87 C 25,85 9,69 11,49 C 13,29 29,13 50,11 Z" className="sketch-circle-back-1" />
          <path d="M 51,9 C 73,12 89,29 86,52 C 83,75 66,90 43,88 C 21,86 7,67 10,41 C 13,15 29,5 51,9 Z" className="sketch-circle-back-2" />
          <path
            className="sketch-progress-ribbon"
            d="M 22,70 C 13,50 17,29 37,18 C 57,7 78,13 86,33 C 94,53 85,74 65,83"
            strokeDasharray="180"
            strokeDashoffset={offset}
          />
          <text x="50" y="54" className="sketch-text-score" style={{ fontSize: '32px' }}>{score}</text>
        </svg>
      </div>
      <div className="dc-body">
        <div className="dc-title">{property?.title ?? deal.title}</div>
        <div className="dc-city">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a8 8 0 0 0-8 8c0 5.5 8 12 8 12s8-6.5 8-12a8 8 0 0 0-8-8z" />
            <circle cx="12" cy="10" r="2.5" fill="#FFFFFF" />
          </svg>
          {property?.city ?? '—'}
        </div>
        <div className="dc-price">{fmt(deal.price)}</div>
        {/* Clean divider replacing the wavy SVG */}
        <div style={{ borderTop: '1px solid #E6E4DF', margin: '10px 0 8px' }} />
        <div className="dc-foot">
          <div className="dc-owner">
            {agent?.avatar && (
              <div className="dc-avatar" style={{ backgroundImage: `url('${agent.avatar}')` }} />
            )}
            <span className="dc-owner-name">{agent?.name.split(' ')[0] ?? '—'}</span>
          </div>
          <span className="dc-commission">{fmt(deal.commissionAmount)}</span>
        </div>
      </div>
    </article>
  );
}

// ── Kanban Column ──────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  stage: { id: string; name: string };
  deals: Deal[];
  store: Store;
  selectedDealId: string | null;
  onSelectDeal: (dealId: string) => void;
  onDrop: (stageName: string) => void;
  onDragStart: (dealId: string) => void;
  onDragEnd: () => void;
}

function KanbanColumn({
  stage, deals, store, selectedDealId,
  onSelectDeal, onDrop, onDragStart, onDragEnd,
}: KanbanColumnProps) {
  const [dragOver, setDragOver] = useState(false);
  const stageId        = stageNameToId(stage.name);
  const totalCommission = deals.reduce((sum, d) => sum + d.commissionAmount, 0);

  return (
    <div
      className={`column${dragOver ? ' drag-over' : ''}`}
      data-stage={stageId}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); onDrop(stage.name); }}
    >
      <div className="column-head">
        <div className="column-head-row">
          <span className="column-name">{stage.name}</span>
          <span className="column-count">{deals.length}</span>
        </div>
        <div className="column-total">
          {totalCommission > 0 ? (
            <><strong>{totalCommission.toLocaleString('fr-BE')} €</strong> commission</>
          ) : '—'}
        </div>
      </div>
      <div className="column-body">
        {deals.length === 0 ? (
          <div className="column-empty">Aucun deal dans cette étape</div>
        ) : (
          deals.map(deal => (
            <DealCard
              key={deal.id}
              deal={deal}
              store={store}
              selected={selectedDealId === deal.id}
              onSelect={() => onSelectDeal(deal.id)}
              onDragStart={e => {
                e.dataTransfer.setData('text/plain', deal.id);
                e.dataTransfer.effectAllowed = 'move';
                onDragStart(deal.id);
              }}
              onDragEnd={onDragEnd}
            />
          ))
        )}
      </div>
      <button type="button" className="column-add">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Ajouter un deal
      </button>
    </div>
  );
}

// ── Kanban Board ───────────────────────────────────────────────────────────────

export function KanbanBoard({
  deals, stages, onSelectDeal, onMoveDeal, selectedDealId, store,
}: KanbanBoardProps) {
  const [draggingDealId, setDraggingDealId] = useState<string | null>(null);

  const handleDrop = (stageName: string) => {
    if (!draggingDealId) return;
    const deal = deals.find(d => d.id === draggingDealId);
    if (deal && deal.stage !== stageName) {
      onMoveDeal(draggingDealId, stageName);
    }
    setDraggingDealId(null);
  };

  return (
    <div className="kanban-board">
      {stages.map(stage => {
        const stageId    = stageNameToId(stage.name);
        const stageDeals = deals.filter(d => stageNameToId(d.stage) === stageId);
        return (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            deals={stageDeals}
            store={store}
            selectedDealId={selectedDealId}
            onSelectDeal={onSelectDeal}
            onDrop={handleDrop}
            onDragStart={setDraggingDealId}
            onDragEnd={() => setDraggingDealId(null)}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Run lint and build**

```powershell
npm run lint
npm run build
```
Expected: no errors.

- [ ] **Step 3: Commit**

```powershell
git add src/components/pipeline/KanbanBoard.tsx
git commit -m "feat(pipeline): add KanbanBoard component with drag & drop"
```

---

## Task 4: Create `PipelineListView.tsx`

**Files:**
- Create: `src/components/pipeline/PipelineListView.tsx`

List view grouped by stage with drag & drop between groups. Contains `PipelineListView` (exported) and `ListRow` (internal).

- [ ] **Step 1: Create the file**

```tsx
// src/components/pipeline/PipelineListView.tsx
import { useState } from 'react';
import type { store as appStore } from '../../lib/store';
import type { Deal } from '../../types';

type Store = typeof appStore;

interface PipelineListViewProps {
  deals: Deal[];
  stages: ReturnType<Store['getPipelineStages']>;
  onSelectDeal: (dealId: string) => void;
  selectedDealId: string | null;
  store: Store;
}

const priceFormatter = new Intl.NumberFormat('fr-BE', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
});
function fmt(v: number) { return priceFormatter.format(v).replace(/\s?EUR/, ' €'); }

function stageNameToId(name: string): string {
  const n = (name ?? '').trim().toLowerCase();
  if (n.includes('nouveau'))  return 'nouveau';
  if (n.includes('qualif'))   return 'qualifie';
  if (n.includes('contact'))  return 'contact';
  if (n.includes('visite'))   return 'visite';
  if (n.includes('propos'))   return 'proposition';
  if (n.includes('mandat'))   return 'mandat';
  if (n.includes('vend'))     return 'vendu';
  if (n.includes('perd'))     return 'perdu';
  return 'nouveau';
}

// ── List Row ───────────────────────────────────────────────────────────────────

interface ListRowProps {
  deal: Deal;
  store: Store;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function ListRow({ deal, store, selected, onSelect, onDragStart, onDragEnd }: ListRowProps) {
  const property = store.getProperty(deal.propertyId);
  const agent    = store.getAgents().find(a => a.id === deal.ownerId);
  const score    = property?.score ?? 70;
  const offset   = Math.round(180 - (180 * (score / 100)));
  const scoreClass =
    score >= 80 ? 'score-excellent' :
    score >= 60 ? 'score-moderate'  : 'score-critical';

  return (
    <div
      className="list-row"
      style={{ outline: selected ? '2px solid #1E5A3A' : 'none', outlineOffset: -2 }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
    >
      <div className="lr-thumb">
        {property?.photos[0] && (
          <img src={property.photos[0]} alt="" loading="lazy" />
        )}
      </div>
      <div>
        <div className="lr-title">{property?.title ?? deal.title}</div>
        <div className="lr-city">{property?.city ?? '—'}</div>
      </div>
      <div className="lr-price">{fmt(deal.price)}</div>
      <div className="lr-commission">{fmt(deal.commissionAmount)}</div>
      <div className="lr-owner">
        {agent?.avatar && (
          <div className="lr-avatar" style={{ backgroundImage: `url('${agent.avatar}')` }} />
        )}
        <span className="lr-owner-name">{agent?.name ?? '—'}</span>
      </div>
      <div />
      <div className="lr-score">
        <svg viewBox="0 0 100 100" className={`sketch-double-score ${scoreClass}`} style={{ width: 30, height: 30 }}>
          <path d="M 50,11 C 71,9 87,25 89,49 C 91,73 75,89 50,87 C 25,85 9,69 11,49 C 13,29 29,13 50,11 Z" className="sketch-bg-fill" />
          <path d="M 50,11 C 71,9 87,25 89,49 C 91,73 75,89 50,87 C 25,85 9,69 11,49 C 13,29 29,13 50,11 Z" className="sketch-circle-back-1" />
          <path
            className="sketch-progress-ribbon"
            d="M 22,70 C 13,50 17,29 37,18 C 57,7 78,13 86,33 C 94,53 85,74 65,83"
            strokeDasharray="180"
            strokeDashoffset={offset}
          />
          <text x="50" y="54" className="sketch-text-score" style={{ fontSize: '32px' }}>{score}</text>
        </svg>
      </div>
      <div className="lr-actions">
        <button
          type="button"
          className="lr-menu-btn"
          onClick={e => e.stopPropagation()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="19" cy="12" r="1.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Pipeline List View ─────────────────────────────────────────────────────────

export function PipelineListView({
  deals, stages, onSelectDeal, selectedDealId, store,
}: PipelineListViewProps) {
  const [draggingDealId, setDraggingDealId] = useState<string | null>(null);

  const handleDrop = (stageName: string, e: React.DragEvent) => {
    e.preventDefault();
    if (!draggingDealId) return;
    const deal = deals.find(d => d.id === draggingDealId);
    if (deal && deal.stage !== stageName) {
      store.moveDealStage(draggingDealId, stageName);
    }
    setDraggingDealId(null);
  };

  return (
    <div className="list-view">
      {stages.map(stage => {
        const stageId         = stageNameToId(stage.name);
        const stageDeals      = deals.filter(d => stageNameToId(d.stage) === stageId);
        const totalCommission = stageDeals.reduce((sum, d) => sum + d.commissionAmount, 0);

        return (
          <div
            key={stage.id}
            className="list-group"
            data-stage={stageId}
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDrop(stage.name, e)}
          >
            <div className="list-group-head">
              {stage.name}
              <span className="list-group-count">{stageDeals.length}</span>
              <span className="list-group-total">
                {totalCommission > 0 ? (
                  <><strong>{totalCommission.toLocaleString('fr-BE')} €</strong> commission</>
                ) : ''}
              </span>
            </div>
            {stageDeals.length === 0 ? (
              <div className="list-empty">Aucun deal</div>
            ) : (
              stageDeals.map(deal => (
                <ListRow
                  key={deal.id}
                  deal={deal}
                  store={store}
                  selected={selectedDealId === deal.id}
                  onSelect={() => onSelectDeal(deal.id)}
                  onDragStart={e => {
                    e.dataTransfer.setData('text/plain', deal.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggingDealId(deal.id);
                  }}
                  onDragEnd={() => setDraggingDealId(null)}
                />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Run lint and build**

```powershell
npm run lint
npm run build
```
Expected: no errors.

- [ ] **Step 3: Commit**

```powershell
git add src/components/pipeline/PipelineListView.tsx
git commit -m "feat(pipeline): add PipelineListView component"
```

---

## Task 5: Create `Pipeline.tsx`

**Files:**
- Create: `src/pages/Pipeline.tsx`

Page assembly component. Manages view mode, selected deal, and store reactivity. Renders header + KPI row + view toggle + main content (kanban or list) + fiche panel. Imports `pipeline.css`.

- [ ] **Step 1: Create the file**

```tsx
// src/pages/Pipeline.tsx
import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { store as appStore } from '../lib/store';
import { KanbanBoard }        from '../components/pipeline/KanbanBoard';
import { PipelineListView }   from '../components/pipeline/PipelineListView';
import { DealFichePanel }     from '../components/pipeline/DealFichePanel';
import '../components/pipeline/pipeline.css';

type Store = typeof appStore;
type ViewMode = 'kanban' | 'list';

interface PipelineProps {
  store: Store;
}

const commFormatter = new Intl.NumberFormat('fr-BE', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
});
function fmtComm(v: number) { return commFormatter.format(v).replace(/\s?EUR/, ' €'); }

// ── Sub-components ─────────────────────────────────────────────────────────────

interface KpiCellProps { label: string; value: number | string; delta: string; last?: boolean; }

function KpiCell({ label, value, delta, last }: KpiCellProps) {
  return (
    <div style={{
      flex: 1,
      padding: '14px 20px',
      display: 'flex', flexDirection: 'column', gap: 6,
      borderRight: last ? 'none' : '1px solid #E6E4DF',
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#9A9A9A', fontFamily: 'var(--notion-mono)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontSize: 28, fontWeight: 700, color: '#1D1F1E', fontFamily: 'var(--notion-sans)', lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: 11, color: '#6B6B6B', fontFamily: 'var(--notion-sans)' }}>
        {delta}
      </span>
    </div>
  );
}

interface ViewBtnProps { active: boolean; onClick: () => void; title: string; bordered?: boolean; children: React.ReactNode; }

function ViewBtn({ active, onClick, title, bordered, children }: ViewBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        background: active ? '#1E5A3A' : '#fff',
        border: 'none',
        borderLeft: bordered ? '1px solid #E6E4DF' : 'none',
        padding: '8px 12px',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center',
        color: active ? '#fff' : '#6B6B6B',
        transition: 'background 140ms, color 140ms',
      }}
    >
      {children}
    </button>
  );
}

// ── Pipeline Page ──────────────────────────────────────────────────────────────

export function Pipeline({ store }: PipelineProps) {
  const [viewMode, setViewMode]           = useState<ViewMode>('kanban');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [, forceUpdate]                   = useState(0);

  useEffect(() => {
    const handler = () => forceUpdate(n => n + 1);
    window.addEventListener('ip-state-changed', handler);
    return () => window.removeEventListener('ip-state-changed', handler);
  }, []);

  const deals  = store.getDeals();
  const stages = store.getPipelineStages();
  const selectedDeal = selectedDealId ? store.getDeal(selectedDealId) : undefined;
  const panelOpen    = Boolean(selectedDeal);

  const kpis = useMemo(() => {
    const active     = deals.filter(d => !['Perdu', 'Bien vendu'].includes(d.stage));
    const mandats    = deals.filter(d => d.stage === 'Mandat signé').length;
    const vendus     = deals.filter(d => d.stage === 'Bien vendu').length;
    const commission = active.reduce((sum, d) => sum + d.commissionAmount, 0);
    return { active: active.length, mandats, vendus, commission };
  }, [deals]);

  const handleSelectDeal = (dealId: string) => {
    setSelectedDealId(prev => prev === dealId ? null : dealId);
  };

  const handleMoveDeal = (dealId: string, stageName: string) => {
    store.moveDealStage(dealId, stageName);
  };

  return (
    <div style={{
      minHeight: '100%',
      background: '#F7F6F3',
      fontFamily: 'var(--notion-sans)',
      position: 'relative',
      paddingRight: panelOpen ? 480 : 0,
      transition: 'padding-right 180ms ease',
    }}>

      {/* ── Page header ── */}
      <div style={{ padding: '24px 32px 0' }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, fontFamily: 'var(--notion-serif)', color: '#1D1F1E', letterSpacing: '-0.02em' }}>
          Opportunités
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B6B6B' }}>
          Suivi commercial de vos dossiers actifs
        </p>
      </div>

      {/* ── KPI row + actions ── */}
      <div style={{ padding: '16px 32px 0', display: 'flex', alignItems: 'stretch', gap: 12 }}>
        {/* KPI container */}
        <div style={{ flex: 1, background: '#fff', border: '1px solid #E6E4DF', borderRadius: 10, display: 'flex', alignItems: 'stretch' }}>
          <KpiCell label="Deals actifs"      value={kpis.active}               delta="Pipeline en cours" />
          <KpiCell label="Mandats signés"    value={kpis.mandats}              delta="Ce mois" />
          <KpiCell label="Biens vendus"      value={kpis.vendus}               delta="Ce mois" />
          <KpiCell label="Commission ouverte" value={fmtComm(kpis.commission)} delta="Estimée" last />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid #E6E4DF', borderRadius: 8, overflow: 'hidden' }}>
            <ViewBtn active={viewMode === 'kanban'} onClick={() => setViewMode('kanban')} title="Vue Kanban">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="7" height="18" rx="1" />
                <rect x="14" y="3" width="7" height="18" rx="1" />
              </svg>
            </ViewBtn>
            <ViewBtn active={viewMode === 'list'} onClick={() => setViewMode('list')} title="Vue Liste" bordered>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <line x1="8"  y1="6"  x2="21" y2="6"  />
                <line x1="8"  y1="12" x2="21" y2="12" />
                <line x1="8"  y1="18" x2="21" y2="18" />
                <line x1="3"  y1="6"  x2="3.01" y2="6"  />
                <line x1="3"  y1="12" x2="3.01" y2="12" />
                <line x1="3"  y1="18" x2="3.01" y2="18" />
              </svg>
            </ViewBtn>
          </div>

          {/* Filtres */}
          <button
            type="button"
            style={{ background: '#fff', border: '1px solid #E6E4DF', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontFamily: 'var(--notion-sans)', color: '#1D1F1E', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="6"  x2="20" y2="6"  />
              <line x1="7" y1="12" x2="17" y2="12" />
              <line x1="10" y1="18" x2="14" y2="18" />
            </svg>
            Filtres
          </button>

          {/* Nouveau deal */}
          <button
            type="button"
            style={{ background: '#1E5A3A', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'var(--notion-sans)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} />
            Nouveau deal
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ padding: '16px 32px 32px' }}>
        {viewMode === 'kanban' ? (
          <KanbanBoard
            deals={deals}
            stages={stages}
            onSelectDeal={handleSelectDeal}
            onMoveDeal={handleMoveDeal}
            selectedDealId={selectedDealId}
            store={store}
          />
        ) : (
          <PipelineListView
            deals={deals}
            stages={stages}
            onSelectDeal={handleSelectDeal}
            selectedDealId={selectedDealId}
            store={store}
          />
        )}
      </div>

      {/* ── Fiche panel ── */}
      {panelOpen && selectedDeal && (
        <DealFichePanel
          deal={selectedDeal}
          store={store}
          onClose={() => setSelectedDealId(null)}
          onMoveDeal={handleMoveDeal}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run lint and build**

```powershell
npm run lint
npm run build
```
Expected: no errors.

- [ ] **Step 3: Commit**

```powershell
git add src/pages/Pipeline.tsx
git commit -m "feat(pipeline): add Pipeline page component"
```

---

## Task 6: Wire `Pipeline` into `main.tsx`

**Files:**
- Modify: `src/main.tsx`

Three changes:
1. Add `import { Pipeline } from './pages/Pipeline';`
2. Remove `pipeline: pipelineHtml` from `legacyRoutes`
3. Add `pipeline` to the React render switch and fix `getRouteFromHash` validator

- [ ] **Step 1: Add the import after the existing page imports (line 16)**

In `src/main.tsx`, after `import { Biens } from './pages/Biens';` (line 16), add:

```tsx
import { Pipeline } from './pages/Pipeline';
```

- [ ] **Step 2: Remove `pipeline` from `legacyRoutes` (line 46)**

Change:
```tsx
const legacyRoutes: Partial<Record<RouteKey, string>> = {
  inbox: inboxHtml,
  pipeline: pipelineHtml,
  contacts: contactsHtml,
```

To:
```tsx
const legacyRoutes: Partial<Record<RouteKey, string>> = {
  inbox: inboxHtml,
  contacts: contactsHtml,
```

- [ ] **Step 3: Update `getRouteFromHash` to accept `pipeline` as a React route (line 59)**

Change:
```tsx
if (routeName === 'dashboard' || routeName === 'biens' || legacyRoutes[routeName]) return routeName;
```

To:
```tsx
if (routeName === 'dashboard' || routeName === 'biens' || routeName === 'pipeline' || legacyRoutes[routeName]) return routeName;
```

- [ ] **Step 4: Add `pipeline` case to the render switch (after `route === 'biens'`, before `legacyHtml`)**

Change:
```tsx
{route === 'dashboard' ? (
  <Dashboard store={store} />
) : route === 'biens' ? (
  <Biens store={store} />
) : legacyHtml ? (
```

To:
```tsx
{route === 'dashboard' ? (
  <Dashboard store={store} />
) : route === 'biens' ? (
  <Biens store={store} />
) : route === 'pipeline' ? (
  <Pipeline store={store} />
) : legacyHtml ? (
```

- [ ] **Step 5: Run lint and build**

```powershell
npm run lint
npm run build
```
Expected: no errors. `pipelineHtml` import is now unused — if lint warns, remove `import pipelineHtml from './pages/pipeline.html?raw';` from line 20.

- [ ] **Step 6: Start dev server and verify**

```powershell
npm run dev
```

Navigate to `http://127.0.0.1:3000/#pipeline` and verify:
- Page background is `#F7F6F3` (no notebook grid)
- KPI row shows 4 flat cells in a white container
- Kanban board shows 8 columns with `#E6E4DF` borders, `10px` radius
- Each column has deal cards with clean borders (no wavy divider)
- Toggle kanban/list switches views
- Click a deal card → fiche panel slides in from right
- Drag a card between columns → store updates, column counts change
- Sidebar `#pipeline` link navigates correctly

- [ ] **Step 7: Commit**

```powershell
git add src/main.tsx
git commit -m "feat(pipeline): wire Pipeline React component, remove legacy HTML route"
```

---

## Self-Review

**Spec coverage:**
- ✅ Background `#F7F6F3` clean — Task 5, page wrapper
- ✅ KPI row flat white container 4 cells — Task 5, `KpiCell`
- ✅ Column borders `1px solid #E6E4DF`, radius 10px — Task 1 CSS `.column`
- ✅ Deal card clean border, radius 8px, no wavy divider — Task 3 + Task 1 CSS
- ✅ View toggle kanban/list — Task 5
- ✅ Fiche panel intouché — Task 2, all class names preserved, same structure
- ✅ Drag & drop — Task 3 (kanban), Task 4 (list)
- ✅ Same paddingRight mechanism as Biens — Task 5, panelOpen state
- ✅ Stage colors preserved — Task 1 CSS `--col-color` variables
- ✅ Routing wired — Task 6
- ✅ `store.moveDealStage` used (not the HTML's `updateDealStage`) — Tasks 3, 4, 5

**Type consistency:**
- `stageNameToId` defined identically in `KanbanBoard.tsx` and `PipelineListView.tsx` — consistent
- `Store` type alias `typeof appStore` used consistently in all files
- `fmt` / `fmtComm` currency formatters defined locally in each file — consistent pattern with Biens
- `DealFichePanel` props: `deal: Deal`, `store: Store`, `onClose: () => void`, `onMoveDeal: (dealId: string, stageName: string) => void` — matches all call sites in `Pipeline.tsx`

**Placeholder scan:** None found.
