// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoundBoard } from '../../src/ui/RoundBoard';
import { CalmProvider } from '../../src/ui/CalmContext';
import { setupRound } from '../../src/engine/setup.js';
import { makeRng } from '../../src/engine/rng.js';
import { activitePilote } from '../../src/data/pilote.js';
import type { ElementResult, RoundState } from '../../src/engine/round.js';

afterEach(() => cleanup());

function mount(round: RoundState, onDone: (r: ElementResult[]) => void = () => {}) {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  return render(<CalmProvider><RoundBoard round={round} onDone={onDone} /></CalmProvider>);
}
const elementBtn = (r: RoundState, id: string) => screen.getByRole('button', { name: r.labels[id] });
const optionBtn = (r: RoundState, id: string) => screen.getByRole('button', { name: `Placer dans « ${r.labels[id]} »` });
const status = () => screen.getByRole('status').textContent;
const trier = () => setupRound(activitePilote(), 'trier', 'standard', makeRng(1));

describe('RoundBoard, choix au clic', () => {
  it('une bonne réponse affiche « Bien vu. » et fait avancer la progression', async () => {
    const r = trier();
    mount(r);
    expect(screen.getByText(`0 sur ${r.elements.length}`)).toBeTruthy();
    const e = r.elements[0];
    await userEvent.click(elementBtn(r, e.id));
    await userEvent.click(optionBtn(r, e.correct));
    expect(status()).toBe('Bien vu.');
    expect(screen.getByText(`1 sur ${r.elements.length}`)).toBeTruthy();
  });

  it('une mauvaise réponse invite à réessayer sans rien résoudre', async () => {
    const r = trier();
    mount(r);
    const e = r.elements[0];
    const wrong = r.options.find((o) => o !== e.correct) as string;
    await userEvent.click(elementBtn(r, e.id));
    await userEvent.click(optionBtn(r, wrong));
    expect(status()).toBe('Pas tout à fait. Essaie encore.');
    expect(screen.getByText(`0 sur ${r.elements.length}`)).toBeTruthy();
  });

  it('l’indice écarte une option et se désactive', async () => {
    const r = trier();
    mount(r);
    await userEvent.click(elementBtn(r, r.elements[0].id));
    const indice = screen.getByRole('button', { name: 'Indice' }) as HTMLButtonElement;
    await userEvent.click(indice);
    const options = r.options.map((o) => optionBtn(r, o) as HTMLButtonElement);
    expect(options.filter((b) => b.disabled)).toHaveLength(1);
    expect((screen.getByRole('button', { name: 'Indice' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('ne dit jamais « Faux », même après la révélation de la bonne réponse', async () => {
    const r = setupRound(activitePilote(), 'associer', 'defi', makeRng(2));
    mount(r);
    const e = r.elements[0];
    await userEvent.click(elementBtn(r, e.id));
    const wrongs = r.options.filter((o) => o !== e.correct).slice(0, 3);
    for (const w of wrongs) await userEvent.click(optionBtn(r, w));
    expect(status()).toContain('bonne réponse');
    expect(document.body.textContent).not.toMatch(/\bfaux\b/i);
  });
});

describe('RoundBoard, clavier seul', () => {
  it('un tour complet se joue avec Entrée et appelle onDone une fois', async () => {
    const r = trier();
    const onDone = vi.fn();
    mount(r, onDone);
    for (const e of r.elements) {
      elementBtn(r, e.id).focus();
      await userEvent.keyboard('{Enter}');
      optionBtn(r, e.correct).focus();
      await userEvent.keyboard('{Enter}');
    }
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0][0]).toHaveLength(r.elements.length);
  });
});

describe('RoundBoard, glisser', () => {
  it('lâcher sur la bonne option résout l’élément (preuve que le glissement agit)', () => {
    const r = trier();
    mount(r);
    const e = r.elements[0];
    const bin = optionBtn(r, e.correct).closest('.bin') as HTMLElement;
    bin.getBoundingClientRect = () => ({ left: 320, top: 320, right: 360, bottom: 360, width: 40, height: 40, x: 320, y: 320, toJSON() {} });
    const el = elementBtn(r, e.id);
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 300, clientY: 300 });
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 340, clientY: 340 });
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 340, clientY: 340 });
    expect(screen.getByText(`1 sur ${r.elements.length}`)).toBeTruthy();
    expect(status()).toBe('Bien vu.');
  });

  it('lâcher hors de toute option rappelle l’élément : aucun essai, onDone non appelé', () => {
    const r = trier();
    const onDone = vi.fn();
    mount(r, onDone);
    const e = r.elements[0];
    const el = elementBtn(r, e.id);
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 300, clientY: 300 });
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 340, clientY: 340 });
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 340, clientY: 340 });
    expect(screen.getByText(`0 sur ${r.elements.length}`)).toBeTruthy();
    expect(elementBtn(r, e.id)).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
    expect(status()).toBe('Choisis un élément pour commencer.');
  });
});
