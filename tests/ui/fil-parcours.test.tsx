// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { matieres } from '../../src/data/catalogue.js';
import { Parcours } from '../../src/ui/Parcours';
import { CalmProvider } from '../../src/ui/CalmContext';
import type { Stockage } from '../../src/parcours/stockage.js';

afterEach(() => cleanup());

function memoire(): Stockage {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

function monter() {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  render(<CalmProvider><Parcours stockage={memoire()} /></CalmProvider>);
}

const MATIERE = matieres('P4')[0].label;

async function jusquAuxCompetences() {
  const u = userEvent.setup();
  await u.click(screen.getByRole('button', { name: 'P4' }));
  await u.click(screen.getByRole('button', { name: 'Suivant' }));
  await u.click(screen.getByRole('button', { name: MATIERE }));
  await u.click(screen.getByRole('button', { name: 'Suivant' }));
  return u;
}

describe('fil de la création', () => {
  it('montre les cinq étapes, l\'étape en cours et ce qui est déjà choisi', async () => {
    monter();
    const fil = screen.getByRole('navigation', { name: 'Étapes de la création' });
    expect(within(fil).getAllByRole('listitem')).toHaveLength(5);
    await jusquAuxCompetences();
    const courant = within(fil).getByRole('button', { current: 'step' });
    expect(courant.textContent).toContain('Compétences visées');
    expect(within(fil).getByRole('button', { name: /Niveau/ }).textContent).toContain('4e primaire');
    expect(within(fil).getByRole('button', { name: /Matière/ }).textContent).toContain(MATIERE);
  });

  it('rappelle le niveau et la matière dans l\'étape « Compétences visées »', async () => {
    monter();
    await jusquAuxCompetences();
    expect(screen.getByText(`Niveau : 4e primaire. Matière : ${MATIERE}.`)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Changer le niveau' })).toBeTruthy();
  });

  it('revient à une étape précédente en gardant les choix', async () => {
    monter();
    const u = await jusquAuxCompetences();
    const fil = screen.getByRole('navigation', { name: 'Étapes de la création' });
    await u.click(within(fil).getByRole('button', { name: /Niveau/ }));
    expect(screen.getByText('Étape 1 sur 5 : Niveau')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'P4' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('ne laisse pas sauter vers une étape dont les choix manquent', async () => {
    monter();
    const fil = screen.getByRole('navigation', { name: 'Étapes de la création' });
    expect((within(fil).getByRole('button', { name: /Vos jeux/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(fil).getByRole('button', { name: /Compétences visées/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
