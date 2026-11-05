// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QcmBoard } from '../../src/ui/QcmBoard';
import { CalmProvider } from '../../src/ui/CalmContext';
import { setupRound } from '../../src/engine/setup.js';
import { makeRng } from '../../src/engine/rng.js';
import type { ElementResult, RoundState } from '../../src/engine/round.js';
import { qcmActivity } from '../fixtures.js';

afterEach(() => cleanup());

function mount(round: RoundState, onDone: (r: ElementResult[]) => void = () => {}) {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  return render(<CalmProvider><QcmBoard round={round} onDone={onDone} /></CalmProvider>);
}
const tour = () => setupRound(qcmActivity(), 'qcm', 'standard', makeRng(1));
const reponse = (r: RoundState, id: string) => screen.getByRole('button', { name: r.labels[id] });
const status = () => screen.getByRole('status').textContent;

describe('QcmBoard', () => {
  it('affiche la première question, ses réponses dans l’ordre des choix et la progression', () => {
    const r = tour();
    mount(r);
    const e = r.elements[0];
    expect(screen.getByRole('heading', { name: r.labels[e.id] })).toBeTruthy();
    expect(screen.getByText(`0 sur ${r.elements.length}`)).toBeTruthy();
    const noms = screen.getAllByRole('button').map((b) => b.textContent).filter((t) => t !== 'Indice');
    expect(noms).toEqual((e.choices as string[]).map((c) => r.labels[c]));
  });

  it('une bonne réponse affiche « Bien vu. » et passe à la question suivante', async () => {
    const r = tour();
    mount(r);
    await userEvent.click(reponse(r, r.elements[0].correct));
    expect(status()).toBe('Bien vu.');
    expect(screen.getByText(`1 sur ${r.elements.length}`)).toBeTruthy();
    expect(screen.getByRole('heading', { name: r.labels[r.elements[1].id] })).toBeTruthy();
  });

  it('une mauvaise réponse invite à réessayer et garde la même question', async () => {
    const r = tour();
    mount(r);
    const e = r.elements[0];
    const faux = (e.choices as string[]).find((c) => c !== e.correct) as string;
    await userEvent.click(reponse(r, faux));
    expect(status()).toBe('Pas tout à fait. Essaie encore.');
    expect(screen.getByRole('heading', { name: r.labels[e.id] })).toBeTruthy();
    expect((reponse(r, faux) as HTMLButtonElement).disabled).toBe(true);
  });

  it('« Indice » désactive une mauvaise réponse, jamais la bonne', async () => {
    const r = tour();
    mount(r);
    await userEvent.click(screen.getByRole('button', { name: 'Indice' }));
    const e = r.elements[0];
    const desactivees = (e.choices as string[]).filter((c) => (reponse(r, c) as HTMLButtonElement).disabled);
    expect(desactivees).toHaveLength(1);
    expect(desactivees[0]).not.toBe(e.correct);
  });

  it('jouer tout le tour appelle onDone une seule fois avec tous les résultats', async () => {
    const r = tour();
    const onDone = vi.fn();
    mount(r, onDone);
    for (const e of r.elements) await userEvent.click(reponse(r, e.correct));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0][0]).toHaveLength(r.elements.length);
    expect(screen.getByText('Tous les éléments sont faits.')).toBeTruthy();
  });

  it('se joue au clavier', async () => {
    const r = tour();
    mount(r);
    reponse(r, r.elements[0].correct).focus();
    await userEvent.keyboard('{Enter}');
    expect(status()).toBe('Bien vu.');
  });
});
