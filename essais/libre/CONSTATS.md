# Essais de génération du mode Libre, plan 6 (2026-11-05)

**Ce qui n'a pas marché ou n'a pas pu être vérifié, d'abord :**

1. **Focus clavier perdu aux trois essais (défaut constaté, corrigé).** Premier jet : après une mauvaise réponse, le bouton cliqué devenait inactif et le focus tombait sur la page (constaté avec de vraies touches : `focus` vide dans les jeux 2 et 3, bouton inactif dans le jeu 1). C'est le même défaut que celui du Tir aux bulles (essais arcade). La règle 8 dit « jouable au clavier seul » sans parler du focus : une phrase a été ajoutée à la consigne du prompt Libre (test `libre.test.ts`, rouge puis vert), les trois prompts ont été régénérés et les trois jeux corrigés ; revérifié avec une vraie touche Entrée sur une mauvaise réponse, le focus reste sur un bouton utilisable.
2. **Règle 6 inapplicable avec trois propositions.** « Après trois erreurs, montrer la bonne réponse » ne peut pas se produire dans les jeux 2 et 3 (trois propositions, donc deux erreurs au plus) ; dans le jeu 1 elle ne se produit qu'au début. Les mauvaises réponses restent grisées : un élève peut gagner par élimination. Non corrigé : c'est une limite du QCM à essais illimités, pas du prompt.
3. **Dessins pas à l'échelle** (jeu 3, le triangle 3, 4, 5 cm est dessiné approximativement) et rien ne le dit à l'élève. Défaut de contenu que seule la relecture de l'enseignant rattrape.
4. **Contexte partiellement utilisé** : le jeu 3 n'utilise pas « le tour de la cour de récréation » ; le jeu 1 et le jeu 2 reprennent les consignes courtes demandées, mais aucune adaptation visible pour la dyslexie au-delà des phrases courtes.
5. **Biais de l'essai** : c'est Claude Sonnet 5.5, auteur du prompt, qui a joué le rôle de l'IA de l'enseignant. Un autre modèle, ou le Claude d'un autre enseignant, peut produire autre chose.
6. **Non vérifié** : lecture à voix haute (bouton « Écouter » non essayé, voix fr-BE non vérifiée), `prefers-reduced-motion` (branche de code non exercée), ouverture par double-clic (`file://`), tablette, lecteur d'écran, élèves, mise en page mobile, copie du prompt dans le Claude d'un enseignant.

Un essai par compétence : **un essai, pas une preuve de fiabilité** de la moyenne des générations.

## Les trois essais

Profil Standard. Prompts : `prompt-1.txt` à `prompt-3.txt` (environ 5 900 caractères chacun). Jeux : `jeu-1.html` à `jeu-3.html` (ouverts en http local par le serveur de développement, pas en `file://`). Fiches de contrôle : `fiche-1.md` à `fiche-3.md` (dans une vraie conversation elles sont sous le jeu, jamais dedans).

| Essai | Attendu | Mécanique choisie par l'IA |
|---|---|---|
| 1 | M.P3.3.2.i1.a1 : associer l'opération à son symbole | relier deux colonnes |
| 2 | M.P4.1.2.i1.a1 : identifier des quadrilatères | choisir parmi des réponses (figures dessinées) |
| 3 | M.P5.2.3.i1.a1 : calculer le périmètre d'un polygone | calcul à choix |

Aucun des trois n'est « classer dans des familles », alors que le catalogue contient cette option.

## Constaté (commande ou geste, résultat)

| Contrôle | Jeu 1 | Jeu 2 | Jeu 3 |
|---|---|---|---|
| fichier sans ressource externe (recherche de `src=`, `href=` et `http` dans le fichier) | aucune occurrence | idem | idem |
| absence de `setInterval`, `setTimeout`, `Date.now`, `console.log`, `localStorage`, `sessionStorage`, `fetch(`, `XMLHttpRequest`, `document.cookie` dans le script | aucune | aucune | aucune |
| taille minimale des boutons visibles | 48 px | 48 px | 48 px |
| police et taille minimale du texte | Arial, 20 px | Arial, 20 px | Arial, 20 px |
| jouabilité complète au script | 4 opérations trouvées, retour « Bien vu. », feu d'artifice (9 points) | 6 questions faites, « Terminé » | 6 figures faites, « Terminé » |
| mauvaise réponse | « Pas tout à fait. Regarde l'indice. », option grisée | idem | idem |
| indice | un signe écarté, jamais le bon | une figure écartée | une réponse écartée |
| mode calme | classe activée, `animationName` vaut `none` | non rejoué (même code) | non rejoué (même code) |
| feu d'artifice | 9 points créés ; 0 point restant 1,5 s après | 0 point restant après 1,5 s | non mesuré |
| clavier réel (touches Tab, Entrée) | Tab ×4 puis Entrée choisit « addition » ; Entrée sur un signe faux : focus sur un signe utilisable | Entrée sur une figure fausse : focus sur une figure utilisable | Entrée sur une réponse fausse : focus sur une réponse utilisable |
| contenu juste | corrigé conforme au texte de l'attendu (+, -, x, :) | 6 questions, une seule bonne réponse chacune, aucune figure qui soit aussi un cas particulier d'une autre proposée (carré écarté des questions « rectangle » et « losange ») | calcul recalculé par script : 14, 20, 12, 26, 18, 30, tous égaux à la réponse affichée |
| nom d'élève ou détail du contexte repris | aucun | aucun | aucun |
| fiche de contrôle présente, absente du jeu | présente (fiche-1.md), absente du fichier HTML | idem | idem |

Une erreur de contenu a failli passer, à signaler comme exemple du risque : dans un premier plan du jeu 2, « Quelle figure est un parallélogramme ? » proposait un carré, un rectangle et un losange, qui sont tous des parallélogrammes (une réponse correcte multiple). Les propositions ont été choisies pour exclure ces cas. C'est exactement ce que la fiche de contrôle doit permettre à l'enseignant de rattraper.
