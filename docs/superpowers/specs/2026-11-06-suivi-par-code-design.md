# GameActif : suivi des élèves par code pseudonyme (conception)

Date : 2026-11-06. Statut : brouillon à valider par JF. Rien n'est construit.
Origine : comparaison avec pinpon.uno (2026-11-06), décision D1 du plan 7 (JF : « suivi par code »), puis entretien de conception du 2026-11-06.
Convention : **[JF]** = dit par JF. **[Claude]** = choix de Claude, à confirmer ou refuser. Statuts : constaté, déduit, non vérifié.

## 1. Intention

Un enseignant qui a fait jouer une activité à sa classe doit savoir, le lendemain, ce qu'il doit faire : qui n'a pas joué, quelles erreurs reviennent, ce que les élèves ont déjà réussi dans d'autres jeux du même attendu, et où l'acquisition semble en place ou non. Sans ce retour, GameActif est un fabricant de jeux : l'enseignant joue sans rien apprendre de ses élèves, et la remédiation singulière est impossible. [JF] : « sinon difficile de créer de la remédiation singulière ».

## 2. Ce que l'enseignant doit voir [JF]

1. Quelle partie de la classe a participé.
2. La fréquence et le type des erreurs, pour une remédiation éventuelle.
3. Le lien avec les autres jeux déjà joués sur le même attendu.
4. Une indication d'acquisition des compétences visées.
5. Toute autre information utile à sa pédagogie et à la réussite des élèves.

Présentation en trois couches, dans cet ordre [JF] : **A** quatre états (stabilisé, en cours, à reprendre, pas d'indice), puis **C** évolution dans le temps, puis **B** faits par code sans étiquette. Maquette de référence : `.superpowers/brainstorm/300-1793964369/content/tableau-de-bord-v1.html` (non versionnée ; données inventées).

## 3. Objectifs, hors-objectifs, anti-objectifs

**Objectifs**
- Les cinq informations du §2, par classe, pour une activité et pour un attendu.
- Le même contenu quel que soit l'appareil [JF] : TBI (chacun son tour), atelier avec un appareil partagé, tablettes quand l'école en a assez, à distance seulement si tous les élèves peuvent y accéder.

**Hors-objectifs (cette spec)**
- Le français (spec séparée, voir l'étude du plan 7).
- L'export PIA et la comparaison avant/après (v2 déjà notée dans la spec du 2026-10-01).
- Un accès pour les parents ou les élèves.
- Tout compte élève.

**Anti-objectifs : ce qui ferait échouer le projet même si tout fonctionne**
- Le suivi devient une condition pour jouer. Jouer sans code reste toujours possible [JF] et ne laisse aucune trace.
- Un prénom, ou tout identifiant direct, arrive dans la base.
- Une étiquette d'état présentée comme une preuve d'acquisition.
- Mesurer le temps passé ou chronométrer une réponse (principe « sans chrono » de la spec du 2026-10-01, contraire à l'esprit du projet).
- Toute décision automatique sur un élève (règle 80/20 PLAI).
- Un rappel ou un « pas encore joué » adressé à un élève à distance [Claude].

## 4. Décisions

### Prises par JF
- Suivi par code (D1, option b).
- Les prénoms restent chez l'enseignant, sinon la remédiation singulière serait impossible. Correspondance code et prénom : liste locale à son appareil, remplacement du code par le prénom **à l'affichage seulement**, fichier d'export contre la perte de la liste (« ok pour les 3 points »).
- Conservation : **une année scolaire, suppression au 30 août**.
- Observations libres de l'enseignant (ses 20 %) : conservées avec les résultats ; l'enseignant est **informé sur la zone d'édition** de ne pas y écrire de prénom.
- Accès : l'enseignant peut inviter **une personne par code**.
- Même information pour chaque élève quel que soit l'appareil, y compris au TBI.
- Mode asynchrone : seulement si tous les élèves y ont accès, sinon le mode reste libre.

### Choix de Claude, à confirmer ou refuser
1. Sur un appareil partagé, l'élève choisit son code dans une liste avant son tour, il ne le tape pas.
2. L'enseignant saisit à la main un résultat vu sur le jeu physique ou à l'oral ; la ligne porte l'étiquette « saisi par l'enseignant ».
3. Garde-fou léger à l'enregistrement d'une observation : le navigateur compare le texte à la liste locale de prénoms et demande de remplacer par le code. Aucune donnée de la liste n'est envoyée. Limite : un prénom absent de la liste n'est pas détecté.
4. La classe est identifiée sur un appareil par un code de classe saisi une fois (stocké sur l'appareil), qui ouvre la liste des codes élèves. Alternative laissée au builder si le moteur de comptes la rend plus simple.
5. L'invité est en **lecture seule**, révocable par l'enseignant, expire au plus tard le 30 août, et voit les codes mais jamais les prénoms (ils sont sur l'appareil de l'enseignant). Il voit les observations libres : à confirmer par JF (risque : un prénom saisi malgré l'information).
6. États de la couche A : seuils réglables par l'enseignant, valeurs de départ = propositions de Claude (stabilisé : réussi dans 3 jeux différents sur au moins 2 jours ; à reprendre : même type d'erreur dans 2 jeux différents). Le tableau les étiquette « heuristiques non validées scientifiquement », comme `DEFAULT_THRESHOLDS` dans `src/engine/signals.ts`.
7. La couche C (évolution) n'apparaît qu'à partir de 3 séances d'un élève ou de la classe.
8. Le bandeau « Indice, pas une preuve » reste sur la couche A.

## 5. Contraintes

- Pseudonyme, pas anonyme : tant que l'enseignant peut relier un code à un enfant, ce sont des données personnelles. **Avis du DPO obligatoire avant d'appliquer toute migration.** Mettre à jour la page Confidentialité du plan 7 (tâche 1) avant l'ouverture : elle doit dire la vérité sur ce qui est enregistré.
- Base Supabase partagée (`dfoaumjleqtxjeaplnna`) : toutes les tables préfixées `game_` ; vérifier les conflits avec `grep -rIn "create table" --include=*.sql --exclude-dir=node_modules .` depuis la racine du workspace ; `GRANT` explicites dans la même migration que le `create table` ; RLS sur chaque table.
- Jamais d'`EXISTS` auto-joint sur la même table dans une politique RLS : fonction `security definer` (incident AmenagActif 2026-09-23).
- Essai de la migration en transaction annulée sur la base partagée (méthode du plan 4b : `supabase/essai-rollback-game_acces.sql`), puis application seulement avec l'accord explicite de JF.
- L'élève n'a aucun accès en lecture : un élève, ou quiconque connaît le code de classe, ne peut qu'**écrire** des résultats par une fonction serveur contrôlée (forme vérifiée, taille limitée, limite de débit). Risque connu : quelqu'un qui connaît le code de classe peut écrire des résultats sous un code qui n'est pas le sien ; le tableau de bord n'est donc pas une preuve. Le dire dans l'interface.
- Aucune clé ni secret dans le frontend ; aucun `console.log` de données élèves.
- Police et interface : seuils d'accessibilité du plan 7 (tâche 2) applicables aux nouveaux écrans ; zone d'observation avec label, placeholder concret et aide, selon la règle PLAI de guidage des champs.
- Consignes élèves à l'infinitif, une action par puce ; exemples FWB ; aucun tiret cadratin dans le dépôt.

## 6. Existant sur lequel s'appuyer (constaté dans le code)

- `src/engine/round.ts` : `ElementResult` garde `firstTry`, `tries`, `hintUsed`, `revealed`, `wrongChoices` (le mauvais choix précis).
- `src/engine/signals.ts` : `SessionResults` (avec `studentCode`, `endedAt`), `sessionSignals`, `suggestLevel`, `elementStats` (taux d'échec, confusions avec `confusionMin`), `DEFAULT_THRESHOLDS`.
- Plan 4b : tables `game_invitations`, `game_teachers`, `game_activities`, migration `20261103_game_acces.sql` **non appliquée** (état du 2026-11-04 ; à revérifier avant tout travail).
- Le type d'erreur « devant pris pour derrière » est donc calculable avec `wrongChoices` et `elementStats`. Les « réponses au hasard » (rafales rapides) ne le sont pas : aucun temps n'est enregistré, et il ne doit pas l'être.

À lire avant de concevoir le transport : le pont HubActif (`memory/lexiactif-branchement-hub.md`), décision de JF du 2026-11-03 « suivi des élèves par code via HubActif plus tard ». Non lu à ce jour ; le builder décide, avec justification, entre HubActif et une écriture directe dans les tables `game_`.

## 7. Ce qui est laissé au builder

- Schéma exact des tables de résultats et de classes, noms des fonctions serveur, forme du code de classe.
- Transport des résultats (HubActif ou direct) ; mécanisme de suppression planifiée au 30 août (la disponibilité d'un planificateur côté base est **non vérifiée**).
- Mise en page exacte des trois couches ; la maquette montre l'intention, pas le gabarit.
- Calcul des états de la couche A à partir de `elementStats` et `sessionSignals`.
- Format de l'export de la liste locale de prénoms (cohérent avec l'export d'activité du plan 4a).

## 8. Critères de réussite

- Un enseignant avec une classe de 24 codes voit, après une séance, les cinq informations du §2 sans aide.
- Test automatisé : aucune colonne, aucune table, aucun champ de la fonction d'écriture n'accepte un prénom ; un résultat sans code n'est jamais envoyé.
- Test automatisé : sans accès enseignant ou invité, aucune lecture de résultats n'est possible ; l'élève ne peut qu'écrire.
- Test automatisé : suppression au 30 août de tous les résultats et observations d'une année, sans toucher aux comptes ni aux activités.
- Essai avec 2 ou 3 enseignants (protocole du plan 7, tâche 3). Rien n'est annoncé comme « validé » avant cet essai.
- Non vérifié à ce stade : tablette, lecteur d'écran, essai avec élèves, avis DPO.

## 9. Questions ouvertes

- Confirmer ou refuser les huit choix de Claude du §4.
- La personne invitée voit-elle les observations libres (§4, choix 5) ?
- Qui est le DPO consulté, et quand ?
- Registre RGPD à mettre à jour (déjà noté « reste » dans la mémoire AménagActif ; à décider si commun).
