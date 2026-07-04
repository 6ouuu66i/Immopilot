## Objectif
Appliquer la refonte visuelle **Variante B — Premium CRM** sur la sandbox ImmoPilot sans changer la structure, la logique, ni les données mockées.

## Contexte technique actuel
- Le projet sandbox est un template TanStack Start avec Tailwind v4.
- L’application ImmoPilot uploadée est une app Vite+React monofichier (App.tsx + styles.css) avec routing par état React.
- Les dépendances nécessaires (React, Lucide) sont déjà présentes dans le projet sandbox.

## Étapes d’implémentation

### 1. Intégration de l’app ImmoPilot dans le projet sandbox
- Copier le contenu de `App.tsx` uploadé dans `src/routes/index.tsx` (composant principal de la route `/`).
- Inclure les styles de l’app uploadée dans `src/styles.css` en complément du setup Tailwind (les classnames `.app-shell`, `.sidebar`, etc. n’entrent pas en conflit avec les utilitaires Tailwind).
- Charger les polices Google (Archivo, Inter, JetBrains Mono) via `<link>` dans le `head()` de `src/routes/__root.tsx`, conformément aux règles Tailwind v4.

### 2. Refonte du design system (Variante B)
Les modifications portent uniquement sur le CSS et de très légers ajustements JSX si nécessaire pour la cohérence visuelle.

#### 2.1 Fondations
- **Palette :** appliquer strictement les couleurs cibles (fond `#EDF0EE`, surface `#FFFFFF`, texte `#101613`, etc.).
- **Typographie :** titres en Archivo, corps en Inter, chiffres en JetBrains Mono tabulaire. Tous les prix, scores, KPI, surfaces, chambres, commissions, dates et pourcentages passent en mono.
- **Formes :** radius max 4px sur toutes les surfaces (cards, boutons, inputs, badges, filtres). Pas de pills, pas de grands arrondis.

#### 2.2 Composants prioritaires (dans l’ordre demandé)
1. **Sidebar :** plus aérée, hiérarchie améliorée par le spacing, états actifs/hover plus nets, compteurs en vert premium.
2. **Topbar :** hauteur et padding retravaillés, recherche globale plus sobre, bouton "Nouveau" mieux intégré.
3. **Dashboard :** grille KPI mieux espacée, panneaux latéraux (tâches, signaux) avec plus de structure, table des priorités commerciales avec hover plus fin.
4. **Page Biens :** onglets et filtres moins arrondis, grille de cards mieux calibrée.
5. **Cards biens :** photo dominante conservée, badge signal mieux placé, prix/surface/chambres en mono, état selected plus premium (bordure verte fine plutôt que gros outline), hover plus subtil.
6. **Mini fiche / panneau latéral :** type fiche CRM (inspiration Attio/Twenty). Photo en haut, score IA en cercle plus net et sobre (mono), blocs d’info bien séparés avec de l’air, actions du contact plus lisibles.

#### 2.3 Détails transversaux
- **Bordures :** plus fines et cohérentes (`rgba(16, 22, 19, 0.14)`), utilisation plus ciblée du vert comme accent actif.
- **Hover / Focus :** états plus précis, sans gros fonds colorés.
- **Badges :** rectangulaires 4px, couleurs de fond très légères (8–10 % d’opacité).
- **Score IA :** cercle conservé, stroke plus fin, chiffre en mono, couleur contextuelle (vert/orange/rouge) uniquement si le score l’exige.
- **Pas de :** gradients, grosses ombres, style pastel/crème, icônes dans carrés beiges génériques.

### 3. Validation
- Vérifier que le preview affiche correctement les 4 vues (Dashboard, Biens, Opportunités, Contacts).
- Vérifier que les signaux, scores, KPI, cards et panneaux latéraux sont tous présents et lisibles.
- Vérifier que la typographie mono est bien appliquée aux chiffres.

## Ce qui est volontairement hors scope
- Aucune connexion backend (pas de Supabase, pas d’API).
- Aucune nouvelle feature ou page.
- Aucun changement de structure (pas de passage à TanStack Router file-based pour l’interne ; le routing par état React est conservé).
- Aucune modification des données mockées.