# GameActif : activité partagée par lien et QR, profils au choix de l'enseignant (conception)

Date : 2026-11-06. Statut : brouillon à valider par JF. Rien n'est construit.
Origine : constat du plan 8 (aucun lien d'activité pour les élèves), puis entretien de conception du 2026-11-06.
Convention : **[JF]** = dit par JF. **[Claude]** = choix de Claude, à confirmer ou refuser. Statuts : constaté (code cité), non vérifié.
Dépend de : `docs/superpowers/specs/2026-11-06-suivi-par-code-design.md` (classes, codes élèves, `game_record_session`) et du plan 8, non appliqués en base à ce jour.

## 1. Intention

Aujourd'hui l'activité n'existe que dans le navigateur de l'enseignant (brouillon) ou dans un fichier exporté (`src/ui/BarreFichier.tsx`). Une tablette d'élève ne peut jouer que si l'enseignant y importe le fichier à la main : le scénario « une tablette par élève » est irréaliste, et le suivi par code n'a pas de terrain. L'enseignant doit pouvoir, en un geste, mettre l'activité à disposition de sa classe : QR affiché au TBI, lien copié ou envoyé. L'élève ouvre, choisit son code, joue.

## 2. Objectifs, hors-objectifs, anti-objectifs

**Objectifs**
- Publier une activité pour une classe : un code court, un lien, un QR [JF].
- Ouvrir ce lien sur n'importe quel appareil, sans compte ni installation, et jouer les jeux sur écran [JF].
- Quatre façons de décider du niveau de jeu (§4) [JF].
- Le dépassement : l'élève peut rejouer un niveau au-dessus du sien [JF], et l'enseignant le voit dans le tableau de bord [JF].

**Hors-objectifs**
- Un compte élève, un mot de passe, une liste d'élèves avec prénoms.
- Des activités publiques ou une bibliothèque partagée entre enseignants (le partage entre collègues reste le fichier, plan 4a).
- Les jeux « avec votre IA » (fichiers HTML générés par l'enseignant) : ils ne passent pas par ce partage.
- Une application native, un mode hors ligne complet.

**Anti-objectifs : ce qui ferait échouer le projet même si tout fonctionne**
- Le contexte de classe de l'enseignant (texte libre, risque de données sur des élèves) part dans la base ou s'affiche chez l'élève.
- Un élève voit le nom de son profil assigné (« Soutien »).
- Un tour joué au niveau au-dessus met l'élève « À reprendre » dans le tableau de bord.
- Le niveau devient une décision automatique : le profil reste toujours choisi par l'enseignant (règle 80/20).
- Un lien qui reste actif après la suppression de la classe.

## 3. Décisions

### Prises par JF
- Option A : lien court par code, activité enregistrée dans la base.
- Modes de niveau 1, 2 et 3 dès la première version (§4), plus le dépassement libre d'un niveau.
- L'enseignant voit les tours joués au niveau au-dessus.

### Choix de Claude, à confirmer ou refuser
1. L'activité partagée appartient à une classe : supprimée avec elle, à la date de suppression de la classe (30 août, voir plan 8).
2. Le contexte de classe n'est pas stocké : à la publication il est remplacé par un texte fixe non identifiant. Le titre, les attendus, le niveau, la matière, les familles, paires, étapes, comparaisons et questions sont conservés. Constaté : `construireActivite` refuse un contexte vide (`src/atelier/brouillon.ts:220` et `:301-303`), d'où le texte fixe plutôt qu'un champ vide ; le builder peut préférer contourner la validation si c'est plus simple.
3. Lecture par n'importe qui connaît le code (8 caractères, même alphabet que le code de classe), sans compte, en lecture seule. Le contenu n'a aucune donnée d'élève.
4. Republier met à jour la même ligne : le code et le lien ne changent pas, les élèves qui rechargent voient la nouvelle version. « Retirer le lien » supprime la ligne ; le lien affiche alors « Cette activité n'est plus proposée. »
5. Au plus 20 activités partagées actives par classe.
6. La tablette garde en mémoire locale la dernière activité chargée : on peut rouvrir le lien sans réseau. Envoyer les résultats reste impossible sans réseau (même limite que le plan 8).
7. Le lien est de la forme `https://gameactif.jfb4plai.com/?activite=CODE`. Le code de classe n'est pas dans le lien : il est rendu par la fonction de lecture avec l'activité, et l'appareil est associé à la classe tout seul.
8. Le QR est généré dans le navigateur de l'enseignant avec la bibliothèque `qrcode-generator` (licence MIT annoncée par `transfertactif/README.md`, version et licence exacte **non vérifiées** ici), jamais par un service externe. Le QR s'affiche en grand, avec le lien en texte et un bouton « Copier le lien ».
9. TransfertActif n'est pas intégré : l'enseignant peut y déposer le lien copié comme n'importe quel texte.

## 4. Les quatre façons de décider du niveau

Profils existants : Soutien, Standard, Défi (`src/engine/profiles.ts`). Ils règlent le nombre d'éléments et les aides, jamais le contenu. À l'écran de l'élève ils sont montrés sous trois noms neutres [Claude] (par exemple « Pas à pas », « Équilibre », « Défi » : à fixer par JF avec l'équipe), jamais « Soutien ».

| Mode | Fonctionnement | Ce qui est stocké |
|---|---|---|
| **1. Même profil pour tous** | L'enseignant choisit un profil en publiant. Un lien, un QR. | Le profil par défaut de l'activité partagée. |
| **2. Un lien par groupe** | Trois liens et trois QR, `?activite=CODE&g=1`, `g=2`, `g=3`, portant chacun une couleur neutre (vert, bleu, orange) et mappés sur les trois profils. L'enseignant distribue le bon QR à chaque groupe. | Rien de plus : le groupe est dans le lien. |
| **3. Profil par code élève** | L'enseignant associe un profil à chaque code E01 à E40 ; défaut Standard. Quand l'élève choisit son code, la tablette reçoit son profil sans le montrer. | Une table code vers profil, par classe, supprimée avec la classe. |
| **Dépassement** | Après un tour, l'élève peut « Rejouer un niveau au-dessus » : Soutien monte à Standard, Standard à Défi, Défi n'a pas le bouton. Jamais de descente. | Un indicateur sur la séance : « joué au-dessus de son profil ». |

L'enseignant choisit le mode à la publication ; il peut le changer en republiant.

**Risque propre au mode 3 (à porter au DPO) :** la tablette doit apprendre le profil du code choisi. Quiconque connaît le code de classe peut essayer d'autres codes et déduire, par le comportement du jeu, le niveau d'un camarade. Le mode 3 est discret, pas secret. Il stocke aussi, sous pseudonyme, un besoin d'accompagnement : il pèse plus lourd que les autres modes dans l'avis du DPO, et il peut être livré après les modes 1 et 2 si l'avis tarde [Claude].

## 5. La vue élève

Ouvrir `?activite=CODE` remplace le parcours par une vue élève [Claude] : le titre de l'activité, « Qui joue ? » (liste des codes, défaut « Jouer sans enregistrer »), les jeux sur écran, le bouton de dépassement après un tour. Elle masque tout l'outillage de l'enseignant : profil, nombre d'élèves, fiches papier, cadre « Autres jeux », « Mon espace », « Mes classes ». Constaté : `ActivityScreen` mélange aujourd'hui ces deux publics (`src/ui/ActivityScreen.tsx`) ; le builder choisit de le scinder ou de lui passer un mode « élève ».

Le mode calme reste actif et choisi par l'élève. Les nouveaux écrans respectent les règles PLAI : 16 px minimum, un label et une aide sur chaque champ.

## 6. Côté enseignant

- Un bouton « Proposer à la classe » dans l'étape « Vos jeux » du parcours et dans « Mes activités », visible pour un enseignant connecté qui a au moins une classe.
- Choix de la classe, du mode (§4), du profil par défaut (mode 1).
- Résultat : QR en grand, lien en texte, « Copier le lien », « Retirer le lien ».
- Mode 3 : une page « Niveaux par code » dans « Mes classes », avec un profil par code, défaut Standard.

## 7. Tableau de bord : le dépassement [JF : visible ; Claude : règles]

- Chaque séance porte l'indicateur « joué au-dessus de son profil ». Le tableau de bord l'affiche (tableau des faits, jeux joués).
- Un tour joué au-dessus peut ajouter à la preuve de réussite d'un élève mais ne compte jamais contre lui : ses erreurs sont exclues du calcul « À reprendre » (confusion répétée), du tableau des erreurs par type et de la courbe d'évolution, car la difficulté n'est pas la même [Claude].
- Le moteur sait déjà proposer « à relever » (`suggestLevel`, `src/engine/signals.ts`) ; l'afficher à côté du mode 3 comme suggestion, jamais appliquée seule, reste hors de cette spec.

## 8. Contraintes

- Tables et fonctions préfixées `game_`, `GRANT` explicites, RLS actif, jamais d'`EXISTS` auto-joint (fonctions `security definer`), essai de la migration en transaction annulée, application seulement avec l'accord de JF et l'avis du DPO.
- `anon` ne lit rien directement : il ne dispose que de fonctions de lecture ciblées (activité par code, profil par code pour le mode 3).
- L'enseignant propriétaire de la classe est seul à publier, republier, retirer, ou à fixer les profils par code.
- Taille maximale du contenu partagé : celle du fichier d'export, 200 000 octets (`game_activities.brouillon`).
- Aucun prénom, aucune clé exposée dans le navigateur, aucune requête vers un service externe pour le QR.
- Les écritures de séances restent celles du plan 8 : un champ `above` s'ajoute à la charge utile et à la table des séances.

## 9. Existant sur lequel s'appuyer (constaté)

- Export et import d'une activité : `src/ui/BarreFichier.tsx`, `src/atelier/` (format v2 du plan 5).
- Lecture d'un code dans l'adresse et nettoyage de l'adresse : `src/compte/invitation.ts` (`lireCodeDansAdresse`), même patron pour `?activite=`.
- Classes, codes élèves, écriture de séances, tableau de bord : plan 8.
- Tables : `game_activities` (activités enregistrées d'un compte), `game_classes`, `game_sessions` (plan 8).

## 10. Ce qui est laissé au builder

- Schéma exact des tables de partage et de profils par code, noms des fonctions, forme du code.
- Découpe de `ActivityScreen` en vue enseignant et vue élève.
- Mise en page du QR et de la page « Niveaux par code ».
- Choix de la bibliothèque de QR (ou d'un module maison) et de sa licence.
- Mise en cache locale de la dernière activité.

## 11. Critères de réussite

- Un enseignant publie une activité en moins de 3 clics à partir de l'étape « Vos jeux » et obtient un QR lisible au TBI. Seuil et vérification : à confirmer par JF et à tester sur de vrais appareils (**non vérifié**).
- Une tablette sans compte ouvre le lien, choisit son code, joue et envoie sa séance.
- Test automatisé : le contexte de classe n'est jamais dans la base ni dans la vue élève.
- Test automatisé : un tour au-dessus du profil n'alimente ni « À reprendre » ni les erreurs par type.
- Test automatisé : un lien retiré ou une classe supprimée n'ouvre plus rien.
- Non vérifié à ce stade : QR sur tablettes réelles, appareils iOS, réseau d'école, avis DPO.

## 12. Questions ouvertes

- Confirmer ou refuser les neuf choix de Claude du §3.
- Les trois noms neutres des niveaux et les trois couleurs du mode 2.
- Le mode 3 doit-il attendre l'avis du DPO (§4) ou être livré avec les autres ?
- Où publier : étape « Vos jeux », « Mes activités », ou les deux ?
