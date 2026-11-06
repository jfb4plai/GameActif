import { useCallback, useEffect, useState } from 'react';
import { ErreurStockage } from '../compte/activites.js';
import type { ClasseLue, Invite, SuiviStore } from '../suivi/lecture.js';
import { dateFr } from './formats.js';

const MESSAGE_GENERIQUE = 'L’opération n’a pas abouti. Réessayez.';
const messageDe = (e: unknown) => (e instanceof ErreurStockage ? e.message : MESSAGE_GENERIQUE);

/** Inviter une personne à lire la classe (collègue, accompagnant, direction) : un code à usage unique, lecture seule. */
export function InvitationClasse({ classe, store }: { classe: ClasseLue; store: SuiviStore }) {
  const [code, setCode] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    try {
      setInvites(await store.invites(classe.id));
    } catch {
      // La liste reste telle quelle ; l'enseignant peut réessayer avec « Actualiser ».
    }
  }, [store, classe.id]);

  useEffect(() => {
    setCode(null);
    void charger();
  }, [charger]);

  async function inviter() {
    setErreur('');
    try {
      setCode(await store.inviter(classe.id));
    } catch (e) {
      setErreur(messageDe(e));
    }
  }

  async function revoquer(id: string) {
    setErreur('');
    try {
      await store.revoquer(id);
      await charger();
    } catch (e) {
      setErreur(messageDe(e));
    }
  }

  return (
    <div className="invitation-classe">
      <h3>Personnes invitées</h3>
      <p className="aide">Une personne invitée lit le tableau de bord de cette classe, sans pouvoir rien modifier. Elle ne voit que les codes, jamais les prénoms, et seulement les observations que vous avez cochées « visibles ».</p>
      <button type="button" onClick={inviter}>Inviter une personne</button>
      {code !== null && (
        <div role="status">
          <p>{`Code d’invitation : ${code}`}</p>
          <p className="aide">Notez ce code : il ne sera plus affiché. Il est valable 30 jours (ou jusqu’à la suppression de la classe) et une seule personne peut l’utiliser.</p>
        </div>
      )}
      {erreur !== '' && <p role="alert" className="raisons">{erreur}</p>}
      <ul aria-label="Personnes invitées">
        {invites.map((g) => (
          <li key={g.id}>
            {g.revoqueLe !== null ? `Accès révoqué le ${dateFr(g.revoqueLe)}` : `Accès jusqu’au ${dateFr(g.expireLe)}`}
            {g.revoqueLe === null && <button type="button" onClick={() => void revoquer(g.id)}>Révoquer</button>}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => void charger()}>Actualiser la liste des invités</button>
    </div>
  );
}
