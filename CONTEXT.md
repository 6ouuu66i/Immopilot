# ImmoPilot - Contexte de reprise Codex

Derniere mise a jour de ce contexte : 2026-07-03  
Reference prioritaire pour la DA et le score : ce fichier prime sur `AGENTS.md`, peu importe les dates de fichier.

Pour tout ce qui concerne la direction artistique, la palette, les tokens visuels, le `ScoreRing`, l'Indice de tension vendeur, le calcul `property_id` vs `listing_id`, le bareme, les familles de signaux, les signaux d'etat/evenement, les decays, les seuils, les garde-fous et l'architecture Postgres du score, `CONTEXT.md` est la source d'autorite.

Pour les autres sujets generaux du repo, utiliser `AGENTS.md` sauf instruction utilisateur plus recente.

## Stack

- React 19 + TypeScript + Vite
- Supabase Pro
- Tailwind CSS
- Migrations Supabase dans `supabase/migrations/YYYYMMDDHHMM_description.sql`

Regles de session importantes :

- Verifier `supabase migration list --linked` en debut de session avant toute intervention base liee a Supabase.
- Tester les changements SQL dans une transaction `BEGIN ... ROLLBACK` avant de pousser reellement.
- Ne jamais committer de vraies cles `.env.local`.

## Monitoring

PostHog est integre cote frontend en mode restrictif pour la beta.

- Variables : `VITE_POSTHOG_KEY` et `VITE_POSTHOG_HOST` dans `.env.local`; exemples sans secret dans `.env.example`.
- Initialisation : `src/lib/posthog.ts`, appelee depuis `src/main.tsx`.
- Objectif actif : pageviews et erreurs seulement.
- Erreurs capturees : exceptions JS non gerees, promesses rejetees non gerees, et erreurs React via `PostHogErrorBoundary`.
- Tags ajoutes sur les evenements : `environment` (`import.meta.env.MODE`) et `app_version` (`VITE_APP_VERSION`, fallback `dev`).
- Desactive volontairement pour proteger les performances de pages denses comme Biens : `autocapture`, `capture_pageleave`, session recording, heatmaps, performance capture, dead clicks et rage clicks.
- Dashboard : consulter le projet PostHog associe a `VITE_POSTHOG_KEY`.

## Etat produit

- MVP CRM fonctionnel : auth multi-agence, deals/pipeline, contacts, taches, commissions, transferts, notifications temps reel.
- Chantier IA/Signaux termine et automatise.
- Les signaux deterministes existants sont calcules en base reelle via triggers evenementiels et l'orchestrateur `sync_daily_market_signals()` sur pg_cron quotidien.
- Table principale des signaux : `listing_signals` avec `property_id`, `listing_id`, `signal_type`, `metadata jsonb`, `is_active`, `detected_at`.
- Signaux existants :
  - `fsbo`
  - `price_drop`
  - `below_market`
  - `overpriced`
  - `multi_source`
  - `republished`
  - `stale_dom_relative`
  - `failed_launch`
  - `competition_shock`
  - `back_to_market`
  - `agency_mandate_aging`
- Repo nettoye : branche unique `master`, plus de legacy HTML, dependances mortes retirees.

## Direction UI

Le contexte du 2026-07-03 mentionnait une refonte visuelle "La Cote" :

- Fond `#F6F7F5`
- Surfaces `#FFFFFF`
- Bordure `1px #E1E4E1`
- Encre `#101613`
- Vert foret `#1E5A3A` reserve aux signaux d'opportunite
- Angles strictement carres (`radius: 0`)
- Typographie a trois roles :
  - `--font-title` : Archivo, titres uniquement
  - `--font-sans` : Inter, corps et labels
  - `--font-mono` : JetBrains / IBM Plex Mono pour les chiffres affiches
- `ScoreRing` conserve comme composant.

Attention : les sections design de `AGENTS.md` peuvent etre obsoletes. Pour la DA et les tokens visuels, cette section "La Cote" prime sur `AGENTS.md`, meme si `AGENTS.md` est date plus recemment.

## Prochaine brique : score d'opportunite

Nom produit valide : **Indice de tension vendeur**.

Ne jamais l'appeler "probabilite".

Trois objets doivent rester separes :

- Score : 0-100
- Confiance : haute / moyenne / faible
- Statut mandat : categoriel, jamais fusionne dans le score

Le signal `agency_mandate_aging` reste categoriel avec trois etats :

- `monitor`
- `watchlist_sortie_probable`
- `activable_sous_verification`

Contrainte deontologique IPI : prudence obligatoire, ne pas transformer ce statut mandat en chiffre.

## Decision de calcul du score

Decision tranchee le 2026-07-04 : le score se calcule au niveau du bien deduplique (`property_id`), pas au niveau de l'annonce (`listing_id`).

Mesure effectuee sur la base liee le 2026-07-04 :

- 117 annonces actives.
- 100 biens avec au moins une annonce active.
- 11 `property_id` avec plus d'une annonce active simultanee.
- Maximum observe : 5 annonces actives pour un meme `property_id`.
- Moyenne : 1,17 annonce active par bien actif.

Raison produit et technique : un meme bien present sur plusieurs portails, ou duplique dans une meme source, ne doit pas afficher plusieurs indices contradictoires. Les signaux restent capturables au niveau `listing_id` pour garder la tracabilite source, mais le calcul, l'historique, le breakdown et l'affichage de l'Indice de tension vendeur doivent etre agreges par `property_id`.

Contrat cible :

- Table brute des signaux : `listing_signals(property_id, listing_id, ...)`.
- Table courante du score : une ligne par `property_id` et `scoring_version`.
- Historique du score : snapshots par `property_id`.
- Breakdown : contributions agregées par famille, avec references possibles aux `listing_id` contributeurs.

## Bareme v1 valide

Le bareme est sujet a ajustement par backtest avant gel en `scoring_version = 1`.

| Famille | Signaux | Plafond | Kind / decay |
|---|---|---:|---|
| Prix | `below_market` + `overpriced` max 28 ; `price_drop` max 14 | 38 | state ; event 21j |
| Temps | `stale_dom_relative` max 22 ; `failed_launch` max 15 | 25 | state ; event 30j |
| Friction | `back_to_market` | 26 | event 45j |
| Concurrence | `competition_shock` | 10 | state |
| Diffusion | `multi_source` 4 ; `republished` 4 | 6 | state ; event 30j |
| Marketing | sous-exposition photos / description | 5 | state, prevu mais non implemente |
| PEB | informatif seulement | 0 | jamais score |

Regles de calcul :

- Signaux d'etat : aucune decroissance temporelle, plein poids tant que le signal est actif.
- Signaux d'evenement : decroissance exponentielle avec demi-vie propre a chaque signal.
- Ne jamais appliquer une decay uniforme a tous les signaux.
- Les multiplicateurs de contexte FSBO / mandat agence modifient le poids d'un meme signal.
- Les multiplicateurs doivent vivre dans `scoring_config.mult_fsbo` et `scoring_config.mult_agency`, pas dans une deuxieme formule.

Seuils de depart a valider par backtest :

- `>= 75` : Forte
- `52-74` : A surveiller
- `< 52` : Faible priorite

Garde-fous :

- Hysteresis de +/- 3 points contre le flapping jour a jour.
- La bande "Forte" exige au moins deux familles contributrices.

## Architecture Postgres cible

Fonction cible :

- `compute_listing_scores()`
- Set-based
- Pas de loop ligne par ligne
- Appelee en fin du job cron existant dans l'ordre : signaux -> score -> snapshot historique

Tables de configuration :

- `scoring_families`
- `scoring_config`
- `scoring_versions`

Principe : poids, seuils et demi-vies ajustables par `UPDATE`; aucun chiffre en dur dans le code.

Tables de sortie :

- `listing_scores` : etat courant
- `listing_score_history` : snapshot on-change
- `listing_outcomes` : mandat gagne/perdu/contact sans suite, alimentee des le jour 1 pour calibration empirique future

Breakdown :

- Stockage JSONB
- Format plat obligatoire : `breakdown.reasons[]`
- Chaque entree expose au minimum `signal`, `family`, `contribution`, `reason_fr` et `facts`
- Tri par contribution decroissante directement produit par `compute_listing_scores()`
- Pas de format imbrique `families[].signals[]` dans `listing_scores.breakdown`
- Contrat stable pour une future Edge Function de resume narratif, sans recalcul

## Sequencement recommande

1. Phase 0 - Backtest
   - Prochaine etape immediate avant tout code de production.
   - Rejouer le bareme sur l'historique `price_history` et les signaux existants.
   - Utiliser des snapshots hebdomadaires des derniers mois disponibles.
   - Mesurer la distribution reelle par bande.
   - Ajuster seuils/plafonds si necessaire.
   - Geler en `scoring_version = 1`.
2. Phase 1 - Fondations SQL
   - Migrations config.
   - Tables de sortie.
   - Fonction de calcul.
   - Integration au cron.
3. Phase 2 - Outcomes automatiques
   - Hook scraper de depublication vers `listing_outcomes`.
4. Phase 3 - Frontend
   - Zone score sur card avec anneau existant.
   - Couleur = bande.
   - Deux reason codes visibles en clair.
   - Badge statut mandat separe visuellement, jamais fusionne.
   - Bloc detaille "Pourquoi cet indice" sur la fiche.
   - Bouton "Pas d'accord" avec trois options ecrites dans `listing_outcomes`.
5. Phase 4 - Optionnel apres stabilisation
   - Edge Function resume narratif.
   - Tri par momentum, delta 7 jours.
   - Vue QA interne.

## Dette assumee

La calibration empirique des poids sur vrais mandats signes est explicitement reportee.

Elle attend la beta et du volume reel dans `listing_outcomes`; ce n'est pas un probleme de volume de scraping.

## Phase 0 - Etat de verification au 2026-07-04

Script de controle ajoute : `scripts/backtest_seller_tension_score.sql`.

Clarification importante : le script actuel n'est pas un vrai backtest historique au sens strict. Il calcule principalement une distribution sur l'etat present des signaux actifs et applique la formule v1 au niveau `property_id`. La sortie hebdomadaire est seulement un smoke test limite : `price_history` existe depuis 2026-04-30, mais les signaux d'etat de `listing_signals` ont surtout ete backfilles/detectes le 2026-07-02. Les semaines precedentes ne permettent donc pas de reconstruire fidelement quels signaux d'etat etaient vrais a chaque date.

Resultat du run de controle sur la base liee :

- 8 biens en bande `a_surveiller`, score moyen 60,9, min 58, max 63.
- 92 biens en `faible_priorite`, score moyen 16, max 49.
- 0 bien en `forte`.
- Score moyen global : 19,6.

Interpretation : ce run valide que la formule ne plante pas et donne une premiere distribution sur le jeu actuel. Il ne doit pas servir a recalibrer les seuils. Garder les seuils `75 / 52` comme provisoires mais non figes.

Signal Marketing : `marketing_underexposed` n'existe pas dans la contrainte CHECK de `listing_signals.signal_type`, aucune fonction/trigger de detection n'a ete trouve, et aucune ligne n'existe en base. Sa contribution a 0 signifie donc "signal prevu au bareme mais jamais implemente", pas "signal actif avec contribution nulle".

Prochaine decision pragmatique : avancer sur la Phase 1 avec les seuils actuels, puis relancer ce script periodiquement apres plusieurs semaines de cron en production et/ou sur un volume plus large de communes scrapees.

## Phase 1 - Fondations SQL appliquees le 2026-07-04

Migrations poussees sur la base liee :

- `20260704171941_create_scoring_config.sql`
- `20260704171942_create_scoring_output_and_function.sql`

Tables creees :

- `scoring_families`
- `scoring_config`
- `scoring_versions`
- `listing_scores`
- `listing_score_history`
- `listing_outcomes`

Fonctions creees :

- `compute_listing_confidence(property_id uuid)`
- `compute_listing_scores()`

Contrat de sortie score corrige le 2026-07-04 :

- `compute_listing_scores()` produit directement `breakdown.reasons[]`, plat et trie par contribution decroissante.
- Le frontend consomme `breakdown.reasons` sans aplatir `families[].signals[]`.
- `breakdown.families` est obsolete et ne doit plus etre ecrit dans `listing_scores`.

La fonction de score n'est pas encore branchee au cron de production. Elle a ete appelee manuellement pour valider le schema.

Signal keys verifies en base avant seed :

- Presents dans les donnees actuelles : `below_market`, `competition_shock`, `failed_launch`, `fsbo`, `overpriced`, `stale_dom_relative`.
- Autorises par le CHECK et seedes car deja modelises comme signaux reels : `price_drop`, `multi_source`, `republished`, `back_to_market`.
- Non seede dans `scoring_config` : `fsbo` car c'est un contexte multiplicateur, pas une contribution directe du bareme.
- Non seede : `agency_mandate_aging` car le statut mandat reste categoriel et jamais score.
- Non seede : `marketing_underexposed` car le signal n'existe pas encore dans `listing_signals`.

Resultat test transactionnel `BEGIN ... ROLLBACK` :

- `faible` : 92 biens, score moyen 15,8, signaux moyens 0,97.
- `surveiller` : 8 biens, score moyen 60,1, signaux moyens 3,25.
- `forte` : 0 bien.
- 100 lignes calculees dans `listing_scores` pendant le test.
- 29 biens actifs sans signal recoivent explicitement un score 0.

Resultat apres push reel et appel manuel `compute_listing_scores()` :

- `faible` : 92 biens, score moyen 15,8, signaux moyens 0,97.
- `surveiller` : 8 biens, score moyen 60,1, signaux moyens 3,25.
- `forte` : 0 bien.
- `listing_score_history` : 100 snapshots initiaux.
- `listing_outcomes` : 0 ligne, table vide comme prevu pour la Phase 2.

Comparaison Phase 0 : coherent avec le smoke test precedent (`a_surveiller` 8 biens a 60,9 moyen, `faible_priorite` 92 biens a 16 moyen). L'ecart vient de la fonction reelle qui ne rejoue plus directement `price_history` et s'appuie sur les signaux actifs/configures.

## En reserve

Non urgent :

- Chantier CRM/workflow : relances automatiques, checklist mandat belge 6 mois, detection doublons inter-agents.
- Statbel/SPF fallback de `market_reference`.
- GitHub Actions cron scraping, encore manuel.
- `.limit(80)` dans `supabaseProperties.ts`.
- Logo / identite de marque : le nom "ImmoPilot" a des conflits de marque identifies en Allemagne, Autriche et France ; un nouveau nom reste a trouver.

## Documents de reference

Documents mentionnes comme disponibles dans le contexte source :

- `ImmoPilot-Documentation-Technique.md` : schema DB, RLS, patterns de code.
- `ImmoPilot-Etat-Roadmap.md` : historique detaille, decisions, roadmap complete.

Coller ou fournir ces deux documents si un contexte plus approfondi devient necessaire.
