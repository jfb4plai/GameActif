// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SceneBoard, HINT_AFTER_ERRORS } from '../../src/ui/SceneBoard';
import { CalmProvider } from '../../src/ui/CalmContext';
import { setupRound } from '../../src/engine/setup.js';
import { makeRng } from '../../src/engine/rng.js';
import { activitePilote } from '../../src/data/pilote.js';
import { SCENES } from '../../src/scenes/chat-table-boite-arbres.js';
import type { ElementResult, RoundState } from '../../src/engine/round.js';
import type { ProfileId } from '../../src/engine/types.js';

afterEach(() => cleanup());

const scene = SCENES['chat-table-boite-arbres'];

function mount(profile: ProfileId = 'standard', onDone: (r: ElementResult[]) => void = () => {}) {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  const round: RoundState = setupRound(activitePilote(), 'placer', profile, makeRng(1));
  render(<CalmProvider><SceneBoard round={round} profile={profile} onDone={onDone} /></CalmProvider>);
  return round;
}

const cat = () => screen.getByRole('button', { name: /Le chat/ });
const position = () => ({ x: Number(cat().getAttribute('data-x')), y: Number(cat().getAttribute('data-y')) });
const status = () => screen.getByRole('status').textContent as string;
const key = (k: string, shift = false) => fireEvent.keyDown(cat(), { key: k, shiftKey: shift });

function moveCatToZone(zoneId: string) {
  const z = scene.zones.find((x) => x.id === zoneId)!;
  const tx = (z.rect.x1 + z.rect.x2) / 2;
  const ty = (z.rect.y1 + z.rect.y2) / 2;
  for (let i = 0; i < 80; i++) {
    const { x, y } = position();
    if (Math.abs(x - tx) <= 8 && Math.abs(y - ty) <= 8) return;
    if (x < tx - 8) key('ArrowRight', tx - x > 60);
    else if (x > tx + 8) key('ArrowLeft', x - tx > 60);
    else if (y < ty - 8) key('ArrowDown', ty - y > 60);
    else key('ArrowUp', y - ty > 60);
  }
  throw new Error('chat non amené dans la zone ' + zoneId);
}
const otherZone = (not: string, rank = 0) => scene.zones.filter((z) => z.id !== not)[rank].id;

describe('SceneBoard', () => {
  it('affiche la consigne du premier élément non résolu et décrit la scène', () => {
    const round = mount();
    expect(screen.getByText(round.labels[round.elements[0].id])).toBeTruthy();
    expect(screen.getByText(`Consigne 1 sur ${round.elements.length}`)).toBeTruthy();
    expect(screen.getByRole('group', { name: scene.description })).toBeTruthy();
  });

  it('poser le chat dans la bonne zone, au clavier, résout la consigne', () => {
    const round = mount();
    moveCatToZone(round.elements[0].correct);
    key('Enter');
    expect(status()).toBe('Bien placé.');
    expect(screen.getByRole('button', { name: 'Consigne suivante' })).toBeTruthy();
  });

  it('poser hors de toute zone ne compte aucun essai et ramène le chat au départ', () => {
    const round = mount();
    key('Enter');
    expect(status()).toContain('aucune zone');
    expect(position()).toEqual(scene.start);
    expect(screen.getByText(`Consigne 1 sur ${round.elements.length}`)).toBeTruthy();
    expect(screen.queryByTestId('indice-zone')).toBeNull();
  });

  it('une mauvaise zone invite à relire la consigne', () => {
    const round = mount();
    moveCatToZone(otherZone(round.elements[0].correct));
    key('Enter');
    expect(status()).toBe('Pas tout à fait. Relis la consigne, puis réessaie.');
    expect(position()).toEqual(scene.start);
  });

  it('le cadre d’indice apparaît après 2 erreurs en Standard, 1 en Soutien, jamais en Défi', () => {
    expect(HINT_AFTER_ERRORS).toEqual({ soutien: 1, standard: 2, defi: null });
    for (const [profile, erreurs, attendu] of [
      ['standard', 1, false],
      ['standard', 2, true],
      ['soutien', 1, true],
      ['defi', 2, false],
    ] as const) {
      const round = mount(profile);
      const correct = round.elements[0].correct;
      for (let i = 0; i < erreurs; i++) {
        moveCatToZone(otherZone(correct, i));
        key('Enter');
      }
      expect(!!screen.queryByTestId('indice-zone')).toBe(attendu);
      cleanup();
    }
  });

  it('le message d’indice ne nomme jamais la zone attendue', () => {
    const round = mount('soutien');
    const zone = scene.zones.find((z) => z.id === round.elements[0].correct)!;
    moveCatToZone(otherZone(zone.id));
    key('Enter');
    expect(screen.getByTestId('indice-zone')).toBeTruthy();
    expect(status().toLowerCase()).not.toContain(zone.label.toLowerCase());
  });

  it('un parcours complet au clavier seul appelle onDone avec tous les résultats', async () => {
    const onDone = vi.fn();
    const round = mount('standard', onDone);
    for (let i = 0; i < round.elements.length; i++) {
      const e = round.elements[i];
      expect(screen.getByText(round.labels[e.id])).toBeTruthy();
      moveCatToZone(e.correct);
      key('Enter');
      if (i < round.elements.length - 1) {
        screen.getByRole('button', { name: 'Consigne suivante' }).focus();
        await userEvent.keyboard('{Enter}');
      }
    }
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0][0]).toHaveLength(round.elements.length);
  });

  it('une lecture à voix haute indisponible le dit au lieu de se taire', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Écouter la consigne' }));
    expect(status()).toContain('lecture à voix haute');
  });
});
