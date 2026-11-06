// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MesClasses } from '../../src/ui/MesClasses';
import { magasinSuiviMemoire, type ClasseLue, type SuiviStore } from '../../src/suivi/lecture.js';
import type { StockageLocal } from '../../src/compte/invitation.js';

afterEach(() => cleanup());

const classe: ClasseLue = { id: 'c1', label: 'P4 B', nbCodes: 24, classCode: 'ABCD2345', purgeLe: '2027-08-30', proprietaire: true };

function stockage(): StockageLocal & { donnees: Map<string, string> } {
  const donnees = new Map<string, string>();
  return { donnees, getItem: (k) => donnees.get(k) ?? null, setItem: (k, v) => void donnees.set(k, v), removeItem: (k) => void donnees.delete(k) };
}

function monter(init: Parameters<typeof magasinSuiviMemoire>[0] = { classes: [classe] }) {
  const store = magasinSuiviMemoire(init);
  const espions = {
    creerClasse: vi.spyOn(store, 'creerClasse'),
    supprimerClasse: vi.spyOn(store, 'supprimerClasse'),
    saisirManuel: vi.spyOn(store, 'saisirManuel'),
    enregistrerObservation: vi.spyOn(store, 'enregistrerObservation'),
    inviter: vi.spyOn(store, 'inviter'),
    rejoindre: vi.spyOn(store, 'rejoindre'),
    revoquer: vi.spyOn(store, 'revoquer'),
  };
  const s = stockage();
  const telecharger = vi.fn();
  render(<MesClasses store={store as SuiviStore} stockage={s} telecharger={telecharger} />);
  return { store, espions, s, telecharger };
}

describe('MesClasses, création', () => {
  it('guide les champs : exemple de nom sans prénom, nombre de codes et leur portée', async () => {
    monter({});
    const nom = (await screen.findByLabelText('Nom de la classe')) as HTMLInputElement;
    expect(nom.placeholder).toMatch(/P4 B, 2026-2027/);
    expect(screen.getByText(/Pas de prénom/)).toBeTruthy();
    expect(screen.getByText(/Un code par élève/)).toBeTruthy();
  });

  it('crée une classe et affiche le code à donner aux élèves', async () => {
    const { espions } = monter({});
    await userEvent.type(await screen.findByLabelText('Nom de la classe'), 'P4 C, 2026-2027');
    fireEvent.change(screen.getByLabelText('Nombre de codes'), { target: { value: '20' } });
    await userEvent.click(screen.getByRole('button', { name: 'Créer la classe' }));
    expect(espions.creerClasse).toHaveBeenCalledWith('P4 C, 2026-2027', 20);
    expect(await screen.findByText(/Code de la classe : [A-Z2-9]{8}/)).toBeTruthy();
  });

  it('refuse un nombre de codes hors de 1 à 40 sans appeler le magasin', async () => {
    const { espions } = monter({});
    await userEvent.type(await screen.findByLabelText('Nom de la classe'), 'P4 C');
    fireEvent.change(screen.getByLabelText('Nombre de codes'), { target: { value: '41' } });
    expect((screen.getByRole('button', { name: 'Créer la classe' }) as HTMLButtonElement).disabled).toBe(true);
    expect(espions.creerClasse).not.toHaveBeenCalled();
  });
});

describe('MesClasses, classe d’un propriétaire', () => {
  it('rappelle la date de suppression des résultats', async () => {
    monter();
    expect(await screen.findByText(/Les résultats de cette classe sont supprimés le .*2027/)).toBeTruthy();
  });

  it('exporte la liste des prénoms sans la confier au magasin', async () => {
    const { telecharger, espions, s } = monter();
    fireEvent.change(await screen.findByLabelText('Prénom du code E01'), { target: { value: 'Léa' } });
    await userEvent.click(screen.getByRole('button', { name: 'Exporter la liste des prénoms' }));
    expect(telecharger).toHaveBeenCalledTimes(1);
    const [nom, contenu] = telecharger.mock.calls[0];
    expect(nom).toMatch(/\.json$/);
    expect(contenu).toContain('Léa');
    for (const f of Object.values(espions)) expect(f).not.toHaveBeenCalled();
    expect(s.donnees.get('gameactif.roster.v1.c1')).toContain('Léa');
  });

  it('le garde-fou des observations connaît un prénom saisi à l’instant, sans rechargement', async () => {
    const { espions } = monter();
    fireEvent.change(await screen.findByLabelText('Prénom du code E04'), { target: { value: 'Léa' } });
    await userEvent.type(screen.getByLabelText('Observation sur la classe ou sur un code'), 'Léa a corrigé seule');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer l’observation' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Ce texte contient « Léa ». Remplacez-le par son code.');
    expect(espions.enregistrerObservation).not.toHaveBeenCalled();
  });

  it('le tableau de bord affiche à l’instant le prénom saisi', async () => {
    const seance = {
      sessionId: 's1',
      studentCode: 'E04',
      profile: 'standard' as const,
      totalElements: 1,
      endedAt: '2026-11-10T10:00:00.000Z',
      cibles: ['M.P4.1.1.i1.a1'],
      mechanic: 'trier' as const,
      labels: {},
      results: [{ elementId: 'e1', mechanic: 'trier' as const, firstTry: true, tries: 1, hintUsed: false, revealed: false, wrongChoices: [], correct: 'devant' }],
      origine: 'ecran' as const,
      above: false,
    };
    monter({ classes: [classe], sessions: { c1: [seance] } });
    const tableau = await screen.findByRole('table', { name: 'Où en sont les élèves' });
    expect(within(tableau).queryByText(/Léa/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Prénom du code E04'), { target: { value: 'Léa' } });
    expect(within(tableau).getByText(/Léa/)).toBeTruthy();
  });

  it('demande une confirmation avant de supprimer la classe', async () => {
    const { espions } = monter();
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer cette classe' }));
    expect(espions.supprimerClasse).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler la suppression' }));
    expect(espions.supprimerClasse).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer cette classe' }));
    await userEvent.click(screen.getByRole('button', { name: 'Oui, supprimer la classe et ses résultats' }));
    expect(espions.supprimerClasse).toHaveBeenCalledWith('c1');
  });

  it('invite une personne : le code n’est montré qu’une fois, puis l’invité se révoque', async () => {
    const { espions, store } = monter();
    await userEvent.click(await screen.findByRole('button', { name: 'Inviter une personne' }));
    expect(await screen.findByText(/ne sera plus affiché/)).toBeTruthy();
    expect(espions.inviter).toHaveBeenCalledWith('c1');
    // La personne invitée utilise le code (depuis son compte), puis l'enseignant actualise la liste.
    expect(await store.rejoindre(await espions.inviter.mock.results[0].value)).toBe('ok');
    await userEvent.click(screen.getByRole('button', { name: 'Actualiser la liste des invités' }));
    const liste = await screen.findByRole('list', { name: 'Personnes invitées' });
    expect(within(liste).getAllByRole('listitem')).toHaveLength(1);
    await userEvent.click(within(liste).getByRole('button', { name: 'Révoquer' }));
    expect(espions.revoquer).toHaveBeenCalledTimes(1);
  });

  it('enregistre un résultat saisi avec un attendu au bon format', async () => {
    const { espions } = monter();
    fireEvent.change(await screen.findByLabelText('Code de l’élève (résultat saisi)'), { target: { value: 'E04' } });
    await userEvent.type(screen.getByLabelText('Attendu (code)'), 'M.P4.1.1.i1.a1');
    fireEvent.change(screen.getByLabelText('Résultat vu'), { target: { value: 'reussi' } });
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le résultat' }));
    expect(espions.saisirManuel).toHaveBeenCalledWith('c1', { studentCode: 'E04', cible: 'M.P4.1.1.i1.a1', resultat: 'reussi' });
  });

  it('refuse un attendu mal formé sans appeler le magasin', async () => {
    const { espions } = monter();
    fireEvent.change(await screen.findByLabelText('Code de l’élève (résultat saisi)'), { target: { value: 'E04' } });
    await userEvent.type(screen.getByLabelText('Attendu (code)'), 'Léa');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le résultat' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/format d’un attendu/);
    expect(espions.saisirManuel).not.toHaveBeenCalled();
  });
});

describe('MesClasses, code d’invitation', () => {
  it('un code invalide affiche le message de refus', async () => {
    const { espions } = monter({});
    await userEvent.type(await screen.findByLabelText('Code d’invitation'), 'X'.repeat(32));
    await userEvent.click(screen.getByRole('button', { name: 'Rejoindre la classe' }));
    expect(espions.rejoindre).toHaveBeenCalledWith('X'.repeat(32));
    expect((await screen.findByRole('alert')).textContent).toBe('Ce code d’invitation n’est plus valable. Demandez-en un nouveau.');
  });
});

describe('MesClasses, personne invitée', () => {
  it('lit la classe sans pouvoir la modifier', async () => {
    monter({ classes: [{ ...classe, proprietaire: false }] });
    expect(await screen.findByText(/personne invitée/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Supprimer cette classe' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Inviter une personne' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Enregistrer l’observation' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Enregistrer le résultat' })).toBeNull();
    expect(screen.queryByText(/Code de la classe :/)).toBeNull();
  });
});
