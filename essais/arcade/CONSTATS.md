# Essai de génération, plan 4c (2026-11-04)

Un seul essai par mode, écrit par Claude (Sonnet 5.5) en suivant le prompt réel (activité pilote, profil Standard). Un essai ne prouve pas la fiabilité moyenne des générations d'une IA, ni celle du Claude d'un autre enseignant.

Fichiers : `bulles.html`, `briques.html` (ouverts en http local, pas en `file://`).

## Constaté (commande ou geste, résultat)

| Garde-fou | Tir aux bulles | Casse-briques |
|---|---|---|
| 1 un fichier, sans ressource externe | 0 ressource réseau chargée (`performance.getEntriesByType('resource')`) | idem |
| 2 aucun réseau, stockage, cookie, console.log | aucune occurrence dans le script ; `localStorage.length` = 0 | aucune occurrence dans le script |
| 3 Arial, 18 px, 44 px | police `Arial, Helvetica, sans-serif` ; taille minimale 18 ; aucun bouton visible sous 44 px | idem |
| 4 ni chrono, ni vie | aucun `setInterval`, `setTimeout`, `Date.now` ; pas de score | idem (`requestAnimationFrame` seulement pour la balle) |
| 5 retour bienveillant | « Pas tout à fait. Regarde l'indice. » obtenu sur une erreur | idem, bordure ambre et texte (pas la couleur seule) |
| 6 essais illimités, indice, révélation après 3 erreurs | indice : 1 famille écartée ; 3e erreur : « Voici la bonne réponse… On continue. » | indice : 1 brique entourée ; 3 clics sur une mauvaise brique : message avec la bonne famille, brique non cassée |
| 7 mode calme | bouton activé : `animationName` passe de `tir` à `none`, fond blanc | mode balle remplacé par le mode pas à pas |
| 8 clavier seul | Tab, flèche, Entrée réels : la bulle est placée ; **premier jet : le focus tombait sur `BODY` après chaque tir (défaut), corrigé ensuite** | Tab, flèches, Entrée réels en pas à pas : brique cassée ; espace lance la balle ; balle revenue sur la raquette après avoir passé sous elle |
| 10 éléments mot pour mot, tous joués | 6 éléments placés dans leur famille, récapitulatif final | 6 briques cassées, fin affichée |

## Non vérifié

- Lecture à voix haute (bouton « Écouter ») : non essayée ; voix fr-BE non vérifiée.
- `prefers-reduced-motion` : branche de code non exercée dans le navigateur.
- Ouverture par double-clic (`file://`), tablette, lecteur d'écran.
- Casse-briques en mode balle : trajectoire toujours identique à chaque lancer (constat de lecture du code et d'un essai) ; jouabilité pour un élève non testée.
- Copie du prompt : le volet intégré refuse l'écriture du presse-papiers (chemin d'échec constaté) ; dans Chrome, un vrai clic affiche « Prompt copié. » mais le contenu du presse-papiers n'a pas été relu.

## Mise à jour 2026-11-04 : refonte du Tir aux bulles

Sur demande de JF (jeu de tir de bulles d'arcade, charte GameActif), la consigne du mode et un bloc « STYLE VISUEL » ont été réécrits. `bulles.html` a été regénéré par Claude à partir du nouveau prompt : mur de bulles par famille, canon avec visée pointillée, bulle chargée qui porte le mot. Constaté en navigateur : rendu (capture), tir au clavier réel (Entrée) correct puis erroné, retour doux « Pas tout à fait. Regarde l'indice. ». Les garde-fous mesurables (réseau, taille de police, mode calme, indice, révélation après 3 erreurs) n'ont pas été remesurés sur cette version. Un essai ne prouve pas la fiabilité moyenne.
