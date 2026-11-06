// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ObservationLibre } from '../../src/ui/ObservationLibre';
import { magasinSuiviMemoire, type SuiviStore } from '../../src/suivi/lecture.js';
import { ErreurStockage } from '../../src/compte/activites.js';
import type { StockageLocal } from '../../src/compte/invitation.js';

afterEach(() => cleanup());

const codes = ['E01', 'E02', 'E04'];

function stockage(roster: Record<string, string> = {}): StockageLocal {
  const d = new Map<string, string>();
  d.set('gameactif.roster.v1.c1', JSON.stringify(roster));
  return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => void d.set(k, v), removeItem: (k) => void d.delete(k) };
}

function monter(roster: Record<string, string> = {}, store: SuiviStore = magasinSuiviMemoire()) {
  const enregistrer = vi.spyOn(store, 'enregistrerObservation');
  render(<ObservationLibre classId="c1" purgeLe="2027-08-30" codes={codes} store={store} stockage={stockage(roster)} />);
  return { enregistrer, store };
}
const champ = () => screen.getByLabelText('Observation sur la classe ou sur un code') as HTMLTextAreaElement;

describe('ObservationLibre', () => {
  it('guide le champ : libellé, exemple concret et aide sur la portée et la suppression', () => {
    monter();
    expect(champ().placeholder).toMatch(/E04 a corrigé seul/);
    expect(screen.getByText(/Écrivez le code, jamais le prénom ni le nom/)).toBeTruthy();
    expect(screen.getByText(/supprimé le .*2027/)).toBeTruthy();
  });

  it('refuse un texte qui contient un prénom de la liste locale, sans appeler le magasin', async () => {
    const { enregistrer } = monter({ E04: 'Léa' });
    await userEvent.type(champ(), 'Léa a corrigé seule');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer l’observation' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Ce texte contient « Léa ». Remplacez-le par son code.');
    expect(enregistrer).not.toHaveBeenCalled();
  });

  it('enregistre un texte qui n’emploie que le code, non visible par l’invité par défaut', async () => {
    const { enregistrer } = monter({ E04: 'Léa' });
    await userEvent.type(champ(), 'E04 a corrigé seul');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer l’observation' }));
    expect(enregistrer).toHaveBeenCalledTimes(1);
    expect(enregistrer).toHaveBeenCalledWith('c1', { studentCode: null, texte: 'E04 a corrigé seul', visibleInvites: false });
    expect(champ().value).toBe('');
  });

  it('transmet le code choisi et la case « Visible par la personne invitée »', async () => {
    const { enregistrer } = monter();
    fireEvent.change(screen.getByLabelText('Code concerné'), { target: { value: 'E04' } });
    await userEvent.click(screen.getByLabelText('Visible par la personne invitée'));
    await userEvent.type(champ(), 'À revoir demain');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer l’observation' }));
    expect(enregistrer).toHaveBeenCalledWith('c1', { studentCode: 'E04', texte: 'À revoir demain', visibleInvites: true });
  });

  it('n’enregistre pas un texte vide', async () => {
    const { enregistrer } = monter();
    await userEvent.type(champ(), '   ');
    expect((screen.getByRole('button', { name: 'Enregistrer l’observation' }) as HTMLButtonElement).disabled).toBe(true);
    expect(enregistrer).not.toHaveBeenCalled();
  });

  it('un enregistrement qui échoue affiche le message en français et garde le texte', async () => {
    const store = magasinSuiviMemoire();
    store.enregistrerObservation = vi.fn().mockRejectedValue(new ErreurStockage('reseau'));
    monter({}, store);
    await userEvent.type(champ(), 'E01 hésite');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer l’observation' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/n’a pas abouti/);
    expect(champ().value).toBe('E01 hésite');
  });

  it('en lecture seule (personne invitée) : la liste sans formulaire', async () => {
    const store = magasinSuiviMemoire({ observations: { c1: [{ id: 'o1', studentCode: 'E04', texte: 'a progressé', visibleInvites: true, creeLe: '2026-11-10T10:00:00Z' }] } });
    render(<ObservationLibre classId="c1" purgeLe="2027-08-30" codes={[]} store={store} stockage={stockage()} lectureSeule />);
    expect(await screen.findByText(/a progressé/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enregistrer l’observation' })).toBeNull();
    expect(screen.queryByLabelText('Observation sur la classe ou sur un code')).toBeNull();
  });

  it('en lecture seule sans observation partagée : un message, pas de liste', async () => {
    render(<ObservationLibre classId="c1" purgeLe="2027-08-30" codes={[]} store={magasinSuiviMemoire()} stockage={stockage()} lectureSeule />);
    expect(await screen.findByText('Aucune observation partagée avec vous.')).toBeTruthy();
  });

  it('liste les observations déjà enregistrées, avec le prénom à la place du code', async () => {
    const store = magasinSuiviMemoire({ observations: { c1: [{ id: 'o1', studentCode: 'E04', texte: 'a progressé', visibleInvites: false, creeLe: '2026-11-10T10:00:00Z' }] } });
    monter({ E04: 'Léa' }, store);
    const liste = await screen.findByRole('list', { name: 'Observations enregistrées' });
    expect(within(liste).getByText(/a progressé/)).toBeTruthy();
    expect(within(liste).getByText(/Léa/)).toBeTruthy();
  });
});
