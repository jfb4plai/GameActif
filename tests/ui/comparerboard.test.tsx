// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComparerBoard } from '../../src/ui/ComparerBoard';
import { CalmProvider } from '../../src/ui/CalmContext';
import { setupRound } from '../../src/engine/setup.js';
import { SYMBOLES, splitComparaison } from '../../src/engine/comparer.js';
import { makeRng } from '../../src/engine/rng.js';
import type { ElementResult, RoundState } from '../../src/engine/round.js';
import { comparerActivity } from '../fixtures.js';

afterEach(() => cleanup());

function mount(round: RoundState, onDone: (r: ElementResult[]) => void = () => {}) {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  return render(<CalmProvider><ComparerBoard round={round} onDone={onDone} /></CalmProvider>);
}
const tour = () => setupRound(comparerActivity(), 'comparer', 'standard', makeRng(1));
const nom = (id: string) => (SYMBOLES.find((s) => s.id === id) as (typeof SYMBOLES)[number]).nom;
const bouton = (id: string) => screen.getByRole('button', { name: nom(id) });
const groupe = (r: RoundState, elementId: string) => {
  const [g, d] = splitComparaison(r.labels[elementId]);
  return screen.queryByRole('group', { name: `Compare ${g} et ${d}` });
};
const status = () => screen.getByRole('status').textContent;

describe('ComparerBoard', () => {
  it('affiche la première comparaison et la progression', () => {
    const r = tour();
    mount(r);
    expect(screen.getByText(`0 sur ${r.elements.length}`)).toBeTruthy();
    expect(groupe(r, r.elements[0].id)).toBeTruthy();
  });

  it('les trois symboles ont un nom accessible et un signe visible', () => {
    mount(tour());
    expect(bouton('>').textContent).toBe('>');
    expect(bouton('<').textContent).toBe('<');
    expect(bouton('=').textContent).toBe('=');
  });

  it('une bonne réponse affiche « Bien vu. » et passe à la comparaison suivante', async () => {
    const r = tour();
    mount(r);
    await userEvent.click(bouton(r.elements[0].correct));
    expect(status()).toBe('Bien vu.');
    expect(screen.getByText(`1 sur ${r.elements.length}`)).toBeTruthy();
    expect(groupe(r, r.elements[1].id)).toBeTruthy();
  });

  it('une mauvaise réponse invite à réessayer et garde la même comparaison', async () => {
    const r = tour();
    mount(r);
    const e = r.elements[0];
    const faux = ['>', '<', '='].find((s) => s !== e.correct) as string;
    await userEvent.click(bouton(faux));
    expect(status()).toBe('Pas tout à fait. Essaie encore.');
    expect(groupe(r, e.id)).toBeTruthy();
    expect(screen.getByText(`0 sur ${r.elements.length}`)).toBeTruthy();
  });

  it('« Indice » désactive un mauvais symbole, jamais le bon', async () => {
    const r = tour();
    mount(r);
    await userEvent.click(screen.getByRole('button', { name: 'Indice' }));
    const e = r.elements[0];
    const desactives = ['>', '<', '='].filter((s) => (bouton(s) as HTMLButtonElement).disabled);
    expect(desactives).toHaveLength(1);
    expect(desactives[0]).not.toBe(e.correct);
  });

  it('jouer tout le tour appelle onDone une seule fois avec tous les résultats', async () => {
    const r = tour();
    const onDone = vi.fn();
    mount(r, onDone);
    for (const e of r.elements) await userEvent.click(bouton(e.correct));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0][0]).toHaveLength(r.elements.length);
    expect(screen.getByText('Tous les éléments sont faits.')).toBeTruthy();
  });

  it('se joue au clavier', async () => {
    const r = tour();
    mount(r);
    bouton(r.elements[0].correct).focus();
    await userEvent.keyboard('{Enter}');
    expect(status()).toBe('Bien vu.');
  });
});
