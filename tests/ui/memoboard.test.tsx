// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoBoard } from '../../src/ui/MemoBoard';
import { CalmProvider } from '../../src/ui/CalmContext';
import { setupRound } from '../../src/engine/setup.js';
import { makeRng } from '../../src/engine/rng.js';
import type { ElementResult, RoundState } from '../../src/engine/round.js';
import { eauActivity } from '../fixtures.js';

afterEach(() => cleanup());

function mount(round: RoundState, onDone: (r: ElementResult[]) => void = () => {}) {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  return render(<CalmProvider><MemoBoard round={round} onDone={onDone} /></CalmProvider>);
}
const tour = (profil: 'standard' | 'defi' = 'standard') => setupRound(eauActivity(), 'memo', profil, makeRng(1));
const numero = (r: RoundState, id: string) => (r.deck as string[]).indexOf(id) + 1;
const carte = (r: RoundState, id: string) => screen.getByRole('button', { name: new RegExp(`^Carte ${numero(r, id)}(,| :)`) });
const status = () => screen.getByRole('status').textContent;
/** Un élément et une carte du côté droit d'une autre paire : jamais une paire. */
const mauvaisePaire = (r: RoundState): [string, string] => [r.elements[0].id, r.elements[1].correct];

describe('MemoBoard', () => {
  it('affiche toutes les cartes face cachée, avec un nom accessible et la progression', () => {
    const r = tour();
    mount(r);
    const cartes = screen.getAllByRole('button', { name: /^Carte \d+, face cachée$/ });
    expect(cartes).toHaveLength((r.deck as string[]).length);
    expect(screen.getByText(`0 sur ${r.elements.length}`)).toBeTruthy();
  });

  it('une bonne paire reste visible, « trouvée », avec « Bien vu. »', async () => {
    const r = tour();
    mount(r);
    const e = r.elements[0];
    await userEvent.click(carte(r, e.id));
    await userEvent.click(carte(r, e.correct));
    expect(status()).toBe('Bien vu.');
    expect(carte(r, e.id).getAttribute('aria-label')).toBe(`Carte ${numero(r, e.id)} : ${r.labels[e.id]}, trouvée`);
    expect(carte(r, e.correct).getAttribute('aria-label')).toContain('trouvée');
    expect(screen.getByText(`1 sur ${r.elements.length}`)).toBeTruthy();
  });

  it('deux cartes non liées restent visibles ; « Cacher les cartes » les remet face cachée', async () => {
    const r = tour();
    mount(r);
    const [a, b] = mauvaisePaire(r);
    await userEvent.click(carte(r, a));
    await userEvent.click(carte(r, b));
    expect(status()).toBe('Pas tout à fait. Essaie encore.');
    expect(carte(r, a).getAttribute('aria-label')).toBe(`Carte ${numero(r, a)} : ${r.labels[a]}`);
    expect(carte(r, b).getAttribute('aria-label')).toBe(`Carte ${numero(r, b)} : ${r.labels[b]}`);
    await userEvent.click(screen.getByRole('button', { name: 'Cacher les cartes' }));
    expect(carte(r, a).getAttribute('aria-label')).toBe(`Carte ${numero(r, a)}, face cachée`);
    expect(carte(r, b).getAttribute('aria-label')).toBe(`Carte ${numero(r, b)}, face cachée`);
    expect(screen.queryByRole('button', { name: 'Cacher les cartes' })).toBeNull();
  });

  it('une troisième carte cache les deux autres et se retourne seule, sans compter comme une paire (Review Focus 6)', async () => {
    const r = tour();
    mount(r);
    const [a, b] = mauvaisePaire(r);
    const c = r.elements[2].id;
    await userEvent.click(carte(r, a));
    await userEvent.click(carte(r, b));
    await userEvent.click(carte(r, c));
    expect(carte(r, a).getAttribute('aria-label')).toContain('face cachée');
    expect(carte(r, b).getAttribute('aria-label')).toContain('face cachée');
    expect(carte(r, c).getAttribute('aria-label')).toBe(`Carte ${numero(r, c)} : ${r.labels[c]}`);
    expect(screen.getByText(`0 sur ${r.elements.length}`)).toBeTruthy();
  });

  it('cliquer deux fois la même carte ne forme pas une paire (Review Focus 6)', async () => {
    const r = tour();
    mount(r);
    const a = r.elements[0].id;
    await userEvent.click(carte(r, a));
    await userEvent.click(carte(r, a));
    expect(status()).not.toBe('Pas tout à fait. Essaie encore.');
    expect(carte(r, a).getAttribute('aria-label')).toBe(`Carte ${numero(r, a)} : ${r.labels[a]}`);
    expect(screen.queryByRole('button', { name: 'Cacher les cartes' })).toBeNull();
  });

  it('cliquer une carte déjà trouvée est ignoré (Review Focus 6)', async () => {
    const r = tour();
    mount(r);
    const e = r.elements[0];
    await userEvent.click(carte(r, e.id));
    await userEvent.click(carte(r, e.correct));
    await userEvent.click(carte(r, e.id));
    await userEvent.click(carte(r, r.elements[1].id));
    expect(screen.getByText(`1 sur ${r.elements.length}`)).toBeTruthy();
    expect(carte(r, r.elements[1].id).getAttribute('aria-label')).toBe(`Carte ${numero(r, r.elements[1].id)} : ${r.labels[r.elements[1].id]}`);
  });

  it('« Indice » entoure la carte partenaire et annonce l’aide', async () => {
    const r = tour();
    mount(r);
    const e = r.elements[0];
    await userEvent.click(carte(r, e.id));
    await userEvent.click(screen.getByRole('button', { name: 'Indice' }));
    expect(carte(r, e.correct).classList.contains('indice')).toBe(true);
    expect(status()).toContain('Une carte est entourée');
  });

  it('« Indice » est inactif sans carte retournée et quand il n’y a plus d’indice', async () => {
    const r = tour('defi');
    mount(r);
    expect((screen.getByRole('button', { name: 'Indice' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(carte(r, r.elements[0].id));
    expect((screen.getByRole('button', { name: 'Indice' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('trouver toutes les paires appelle onDone une seule fois avec tous les résultats', async () => {
    const r = tour();
    const onDone = vi.fn();
    mount(r, onDone);
    for (const e of r.elements) {
      await userEvent.click(carte(r, e.id));
      await userEvent.click(carte(r, e.correct));
    }
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0][0]).toHaveLength(r.elements.length);
    expect(screen.getByText('Toutes les paires sont trouvées.')).toBeTruthy();
  });
});
