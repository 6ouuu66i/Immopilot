# Audit du parcours utilisateur principal

Date : 2026-07-12  
Périmètre : connexion → biens → contact → deal → pipeline → tâche → agenda.

## Statut du parcours testé

| Étape | Statut | Données et connexion | Fichiers principaux |
|---|---|---|---|
| 1. Connexion | Fonctionnelle | Supabase Auth réel. Profil et agence chargés depuis `profiles` et `agencies`. | `src/pages/Login.tsx`, `src/lib/auth.tsx`, `src/main.tsx` |
| 2. Liste des biens | Fonctionnelle | Données réelles paginées depuis Supabase. Aucun fallback fictif lorsque Supabase est configuré. | `src/pages/Biens.tsx`, `src/lib/supabaseProperties.ts` |
| 3. Recherche, filtres, tri | Fonctionnelle | Recherche et filtres envoyés au service Supabase lorsque la pagination serveur est disponible ; filtre local pour les vues qui ne la supportent pas. Recherche sans résultat et menu de tri testés. | `src/pages/Biens.tsx`, `src/lib/supabaseProperties.ts` |
| 4. Mini-fiche | Fonctionnelle après correction | Détail du listing chargé depuis Supabase. Les actions contact et tâche sont maintenant accessibles. | `src/pages/Biens.tsx` |
| 5. Fiche détaillée | Fonctionnelle | Détail réel du listing ; les champs absents restent affichés comme absents et non inventés. | `src/pages/Biens.tsx`, `src/lib/supabaseProperties.ts` |
| 6. Contact | Fonctionnelle | Création réelle dans Supabase puis association réelle via le service contacts. Testé avec `QA Parcours Principal`. | `src/pages/Contacts.tsx`, `src/lib/useContacts.ts`, `src/lib/services/contactsService.ts` |
| 7. Deal | Fonctionnelle | Deal réel créé depuis une mini-fiche avec `property_id` et `contact_id`. Testé avec `DEAL-0005`. | `src/pages/Biens.tsx`, `src/lib/useDeals.ts`, `src/lib/services/dealsService.ts` |
| 8. Pipeline | Fonctionnelle | Étapes et deals Supabase. Succès et échec d'un déplacement vérifiés ; l'échec restaure l'étape précédente et affiche un message local unique. | `src/pages/Pipeline.tsx`, `src/lib/useDeals.ts`, `src/lib/services/dealsService.ts` |
| 9. Tâche/rappel | Fonctionnelle après correction | Tâche réelle créée dans Supabase, liée au bien, avec échéance demain à 09:00 locale. | `src/pages/Biens.tsx`, `src/lib/useTasks.ts`, `src/lib/services/tasksService.ts` |
| 10. Agenda | Fonctionnelle | La tâche créée depuis le bien est visible et recherchable dans l’agenda avec son lien vers le bien. | `src/pages/Agenda.tsx`, `src/lib/useTasks.ts`, `src/lib/services/tasksService.ts` |

## Problèmes

### P0 — Bloquants

- **Corrigé — actions CRM absentes de la mini-fiche active.** Les handlers Supabase existaient, mais aucun sélecteur de contact, champ de tâche ou retour d’action n’était rendu. Il était impossible d’associer un contact, donc de créer un deal depuis un bien, et impossible de créer réellement une tâche depuis cette mini-fiche.

### P1 — Importants

- **Corrigé — échéance incohérente.** Le message annonçait « demain à 09:00 », mais la date enregistrée était `maintenant + 24 h`. La tâche utilise maintenant demain à 09:00 en heure locale.
- **Corrigé — données vendeur fictives présentées comme réelles.** Les noms et coordonnées de fallback ont été remplacés par « à identifier », « non renseigné » ou « coordonnées non renseignées ».
- **Corrigé — vérification TypeScript polluée par Graphify.** Le dossier outil `graphify/` et `.tmp/` sont exclus de la compilation ImmoPilot.
- **Corrigé — préchargement secondaire bloquant.** `AuthProvider` attendait le préchargement Dashboard + marques + biens + scores/signaux avant de libérer le shell, avec un timeout fixe de 2,5 s. Le shell est désormais libéré après profil/agence et le préchargement remplit le cache en arrière-plan. Mesure froide avant : shell 2,54–3,02 s, biens 1,06–1,81 s après navigation. Après : shell 0,88–1,95 s, skeleton immédiat, biens 0,59–1,02 s.
- **Corrigé — préchargement Biens dupliqué.** Auth préchargeait 16 biens alors que la page en demande 20, créant deux clés React Query et relançant biens, scores et signaux. Les tailles sont alignées à 20 ; chaque ressource n'est appelée qu'une fois pendant la mesure finale.
- **Corrigé — erreurs de déplacement Pipeline non gérées localement.** Le déplacement attend maintenant la mutation, conserve le rollback optimiste de `useDeals` et affiche « Impossible de déplacer le deal. Veuillez réessayer. » sans rechargement ni notification dupliquée.
- **Restant — filtres Contacts “Source” et “Propriétaire” non interactifs.** Ils sont visibles mais n’ont pas de comportement. Ils ne bloquent pas la création ou l’association d’un contact.

### P2 — Secondaires

- Le calendrier de l’agenda peut rester positionné sur le mois de la première tâche en retard même après une recherche ciblant une tâche d’un autre mois.
- Les boutons Appeler, Email et WhatsApp de Contacts préparent seulement une action dans l’interface ; ils ne lancent pas d’intégration téléphonie ou messagerie.
- Quelques libellés historiques n’utilisent pas encore tous les accents français, sans impact fonctionnel.

## Corrections réalisées

- Ajout dans la mini-fiche du sélecteur de contact Supabase et du bouton d’association.
- Ajout du champ de prochaine tâche, du bouton de création et d’un retour d’état accessible.
- Ajout d’un accès vers Contacts lorsqu’aucun contact n’existe.
- Correction de l’échéance « demain à 09:00 ».
- Suppression des identités et coordonnées vendeur fictives de fallback.
- Exclusion de `graphify/` et `.tmp/` du périmètre TypeScript ImmoPilot.
- Libération du shell avant le préchargement secondaire et alignement du cache initial Biens sur 20 éléments.
- Gestion locale des erreurs de déplacement Pipeline avec rollback vers l'étape enregistrée.

## Vérifications réalisées

- Connexion avec le compte E2E : réussie.
- Pages Biens, Contacts, Pipeline et Agenda : chargées sans erreur console.
- Recherche Biens avec résultat vide : réussie.
- Tri Biens : options disponibles et sélectionnables.
- Mini-fiche et fiche détaillée : ouverture réussie.
- Contact Supabase `QA Parcours Principal` : créé.
- Contact associé au bien « Immeuble mixte » : réussi.
- Deal `DEAL-0005` créé depuis le bien : réussi.
- Deal déplacé de Nouveau vers Qualifié : réussi.
- Tâches `QA rappel parcours principal` et `QA rappel demain 09h` créées et visibles dans Agenda.
- Aucune erreur JavaScript console observée pendant le parcours.
- Performance finale sur trois sessions froides : skeleton Biens immédiat, premières cartes en 0,59–1,02 s, une requête biens, une requête scores et une requête signaux par session.
- Pipeline : déplacement Qualifié → Contact réussi, retour à Qualifié réussi, puis échec PATCH simulé ; le deal est revenu à Qualifié et le message local attendu s'est affiché.

## Test manuel exact

1. Renseigner les variables d’environnement ci-dessous et lancer `npm run dev`.
2. Ouvrir `http://127.0.0.1:3000/#login` et se connecter.
3. Ouvrir **Biens Particuliers** et vérifier que la liste Supabase apparaît.
4. Rechercher une commune, ouvrir les filtres, changer le tri puis réinitialiser.
5. Cliquer une carte de bien pour ouvrir la mini-fiche, puis cliquer **Détail**.
6. Dans **Contacts**, cliquer **Ajouter un contact**, saisir un nom, choisir un rôle et créer.
7. Revenir dans **Biens**, ouvrir un bien sans deal, choisir le contact dans **Contact à associer**, puis cliquer **Lier le contact sélectionné**.
8. Cliquer **Créer un deal** et vérifier l’ouverture de `#pipeline?deal=...`.
9. Dans le panneau du deal, cliquer une étape suivante, par exemple **Qualifié**, et recharger la page pour confirmer la persistance.
10. Dans la mini-fiche du bien, saisir une prochaine tâche et cliquer **Créer la tâche pour demain**.
11. Ouvrir **Tâches**, sélectionner **Toutes**, rechercher le titre et vérifier le lien vers le bien.

## Environnement et données nécessaires

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `E2E_EMAIL` et `E2E_PASSWORD` pour le test automatisé local
- Un profil Supabase rattaché à une agence
- Au moins un bien synchronisé avec un `property_id` et un `listing_id`
- Les tables existantes `profiles`, `agencies`, `properties`, `listings`, `contacts`, `contact_properties`, `deals`, `pipeline_stages` et `tasks`, avec leurs politiques RLS actuelles

Les données QA créées pendant cet audit sont explicitement préfixées `QA`. Elles peuvent être supprimées après validation manuelle si l’environnement doit être nettoyé.
