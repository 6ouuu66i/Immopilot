# ImmoPilot — Design Tokens

> Fichier source : `src/styles/tokens.css`  
> Règle d'or : aucune valeur brute (hex, px, rgba) dans les composants — toujours référencer un token ci-dessous.

---

## 1. Palette

**Usage** — Utilisez les alias sémantiques (`--text`, `--surface`, `--border`…) dans les composants ; les tokens de base (`--ip-ink-*`, `--ip-paper`) servent surtout à définir le thème ou des déclinaisons futures.

| Token | Valeur | Rôle |
|-------|--------|------|
| `--ip-ink-900` | `#101613` | Texte principal, titres |
| `--ip-ink-700` | `rgba(16,22,19,0.62)` | Texte secondaire / muted |
| `--ip-ink-500` | `rgba(16,22,19,0.42)` | Labels, placeholders, faint |
| `--ip-ink-300` | `rgba(16,22,19,0.24)` | Bordures fortes |
| `--ip-ink-200` | `rgba(16,22,19,0.14)` | Bordures par défaut |
| `--ip-ink-100` | `rgba(16,22,19,0.08)` | Hairlines, séparateurs fins |
| `--ip-ink-050` | `rgba(16,22,19,0.04)` | Ombres ambient, fonds très légers |
| `--ip-paper` | `#FFFFFF` | Surface carte / popover |
| `--ip-paper-alt` | `#FAFAF9` | Fond d'application |
| `--ip-paper-soft` | `#F7F8F6` | Hover surface, fonds alternés |
| `--ip-green-700` | `#16442C` | Primary hover |
| `--ip-green-600` | `#1E5A3A` | Primary / CTA |
| `--ip-green-050` | `#F1F6F3` | Fond teinté vert (sélection, succès) |
| `--ip-red-600` | `#B3402E` | Danger, erreur, alerte |
| `--ip-ocre-600` | `#8A6D1F` | Warning, attention |

### Alias sémantiques (préférés dans le CSS composant)

| Alias | Pointe vers | Quand l'utiliser |
|-------|-------------|------------------|
| `--text` | `--ip-ink-900` | Tout texte lisible |
| `--muted` | `--ip-ink-700` | Meta, description, secondaire |
| `--faint` | `--ip-ink-500` | Labels, hints, placeholders |
| `--border` | `--ip-ink-200` | Bordure par défaut (cartes, inputs) |
| `--border-strong` | `--ip-ink-300` | Bordure active / focus visible |
| `--hairline` | `--ip-ink-100` | Séparateurs subtils |
| `--surface` | `--ip-paper` | Fond de carte, popover, modal |
| `--app-bg` | `--ip-paper-alt` | Root background de l'app |
| `--surface-soft` / `--hover` | `--ip-paper-soft` | Survol, rangées alternées |
| `--green` | `--ip-green-600` | Boutons primaires, liens actifs |
| `--green-hover` | `--ip-green-700` | État hover primaire |
| `--green-tint` | `--ip-green-050` | Badge "succès", fond de sélection |
| `--red` | `--ip-red-600` | Destructif, erreur |
| `--ocre` | `--ip-ocre-600` | Warning, statut à risque |

### Tons sémantiques (badges, statuts, indicateurs)

| Token | Couleur | Usage typique |
|-------|---------|---------------|
| `--tone-good` | `--ip-green-600` | Opportunité gagnée, tâche faite |
| `--tone-warn` | `--ip-ocre-600` | En attente, relance |
| `--tone-risk` | `--ip-red-600` | Perdu, urgent, bloquant |
| `--tone-neutral` | `--ip-ink-700` | Info, brouillon, inactif |

---

## 2. Typographie

**Usage** — Utilisez `--font-title` pour les titres de page et les chiffres clés ; `--font-sans` pour tout le corps de texte ; `--font-mono` pour les données techniques (prix, IDs, dates). Choisissez la taille via l'échelle `--fs-*` et jamais de valeur px brute.

| Token | Valeur | Usage |
|-------|--------|-------|
| `--font-title` | `Archivo, Inter, system-ui, sans-serif` | Titres, KPIs, chiffres |
| `--font-sans` | `Inter, system-ui, sans-serif` | Corps, labels, boutons |
| `--font-mono` | `JetBrains Mono, IBM Plex Mono, Consolas, monospace` | Prix, IDs, dates, code |
| `--fs-display` | `28px` | Valeur KPI (ex. 12 opportunités) |
| `--fs-h1` | `22px` | Titre de page |
| `--fs-h2` | `18px` | Titre de section |
| `--fs-h3` | `15px` | Titre de carte |
| `--fs-body` | `13px` | Corps de texte standard |
| `--fs-meta` | `12px` | Meta, légendes |
| `--fs-micro` | `11px` | Pills, badges, claviers |
| `--fs-caps` | `10px` | Labels ALL CAPS |
| `--lh-tight` | `1.15` | Titres, chiffres |
| `--lh-body` | `1.5` | Paragraphes, listes |
| `--tracking-caps` | `0.08em` | Espacement lettres caps |
| `--fw-regular` | `400` | Texte courant |
| `--fw-medium` | `500` | Labels, boutons secondaires |
| `--fw-semi` | `600` | Titres, données chiffrées |
| `--fw-bold` | `700` | Emphase, prix |

---

## 3. Espacement

**Usage** — Base de `4px`. Multipliez par le token pour garder une grille cohérente ; `--space-4` (16 px) est le "gouttière" standard entre cartes ou sections.

| Token | Valeur | Usage typique |
|-------|--------|---------------|
| `--space-1` | `4px` | Micro-ajustements, icône+texte |
| `--space-2` | `8px` | Padding interne compact |
| `--space-3` | `12px` | Gap entre petits éléments |
| `--space-4` | `16px` | **Gouttière par défaut** (cartes, sections) |
| `--space-5` | `20px` | Padding modal, drawer |
| `--space-6` | `24px` | Marge verticale entre blocs |
| `--space-8` | `32px` | Séparation de zones |
| `--space-10` | `40px` | Hero, header large |
| `--space-12` | `48px` +` | Layout macro |

---

## 4. Border Radius

**Usage** — `--radius-md` est le rayon par défaut de presque tous les composants (cartes, boutons, inputs). `--radius-pill` est réservé aux tags et badges. `--radius-xs` est pour les cases à cocher et les miniatures.

| Token | Valeur | Usage |
|-------|--------|-------|
| `--radius-xs` | `2px` | Checkbox, thumbnail, micro-éléments |
| `--radius-sm` | `3px` | Petits boutons, tags compacts |
| `--radius-md` | `4px` | **Défaut cartes / boutons / inputs** |
| `--radius-lg` | `6px` | Modales, panneaux latéraux |
| `--radius-pill` | `999px` | Badges, pills, filtres actifs |

---

## 5. Ombres

**Usage** — Ne jamais écrire de `box-shadow` brute. `--shadow-card` est l'ombre par défaut des surfaces ; `--shadow-lift` au hover d'une carte interactive ; `--shadow-float` pour les modales et dropdowns.

| Token | Description | Usage |
|-------|-------------|-------|
| `--shadow-flat` | `0 1px 0` (subtil) | Barres, headers collés |
| `--shadow-inset` | `inset 0 -1px 0` | Ligne interne en bas d'élément |
| `--shadow-card` | `0 1px 2px` ambient | **Carte au repos** |
| `--shadow-lift` | `0 4px 12px -6px …` | Carte hover, élément remonté |
| `--shadow-hover` | `0 8px 22px -14px …` | Panneau étendu, preview |
| `--shadow-float` | `0 18px 40px -18px …` | **Modale, dropdown, popover** |
| `--shadow-focus` | `0 0 0 3px rgba(30,90,58,0.22)` | Focus visible (accessibilité) |

---

## 6. Tokens d'état (States)

**Usage** — Ces tokens garantissent que les états hover, sélection et désactivé restent cohérents partout sans répéter de couleurs.

| Token | Valeur | Quand l'utiliser |
|-------|--------|------------------|
| `--state-hover-bg` | `--surface-soft` | Fond au survol d'une ligne / carte |
| `--state-selected-bg` | `--green-tint` | Fond d'un élément sélectionné |
| `--state-selected-border` | `--green` | Bordure d'un élément sélectionné |
| `--state-disabled-opacity` | `0.5` | Opacité d'un élément désactivé |

---

## 7. Motion & Transitions

**Usage** — Préférez `--transition-colors` pour les changements de couleur et `--transition-lift` pour les transformations (scale, translate) afin d'unifier la physique de l'interface.

| Token | Valeur | Usage |
|-------|--------|-------|
| `--ease-out` | `cubic-bezier(0.22,1,0.36,1)` | Entrées, apparitions |
| `--ease-in` | `cubic-bezier(0.4,0,1,1)` | Sorties, fermetures |
| `--ease-std` | `cubic-bezier(0.4,0,0.2,1)` | **Transition par défaut** |
| `--dur-fast` | `120ms` | Hover micro, toggle |
| `--dur-base` | `200ms` | **Durée par défaut** (boutons, panels) |
| `--dur-slow` | `380ms` | Modales, page transitions |
| `--dur-ring` | `900ms` | Animation de focus ring |
| `--transition-colors` | `color, background-color, border-color` | Changements de teinte |
| `--transition-lift` | `transform, box-shadow` | Éléments qui "remontent" |

> **Accessibilité** — `prefers-reduced-motion: reduce` met toutes les durées à `1ms` (pas d'animation).

---

## 8. Z-Index

**Usage** — Référencer toujours un token plutôt qu'une valeur arbitraire pour éviter les guerres de `z-index`.

| Token | Valeur | Couche |
|-------|--------|--------|
| `--z-base` | `1` | Élément légèrement au-dessus |
| `--z-sticky` | `10` | Header sticky, colonne fixe |
| `--z-panel` | `20` | Drawer, side-panel |
| `--z-topbar` | `30` | Topbar, barre de commande |
| `--z-modal` | `40` | Modale, overlay |
| `--z-toast` | `50` | Notification toast |

---

## 9. Layout (grids & dimensions fixes)

| Token | Valeur | Usage |
|-------|--------|-------|
| `--sidebar-w` | `232px` | Largeur sidebar dépliée |
| `--sidebar-w-collapse` | `56px` | Largeur sidebar repliée |
| `--topbar-h` | `52px` | Hauteur de la barre supérieure |
| `--panel-w` | `420px` | Largeur panneau latéral détail |
