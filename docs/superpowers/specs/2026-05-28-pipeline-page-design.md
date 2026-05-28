# Pipeline Page — Design Spec
**Date:** 2026-05-28  
**Status:** Approved  
**Scope:** Migration DA de `src/pages/pipeline.html` vers React avec la direction artistique Notion/Twenty CRM

---

## Contexte

La page pipeline existe déjà en HTML legacy (`src/pages/pipeline.html`). Elle contient un kanban fonctionnel, une vue liste, et un panneau de fiche deal. Le store mock est complet (deals, stages, moveDealStage, etc.).

L'objectif est de créer `src/pages/Pipeline.tsx` en reprenant **exactement** le même squelette structurel que le HTML existant, et en appliquant la DA Notion/Twenty CRM déjà en place sur Dashboard et Biens.

---

## Contraintes fermes

- Le composant `fiche-panel` (mini fiche deal) **ne doit pas être touché** — son contenu, sa structure, et sa logique restent identiques.
- Pas de nouvelle dépendance npm sans validation explicite.
- Même tokens CSS que Biens : `#F7F6F3`, `#FFFFFF`, `#E6E4DF`, `var(--notion-sans)`, `var(--notion-serif)`, `var(--notion-mono)`, `#1E5A3A`, `#1D1F1E`, `#6B6B6B`, etc.
- Données mock uniquement via `store.getDeals()`, `store.getPipelineStages()`, etc.

---

## Architecture

### Fichier cible
`src/pages/Pipeline.tsx`

### Props
```ts
interface PipelineProps {
  store: Store;
}
```

### State local
```ts
type ViewMode = 'kanban' | 'list';
const [viewMode, setViewMode] = useState<ViewMode>('kanban');
const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
const [panelOpen, setPanelOpen] = useState(false);
```

---

## Squelette — zones dans l'ordre

```
<div class="ip-pipeline">                          ← fond #F7F6F3
  <header class="pipeline-header">
    <div class="pipeline-header-top">              ← titre Lora
    <div class="pipeline-header-row">              ← KPI row + actions
  </header>

  <div class="pipeline-content">                   ← flex row
    <main>
      {viewMode === 'kanban' && <KanbanBoard />}
      {viewMode === 'list'   && <ListView />}
    </main>
    <aside class="fiche-panel">                    ← INTOUCHÉ
      {panelOpen && <DealFichePanel deal={selectedDeal} />}
    </aside>
  </div>
</div>
```

---

## Section 1 — Pipeline Header

### pipeline-header-top
- Titre : `"Opportunités"` en Lora serif, 28px, fontWeight 700
- Sous-titre : `"Suivi commercial de vos dossiers actifs"`, Inter 13px, `#6B6B6B`
- **Pas** de barre verte `::before` (supprimée vs HTML legacy)
- Pas de banner illustration (différent de Biens — la page est plus fonctionnelle)

### pipeline-header-row
Deux zones en `display: flex; justify-content: space-between`:

**Zone gauche — KPI Row**  
Même pattern que Biens : conteneur blanc `background: #fff; border: 1px solid #E6E4DF; border-radius: 10px` avec 4 cellules séparées par `1px solid #E6E4DF`.

| KPI | Source |
|---|---|
| Deals actifs | `deals.filter(d => !['Perdu','Bien vendu'].includes(d.stage)).length` |
| Mandats signés | `deals.filter(d => d.stage === 'Mandat signé').length` |
| Biens vendus | `deals.filter(d => d.stage === 'Bien vendu').length` |
| Commission ouverte | `sum(deals.map(d => d.commissionAmount))` formaté en € |

Chaque cellule : label 10px mono uppercase `#9A9A9A`, valeur 28px semibold `#1D1F1E`, delta 11px `#6B6B6B`.

**Zone droite — Actions**  
Alignés en `flex; gap: 8px`:
1. Toggle Kanban/Liste — même style que le toggle grille/liste de Biens : `border: 1px solid #E6E4DF; border-radius: 8px`, actif = `background: #1E5A3A; color: #fff`, inactif = `background: #fff; color: #6B6B6B`
2. Bouton "Ouvrir mini fiche" — secondary, `border: 1px solid #E6E4DF; border-radius: 8px; background: #fff`
3. Bouton "Filtres" — secondary, même style
4. Bouton "Nouveau deal" — primary `background: #1E5A3A; color: #fff; border-radius: 8px`

---

## Section 2 — Kanban Board

### Colonnes
8 colonnes issues de `store.getPipelineStages()`, en `display: grid; grid-template-columns: repeat(8, 260px); overflow-x: auto`.

Chaque colonne `.column` :
- `background: #FFFFFF`
- `border: 1px solid #E6E4DF`
- `border-radius: 10px`
- `align-self: start`
- Couleur de dot par stage conservée (même variables `--col-color`)

**Column head** (`border-bottom: 1px solid #E6E4DF; padding: 12px 14px 10px`):
- Nom du stage : JetBrains Mono, 11px, uppercase, `#1D1F1E` + dot couleur
- Badge count : `background: #F3F2EF; border: 1px solid #E6E4DF; border-radius: 999px`
- Total valeur : Inter 11px `#6B6B6B`

**Column body** : padding `0 8px 10px`, gap `10px`, min-height `380px`

**Column empty** : `border: 1px dashed #E6E4DF; border-radius: 8px; background: #F7F6F3`

**Column add button** : `border: 1px dashed #E6E4DF; border-radius: 8px`, hover `border-color: #1E5A3A; color: #1E5A3A`

### Deal Cards
Structure conservée : `dc-img` (110px) + `dc-ai` badge score + `dc-body` + `dc-foot`.

Changements DA :
- `border: 1px solid #E6E4DF` (était `var(--sand-deep)`)
- `border-radius: 8px` (était 4px)
- Séparateur : `border-top: 1px solid #E6E4DF` simple (suppression du SVG ondulé)
- Hover : `box-shadow: 0 8px 24px rgba(0,0,0,0.08)` (était plus prononcé)
- Barre verte gauche au hover : conservée (`.deal-card::before`)

---

## Section 3 — List View

Groupes par stage (`list-group` par stage) conservés.

**list-group-head** : JetBrains Mono, dot couleur, count badge, total à droite — mêmes données, DA nettoyée (`#E6E4DF` borders, `#F3F2EF` backgrounds).

**list-row** :
- `background: #FFFFFF`
- `border: 1px solid #E6E4DF`
- `border-radius: 8px` (était 4px)
- Hover : `background: #F9F8F5; border-color: #CFC8B7`
- Barre verte gauche au hover : conservée (`::before`)
- Grid : `80px 1fr 100px 120px 140px 100px 60px 38px` — inchangé

---

## Section 4 — Fiche Panel (INTOUCHÉE)

La `fiche-panel` aside reste telle quelle — structure, CSS, logique JS de la mini fiche deal.

Seul ajustement autorisé : `border-left: 1px solid #E6E4DF` (au lieu de `var(--sand-deep)`) pour cohérence avec Biens.

Le `paddingRight` du contenu principal s'ajuste quand le panneau est ouvert, exactement comme dans Biens (`paddingRight: panelOpen ? 480 : 0`).

---

## Drag & Drop

Le drag & drop entre colonnes (kanban) et entre groupes (liste) est conservé via le `DragMgr` existant. Aucune lib externe.

En React, les handlers `dragstart`, `dragover`, `drop`, `dragend` sont portés en `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd` sur les éléments JSX concernés.

---

## Tokens de couleur par stage (inchangés)

```
nouveau     #8E8B83
qualifie    #7FA68E
contact     #4F7A95
visite      #C8A53B
proposition #C8893B
mandat      #1E5A3A
vendu       #1E5A3A
perdu       #C8553D
```

---

## Ce qui N'est PAS dans ce scope

- Modification du type `Deal` ou des méthodes du store
- Nouveau panneau de fiche deal
- Filtres avancés (les boutons sont présents mais non fonctionnels en V1)
- Pagination ou virtualisation
- Animations d'entrée (peuvent être ajoutées mais non requises)
