// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BarreFichier } from '../../src/ui/BarreFichier';
import { brouillonVide } from '../../src/atelier/brouillon.js';
import { exporterActivite, lireActivite } from '../../src/atelier/fichier.js';
import type { Brouillon } from '../../src/atelier/types.js';

afterEach(() => cleanup());

const MAINTENANT = new Date(2026, 10, 3, 12, 0, 0);

const complet = (over: Partial<Brouillon> = {}): Brouillon => ({
  ...brouillonVide(),
  niveau: 'P4',
  matiere: 'mathematiques',
  cibles: ['M.P4.1.1.i1.a1'],
  titre: 'Les positions',
  contexte: '18 élèves.',
  paires: 'devant | derrière\nà droite | à gauche',
  ...over,
});

const fichier = (contenu: string) => new File([contenu], 'activite.json', { type: 'application/json' });
const champ = () => screen.getByLabelText('Ouvrir une activité (fichier)') as HTMLInputElement;
const statut = () => screen.getByRole('status').textContent as string;

function monter(over: Partial<Parameters<typeof BarreFichier>[0]> = {}) {
  const onCharger = vi.fn();
  const telecharger = vi.fn();
  render(<BarreFichier brouillon={complet()} enCours={false} onCharger={onCharger} telecharger={telecharger} maintenant={() => MAINTENANT} {...over} />);
  return { onCharger, telecharger };
}

describe('BarreFichier, télécharger', () => {
  it('télécharge un fichier relisible, nommé d’après le titre et la date', async () => {
    const { telecharger } = monter();
    await userEvent.click(screen.getByRole('button', { name: 'Télécharger mon activité' }));
    expect(telecharger).toHaveBeenCalledTimes(1);
    const [nom, contenu] = telecharger.mock.calls[0];
    expect(nom).toBe('gameactif-les-positions-2026-11-03.json');
    const lu = lireActivite(contenu);
    expect(lu.ok && lu.brouillon.titre).toBe('Les positions');
  });

  it('prévient que le contexte de classe est dans le fichier', () => {
    monter();
    expect(screen.getByText('Le fichier contient votre contexte de classe. Relisez-le avant de l’envoyer et n’y mettez aucun nom d’élève.')).toBeTruthy();
  });

  it('le bouton est désactivé tant qu’aucun niveau et aucune matière ne sont choisis', () => {
    monter({ brouillon: brouillonVide() });
    expect((screen.getByRole('button', { name: 'Télécharger mon activité' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('BarreFichier, ouvrir', () => {
  it('le champ de fichier a un label et un texte d’aide relié', () => {
    monter();
    const aide = document.getElementById(champ().getAttribute('aria-describedby') as string) as HTMLElement;
    expect(aide.textContent).toContain('lu dans votre navigateur');
    expect(champ().accept).toContain('.json');
  });

  it('un fichier valide est chargé et annoncé', async () => {
    const { onCharger } = monter();
    await userEvent.upload(champ(), fichier(exporterActivite(complet({ titre: 'Venue d’un collègue' }), MAINTENANT).contenu));
    await waitFor(() => expect(onCharger).toHaveBeenCalledTimes(1));
    expect(onCharger.mock.calls[0][0].titre).toBe('Venue d’un collègue');
    expect(statut()).toContain('Activité ouverte : Venue d’un collègue.');
  });

  it('un fichier invalide affiche le message et ne charge rien (Review Focus 1)', async () => {
    const { onCharger } = monter();
    await userEvent.upload(champ(), fichier('ceci n’est pas du json'));
    await waitFor(() => expect(statut()).toContain('Ce fichier n’est pas une activité GameActif : il n’est pas lisible.'));
    expect(onCharger).not.toHaveBeenCalled();
  });

  it('affiche les avertissements de lecture', async () => {
    const { onCharger } = monter();
    const b = complet({ cibles: ['M.P4.1.1.i1.a1', 'M.P4.9.9.i9.a9'] });
    await userEvent.upload(champ(), fichier(exporterActivite(b, MAINTENANT).contenu));
    await waitFor(() => expect(onCharger).toHaveBeenCalled());
    expect(statut()).toContain('1 compétence(s) du fichier n’existent plus dans le programme chargé et ont été retirées.');
  });
});

describe('BarreFichier, brouillon déjà commencé (Review Focus 5)', () => {
  it('demande confirmation avant de remplacer et ne charge rien avant « Remplacer »', async () => {
    const { onCharger } = monter({ enCours: true });
    await userEvent.upload(champ(), fichier(exporterActivite(complet({ titre: 'Nouvelle' }), MAINTENANT).contenu));
    await waitFor(() => expect(screen.getByText('Remplacer votre activité en cours ?')).toBeTruthy());
    expect(onCharger).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Remplacer' }));
    expect(onCharger).toHaveBeenCalledTimes(1);
    expect(onCharger.mock.calls[0][0].titre).toBe('Nouvelle');
  });

  it('« Annuler » ne change rien', async () => {
    const { onCharger } = monter({ enCours: true });
    await userEvent.upload(champ(), fichier(exporterActivite(complet(), MAINTENANT).contenu));
    await waitFor(() => screen.getByRole('button', { name: 'Annuler' }));
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onCharger).not.toHaveBeenCalled();
    expect(screen.queryByText('Remplacer votre activité en cours ?')).toBeNull();
  });

  it('un fichier invalide ne demande aucune confirmation', async () => {
    monter({ enCours: true });
    await userEvent.upload(champ(), fichier('{"a":1}'));
    await waitFor(() => expect(statut()).toContain('Ce fichier n’est pas une activité GameActif.'));
    expect(screen.queryByText('Remplacer votre activité en cours ?')).toBeNull();
  });
});
