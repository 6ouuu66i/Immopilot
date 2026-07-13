# Tests et CI

ImmoPilot utilise Node.js 22 en CI. Installe les dépendances avec `npm ci` avant les contrôles.

## Commandes locales

- `npm run typecheck` : vérification TypeScript sans émission.
- `npm run lint` : alias de compatibilité vers le typecheck tant qu’aucun linter dédié n’est installé.
- `npm run test:contracts` : helpers et contrats déterministes, sans test authentifié.
- `npm run test:e2e:local` : point d’entrée local sûr, identique aux contrats déterministes.
- `npm run test:e2e:auth` : seul test navigateur authentifié.
- `npm run test:ci` : suite déterministe exécutée sur chaque changement.
- `npm run ci:validate` : validation YAML des workflows GitHub Actions.
- `npm run build` : build Vite de production.

Les tests SQL dans `supabase/tests` sont réservés à une stack Supabase locale. Ils nécessitent Docker et `psql`, puis `supabase start` et `supabase test db`. Le test shell de concurrence se lance séparément contre cette base locale. Ne pointe jamais ces commandes vers la production ou le projet Pre-Alpha.

## Test authentifié

Le workflow manuel utilise un compte E2E limité à une agence de test. Il exige les secrets GitHub `E2E_EMAIL`, `E2E_PASSWORD`, `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`. Ne stocke ni n’affiche leurs valeurs dans le dépôt ou les logs.

L’absence d’un secret fait échouer explicitement le job manuel. Le test ne doit effectuer aucune mutation destructive. Les traces et captures authentifiées ne sont pas téléversées afin d’éviter d’exposer une session.

## Comportement de la CI

Les pull requests et pushes vers `skeleton-review` ou `master` exécutent validation YAML, typecheck, lint de compatibilité, tests déterministes et build. Les runs précédents de la même branche sont annulés. En cas d’échec déterministe, `playwright-report` et `test-results` sont conservés sept jours, à l’exclusion des fichiers de session ou de base.

Ouvre `playwright-report/index.html` localement pour consulter le rapport. Les traces et captures ne sont produites qu’en cas d’échec non authentifié.

Si un test devient instable, reproduis-le isolément, remplace les attentes temporelles par une attente métier ou réseau, puis documente la cause. Ne désactive pas un test et n’ajoute pas de retry supplémentaire sans cause identifiée.
