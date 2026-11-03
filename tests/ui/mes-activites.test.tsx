// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MesActivites } from '../../src/ui/MesActivites';
import { ErreurStockage, magasinMemoire, type ActivitesStore } from '../../src/compte/activites';
import { brouillonVide } from '../../src/atelier/brouillon';
import type { Brouillon } from '../../src/atelier/types';

afterEach(() => cleanup());

const brouillon = (over: Partial<Brouillon> = {}): Brouillon => ({
  ...brouillonVide(),
  niveau: 'P4',
  matiere: 'mathematiques',
  cibles: ['M.P4.1.1.i1.a1'],
  titre: 'Les positions',
  contexte: '18 élèves.',
  paires: 'devant | derrière\nà droite | à gauche',
  ...over,
});

function monter(o: { store?: ActivitesStore; brouillon?: Brouillon; enCours?: boolean } = {}) {
  const onOuvrir = vi.fn();
  const store = o.store ?? magasinMemoire();
  const rendu = render(<MesActivites store={store} brouillon={o.brouillon ?? brouillon()} enCours={o.enCours ?? false} onOuvrir={onOuvrir} />);
  return { onOuvrir, store, ...rendu };
}

const liste = () => screen.queryAllByRole('listitem');
const statut = () => screen.getByRole('status').textContent as string;

describe('MesActivites, enregistrer', () => {
  it('une liste vide le dit', async () => {
    monter();
    await waitFor(() => expect(screen.getByText('Vous n’avez pas encore enregistré d’activité.')).toBeTruthy());
  });

  it('enregistrer crée l’activité, l’annonce et l’affiche dans la liste', async () => {
    monter();
    await waitFor(() => screen.getByText('Vous n’avez pas encore enregistré d’activité.'));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer dans mon espace' }));
    await waitFor(() => expect(statut()).toContain('Activité enregistrée : Les positions.'));
    expect(liste()).toHaveLength(1);
    expect(within(liste()[0]).getByText('Les positions')).toBeTruthy();
  });

  it('après un premier enregistrement, « Mettre à jour » ne crée pas de doublon', async () => {
    monter();
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer dans mon espace' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Mettre à jour mon activité' }));
    await waitFor(() => expect(statut()).toContain('Activité mise à jour'));
    expect(liste()).toHaveLength(1);
  });

  it('« Enregistrer comme nouvelle activité » crée une seconde activité', async () => {
    monter();
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer dans mon espace' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer comme nouvelle activité' }));
    await waitFor(() => expect(liste()).toHaveLength(2));
  });

  it('le bouton est désactivé tant qu’aucun niveau et aucune matière ne sont choisis', async () => {
    monter({ brouillon: brouillonVide() });
    expect((await screen.findByRole('button', { name: 'Enregistrer dans mon espace' })) as HTMLButtonElement).toHaveProperty('disabled', true);
  });

  it('revenir à un brouillon vide (« Recommencer ») oublie l’activité suivie : le prochain enregistrement crée', async () => {
    const store = magasinMemoire();
    const { rerender } = monter({ store });
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer dans mon espace' }));
    await screen.findByRole('button', { name: 'Mettre à jour mon activité' });
    const onOuvrir = vi.fn();
    rerender(<MesActivites store={store} brouillon={brouillonVide()} enCours={false} onOuvrir={onOuvrir} />);
    rerender(<MesActivites store={store} brouillon={brouillon({ titre: 'Tout autre sujet' })} enCours={false} onOuvrir={onOuvrir} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer dans mon espace' }));
    await waitFor(() => expect(liste()).toHaveLength(2));
  });
});

describe('MesActivites, ouvrir et supprimer', () => {
  async function avecUneActivite(o: { enCours?: boolean } = {}) {
    const store = magasinMemoire();
    await store.enregistrer(brouillon({ titre: 'Enregistrée avant' }));
    const m = monter({ store, enCours: o.enCours });
    await screen.findByText('Enregistrée avant');
    return m;
  }

  it('ouvrir charge le brouillon sans confirmation quand rien n’est en cours', async () => {
    const { onOuvrir } = await avecUneActivite();
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir : Enregistrée avant' }));
    expect(onOuvrir).toHaveBeenCalledTimes(1);
    expect(onOuvrir.mock.calls[0][0].titre).toBe('Enregistrée avant');
  });

  it('ouvrir demande confirmation quand un brouillon est en cours, et n’ouvre rien avant « Remplacer »', async () => {
    const { onOuvrir } = await avecUneActivite({ enCours: true });
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir : Enregistrée avant' }));
    expect(screen.getByText('Remplacer votre activité en cours ?')).toBeTruthy();
    expect(onOuvrir).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onOuvrir).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir : Enregistrée avant' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remplacer' }));
    expect(onOuvrir).toHaveBeenCalledTimes(1);
  });

  it('supprimer demande confirmation, puis retire l’activité', async () => {
    await avecUneActivite();
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer : Enregistrée avant' }));
    expect(screen.getByText('Supprimer cette activité ? Cette action est définitive.')).toBeTruthy();
    expect(liste()).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(screen.getByText('Vous n’avez pas encore enregistré d’activité.')).toBeTruthy());
  });

  it('annuler la suppression ne supprime rien', async () => {
    await avecUneActivite();
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer : Enregistrée avant' }));
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByText('Supprimer cette activité ? Cette action est définitive.')).toBeNull();
    expect(liste()).toHaveLength(1);
  });
});

describe('MesActivites, pannes (Review Focus 4)', () => {
  const enPanne = (code: 'reseau' | 'acces'): ActivitesStore => ({
    lister: async () => [],
    enregistrer: async () => {
      throw new ErreurStockage(code);
    },
    supprimer: async () => {
      throw new ErreurStockage(code);
    },
  });

  it('erreur réseau à l’enregistrement : message de réessai, rien n’apparaît dans la liste', async () => {
    const { onOuvrir } = monter({ store: enPanne('reseau') });
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer dans mon espace' }));
    await waitFor(() => expect(statut()).toContain('L’enregistrement n’a pas abouti. Votre saisie est conservée : réessayez.'));
    expect(liste()).toHaveLength(0);
    expect(onOuvrir).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Enregistrer dans mon espace' })).toBeTruthy();
  });

  it('erreur d’accès : message de reconnexion', async () => {
    monter({ store: enPanne('acces') });
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer dans mon espace' }));
    await waitFor(() => expect(statut()).toContain('Votre session a expiré. Reconnectez-vous.'));
  });

  it('une liste qui ne se charge pas le dit, sans casser le reste', async () => {
    const store: ActivitesStore = { ...enPanne('reseau'), lister: async () => Promise.reject(new ErreurStockage('reseau')) };
    monter({ store });
    await waitFor(() => expect(screen.getByText('Vos activités n’ont pas pu être chargées. Réessayez dans un instant.')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Enregistrer dans mon espace' })).toBeTruthy();
  });
});
