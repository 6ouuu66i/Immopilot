# Tests et CI

ImmoPilot utilise Node.js 22 en CI. Installe les dépendances avec `npm ci` avant les contrôles.

## Commandes locales

- `npm run typecheck` : vérification TypeScript sans émission.
- `npm run lint` : alias de compatibilité vers le typecheck tant qu’aucun linter dédié n’est installé.
- `npm run test:contracts` : contrats déterministes Playwright, sans test authentifié.
- `npm run test:e2e:local` : point d’entrée local sûr, identique aux contrats déterministes.
- `npm run test:e2e:auth` : seul test navigateur authentifié.
- `npm run test:ci` : 135 tests déterministes puis contrats statiques de la CI DB.
- `npm run ci:validate` : validation YAML de tous les workflows GitHub Actions.
- `npm run build` : build Vite de production.
- `npm run test:db:contracts` : contrats statiques de la CI PostgreSQL, sans Docker.
- `npm run ci:database` : reconstruction et validation complète de la base jetable ; Docker est requis.

## PostgreSQL, RLS et Auth

La CI DB utilise Supabase CLI `2.109.1`, épinglée exactement dans `package.json` et `package-lock.json`. Cette version stable embarque PostgreSQL `17.6.1.111`; `supabase/config.toml` fixe donc `major_version = 17` et le projet local `immopilot-ci`.

L’inventaire actuel comprend 58 migrations, 8 suites SQL/pgTAP et 200 assertions planifiées :

- F-001 : rôle, agence et activation des profils ;
- F-002 : acceptation atomique des invitations ;
- F-003 : machine à états des transferts ;
- F-006 : inscription sur invitation, reprise et nettoyage ;
- F-008/F-014 : Dashboard, RPC et vue matérialisée canonique ;
- F-009/F-010 : ledger, orchestration et observabilité du pipeline ;
- F-023 : santé système.
- Durcissement PostgreSQL : helpers `SECURITY DEFINER`, triggers de référence et compteur interne.

Chaque suite SQL ouvre une transaction, appelle `finish()` puis effectue un `rollback`. Les fixtures utilisent uniquement le domaine réservé `test.local` et créent actuellement 11 agences et 27 utilisateurs Auth jetables. Le seed est désactivé ; toutes les données viennent des migrations ou des transactions de test.

Le test `supabase/tests/f009_f010_advisory_lock_concurrency.sh` ouvre deux connexions `psql` distinctes. La première tient le verrou transactionnel du pipeline ; la seconde appelle le véritable orchestrateur et exige un ledger `skipped|cron|0`, puis les deux transactions sont annulées.

## Exécution locale complète

Prérequis : Node.js 22, Docker compatible avec l’API Docker, Bash et `psql`.

```bash
npm ci
npm run ci:database
```

Le script principal valide d’abord l’isolation, supprime un éventuel volume `immopilot-ci`, démarre la stack locale, attend PostgreSQL, exécute `supabase db reset --local --no-seed`, compare l’historique appliqué aux 58 migrations, lance chaque suite pgTAP puis le test de concurrence. Un trap conserve le premier code d’échec et exécute toujours `supabase stop --no-backup --project-id immopilot-ci`.

Cette machine Windows ne disposant pas de Docker utilisable, la reconstruction dynamique, pgTAP et la concurrence doivent être validés par GitHub Actions. Les contrats statiques restent reproductibles avec `npm run test:db:contracts`.

## Isolation de Pre-Alpha

Le workflow `Database CI` ne référence aucun secret Supabase, aucune URL hébergée et aucun environnement GitHub. Il installe uniquement la CLI épinglée depuis le lockfile et travaille sur les ports loopback déclarés dans `supabase/config.toml`.

Le dépôt contient encore un cache Supabase historique suivi par Git sous `supabase/.temp`. Le runner jetable supprime explicitement `project-ref`, `linked-project.json` et `pooler-url` avant d’exécuter le garde. Aucune valeur de ces fichiers n’est lue, utilisée ou affichée. Le garde refuse ensuite tout cache lié restant avant la première commande Supabase.

Le garde échoue avant le démarrage si un état lié existe dans `supabase/.temp`, si un identifiant distant interdit apparaît, si une URL n’est pas loopback, ou si l’une de ces variables distantes est définie :

- `SUPABASE_ACCESS_TOKEN` ;
- `SUPABASE_DB_PASSWORD` ;
- `SUPABASE_PROJECT_REF` ;
- `SUPABASE_SERVICE_ROLE_KEY`.

`DATABASE_URL`, `SUPABASE_DB_URL`, `SUPABASE_URL` et `VITE_SUPABASE_URL` ne sont acceptées que si leur hôte est `127.0.0.1`, `localhost` ou `::1`. Les commandes de liaison, push DB, déploiement de fonctions et migration liée sont interdites dans la surface CI DB. Aucune valeur de variable n’est affichée dans les logs.

## GitHub Actions et diagnostic

Le workflow applicatif existant continue d’exécuter validation YAML, typecheck, lint de compatibilité, 130 tests et build. Le workflow bloquant `Database CI` s’exécute en parallèle sur les pushes et pull requests visant `skeleton-review` ou `master`. Son timeout est de 40 minutes et une étape `always()` arrête la stack même si le script principal a échoué.

Pour diagnostiquer un échec :

1. relever la première migration ou suite en erreur dans le job `Supabase PostgreSQL contracts` ;
2. vérifier le résumé `migrations=… suites=… assertions=… concurrency=…` ;
3. reproduire les contrats sans Docker avec `npm run test:db:contracts` ;
4. avec Docker, relancer `npm run ci:database` sans ajouter de tolérance ou de retry masquant l’erreur.

Pour ajouter une suite SQL, crée un fichier `supabase/tests/<finding>.test.sql` avec un plan numérique unique, `begin`, `finish()` et `rollback`. Mets ensuite à jour le total attendu dans les contrats et ce document. Une suite critique ne peut pas disparaître sans faire échouer les contrats statiques.

## Test authentifié manuel

Le workflow applicatif manuel conserve son compte E2E limité à une agence de test. Il exige les secrets GitHub `E2E_EMAIL`, `E2E_PASSWORD`, `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`. Ce job est distinct de `Database CI` et n’est jamais invoqué par les scripts PostgreSQL locaux.

L’absence d’un secret fait échouer explicitement le job manuel. Le test ne doit effectuer aucune mutation destructive et ses traces authentifiées ne sont pas téléversées.
