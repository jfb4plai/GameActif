// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActivityScreen } from '../../src/ui/ActivityScreen';
import { CalmProvider } from '../../src/ui/CalmContext';
import { PHYSICAL_TEMPLATES } from '../../src/physical/templates.js';
import { eauActivity, toutesActivity } from '../fixtures.js';

afterEach(() => cleanup());

function mount() {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  render(<CalmProvider><ActivityScreen activity={toutesActivity()} /></CalmProvider>);
}

describe('ActivityScreen, nouveaux gabarits', () => {
  it('liste les sept jeux sur écran ; pour une activité de 2e primaire, Associer passe en tête', () => {
    mount();
    const titres = screen.getAllByRole('heading', { name: /^Jeu sur écran/ }).map((h) => h.textContent);
    expect(titres).toEqual([
      'Jeu sur écran : Associer',
      'Jeu sur écran : Trier',
      'Jeu sur écran : Mémo',
      'Jeu sur écran : Remettre en ordre',
      'Jeu sur écran : Comparer',
      'Jeu sur écran : QCM libre',
      'Jeu sur écran : Placer dans une scène',
    ]);
  });

  it('chaque nouveau jeu a son jeu physique en regard', () => {
    mount();
    for (const id of ['comparer', 'memo', 'qcm'] as const) {
      expect(screen.getByRole('heading', { name: `En classe, sans écran : ${PHYSICAL_TEMPLATES[id].title}` })).toBeTruthy();
    }
  });

  it('« Jouer : Mémo » ouvre une grille de cartes face cachée', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Jouer : Mémo' }));
    const plateau = screen.getByRole('region', { name: 'Plateau de jeu' });
    expect(within(plateau).getAllByRole('button', { name: /^Carte \d+, face cachée$/ }).length).toBeGreaterThanOrEqual(4);
  });

  it('« Jouer : Comparer » ouvre une comparaison à compléter par un symbole', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Jouer : Comparer' }));
    expect(screen.getByRole('group', { name: 'Symboles' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'plus grand que' })).toBeTruthy();
  });

  it('« Jouer : QCM libre » ouvre une question et ses réponses', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Jouer : QCM libre' }));
    expect(screen.getByRole('group', { name: 'Réponses' })).toBeTruthy();
  });
});

describe('ActivityScreen, activité sans jeu intégré (Review Focus 3)', () => {
  const sansJeu = () => ({ ...eauActivity(), pairs: [], memberships: [], ranks: [] });
  const cadre = () => screen.getByText('Autres jeux, avec votre IA').closest('details') as HTMLDetailsElement;

  it('explique qu’aucun jeu intégré n’existe et ouvre le cadre Autres jeux, sans planter', () => {
    window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    render(<CalmProvider><ActivityScreen activity={sansJeu()} /></CalmProvider>);
    expect(screen.queryAllByRole('heading', { name: /^Jeu sur écran/ })).toHaveLength(0);
    expect(screen.getByText('Aucun jeu intégré : remplissez des éléments pour en avoir, ou utilisez les jeux avec votre IA ci-dessous.')).toBeTruthy();
    expect(cadre().open).toBe(true);
  });

  it('avec des jeux intégrés, le cadre reste replié et le message est absent', () => {
    mount();
    expect(screen.queryByText(/Aucun jeu intégré/)).toBeNull();
    expect(cadre().open).toBe(false);
  });
});
