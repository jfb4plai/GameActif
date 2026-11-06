const CONTACT = 'jeanfrancois.beguin@ens.ecl.be';

interface Props {
  page: 'confidentialite' | 'mentions';
  /** Un compte enseignant est possible sur cette installation (base configurée). */
  compteActif: boolean;
  /** Le suivi des élèves est ouvert (classes, résultats, activités partagées). */
  suiviActif: boolean;
}

function Confidentialite({ compteActif, suiviActif }: Omit<Props, 'page'>) {
  return (
    <>
      <h2>Confidentialité</h2>

      <h3>Ce qui reste sur votre appareil</h3>
      <p>
        Ce que vous saisissez dans le parcours (niveau, matière, éléments, contexte de classe) est gardé dans le stockage local de votre navigateur. Rien n’est envoyé tant que vous n’enregistrez rien en ligne.
      </p>
      <p>
        Le fichier d’activité que vous téléchargez contient votre contexte de classe : relisez-le avant de l’envoyer et n’y mettez aucun nom d’élève.
      </p>

      <h3>Intelligence artificielle</h3>
      <p>
        L’application n’appelle aucun service d’intelligence artificielle. Les fiches « Autres jeux, avec votre IA » sont des textes que vous copiez vous-même vers l’outil d’IA de votre choix, qui relève de ses propres conditions.
      </p>

      <h3>Hébergement</h3>
      <p>L’application est servie par Vercel (localisation : à confirmer).</p>

      {compteActif && (
        <>
          <h3>Compte enseignant</h3>
          <p>
            Si vous créez un compte, votre adresse e-mail et vos activités enregistrées sont conservées dans la base partagée PLAI (Supabase), hébergée par un sous-traitant dont la localisation est à confirmer. Vous pouvez supprimer une activité enregistrée depuis « Mes activités ».
          </p>
        </>
      )}

      <h3>Les élèves</h3>
      {!suiviActif ? (
        <p>Le suivi des élèves n’est pas ouvert : aucune donnée d’élève n’est enregistrée.</p>
      ) : (
        <>
          <p>
            Les élèves n’ont pas de compte. Un élève joue sous un code (E01, E02…) choisi dans une liste ; le résultat de son tour (réponses justes et erreurs, indices utilisés, dates) est enregistré sous ce code, jamais sous un prénom. Aucun temps de réponse n’est mesuré.
          </p>
          <p>
            Ces codes sont des pseudonymes : l’enseignant peut relier un code à un enfant. Les prénoms ne quittent jamais l’appareil de l’enseignant.
          </p>
          <p>
            L’enseignant peut ajouter des observations libres et des résultats vus hors écran, sous le même code. Il peut inviter une personne, qui lit les résultats en lecture seule sans voir de prénom.
          </p>
          <p>
            L’enseignant peut proposer une activité à sa classe par un lien ou un QR code : l’activité partagée (consignes, éléments, attendus) est enregistrée, son contexte de classe ne l’est pas. Il peut aussi fixer un niveau de jeu par code, et un élève peut choisir de rejouer un niveau au-dessus : l’indicateur est enregistré avec la séance.
          </p>
          <p>
            Durée : tout ce qui concerne une classe est supprimé le 30 août suivant sa création (le 30 août de l’année suivante pour une classe créée en août), ou plus tôt si l’enseignant la supprime.
          </p>
          <p>
            Le tableau de bord est un indice, pas une preuve : quiconque connaît le code d’une classe peut enregistrer un résultat sous un code élève de cette classe.
          </p>
        </>
      )}

      <h3>Vos droits</h3>
      <p>Pour accéder à des données, les faire corriger ou supprimer : écrivez à {CONTACT}.</p>
    </>
  );
}

function Mentions() {
  return (
    <>
      <h2>Mentions légales</h2>
      <p>
        Éditeur : Jean-François Beguin, Pôle Territorial de la Ville de Liège (PLAI, Pôle Liégeois d’Accompagnement vers une École Inclusive), enseignement de la Fédération Wallonie-Bruxelles.
      </p>
      <p>Contact : {CONTACT}.</p>
      <p>
        Les attendus proposés viennent des référentiels de la Fédération Wallonie-Bruxelles. Les activités et textes saisis par les enseignants restent sous leur responsabilité.
      </p>
      <p>Licence du code : à préciser (ce dépôt n’a pas encore de fichier de licence).</p>
    </>
  );
}

/** Pages « Confidentialité » et « Mentions légales ». Le texte dépend de ce qui est réellement actif sur cette installation. */
export function PageLegale({ page, compteActif, suiviActif }: Props) {
  return <div className="page-legale">{page === 'confidentialite' ? <Confidentialite compteActif={compteActif} suiviActif={suiviActif} /> : <Mentions />}</div>;
}
