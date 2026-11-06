# Accessibilité : constats du 2026-11-06

Statuts : constaté (commande et sortie citées), non vérifié (à mesurer à la main : `docs/accessibilite/protocole-manuel.md`).

## Ce qui a été mesuré

Outil : `axe-core` 4.14.0 (licence MPL-2.0, dépendance de développement seulement, jamais livrée) exécuté sous jsdom par `tests/ui/accessibilite.test.tsx` (`npx vitest run tests/ui/accessibilite.test.tsx`). Règle de contraste désactivée : jsdom n'a pas de mise en page. Seules les violations d'impact « critical » et « serious » sont retenues.

| Surface | Résultat avant correction | Résultat après correction |
|---|---|---|
| Application (parcours) | 0 violation grave | 0 |
| Pages Confidentialité et Mentions | 0 violation grave | 0 |
| Plateaux Trier, Associer, Remettre en ordre, Comparer, Mémo, QCM | 0 violation grave | 0 |
| Plateau « Placer dans une scène » | 1 violation grave : `nested-interactive` (le chat, `role="button"` focusable, était dans un `<svg role="img">` dont les enfants sont présentés comme décoratifs : un lecteur d'écran pouvait ne pas l'annoncer) | 0 : l'`<svg>` a maintenant `role="group"` (`src/ui/SceneBoard.tsx`) |

Écrans du suivi et du partage, mesurés par le même test (0 violation grave chacun) : `TableauDeBord` (états, évolution, faits), `MesClasses` (création, prénoms, observations, invitation, niveaux par code) et `PublierActivite` avec un QR affiché.

Autres constats :
- Aucun lien d'évitement n'existait (constaté sur la page en ligne le 2026-11-06). Ajouté : `Aller au contenu` mène à `<main id="contenu" tabIndex={-1}>` et n'utilise pas l'ancre native, car `#contenu` ferait changer la vue (`src/ui/vue.ts`).
- Une réponse dans « Comparer » est annoncée dans une région `role="status"` non vide (test `annonces`).

## Ce qui n'a pas été mesuré

- **Contraste des couleurs** : non vérifié.
- **Ordre réel du focus** et visibilité du focus au clavier : non vérifié.
- **Lecteur d'écran réel** (NVDA, VoiceOver, TalkBack) : non vérifié.
- **Tablette tactile** : glisser-déposer des plateaux Trier et Placer, taille des cibles tactiles : non vérifié.
- **Voix française de Belgique** (lecture à voix haute) : non vérifié.
- **Zoom à 200 %** et affichage sur écran de 375 px pour les nouveaux écrans (tableau de bord, classes, vue élève, QR) : non vérifié.
- **Mode calme** : son effet visuel n'est pas mesuré ici.
- **Vue élève** (`VueEleve`) : non passée par `axe` seule (elle réutilise `ActivityScreen` et les plateaux, mesurés).

Aucune déclaration d'accessibilité ne doit être publiée tant que le protocole manuel n'est pas rempli.
