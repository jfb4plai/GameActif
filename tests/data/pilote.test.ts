import { describe, it, expect } from 'vitest';
import { activitePilote } from '../../src/data/pilote.js';
import { REFERENTIEL, referentielCodes } from '../../src/data/referentiel.js';
import { availableMechanics } from '../../src/engine/availability.js';
import { canPublish } from '../../src/engine/validation.js';
import { setupRound } from '../../src/engine/setup.js';
import { makeRng } from '../../src/engine/rng.js';
import { SCENES } from '../../src/scenes/chat-table-boite-arbres.js';

const texteOf = (code: string) => REFERENTIEL.find((e) => e.code === code)!.texte.toLowerCase();

describe('activitePilote (maths P4, sous-point 1.1)', () => {
  it('propose les quatre mécaniques', () => {
    const m = availableMechanics(activitePilote());
    expect(Object.values(m).every((x) => x.available)).toBe(true);
  });

  it('vise des attendus qui existent dans le jeu de données', () => {
    const a = activitePilote();
    expect(a.cibles).toEqual(['M.P4.1.1.i1.a1', 'M.P4.1.1.i1.a2', 'M.P4.1.1.i1.a3', 'M.P4.1.1.i2.a2']);
    for (const c of a.cibles) expect(referentielCodes().has(c)).toBe(true);
  });

  it('chaque mot de famille figure mot pour mot dans l’attendu de sa famille', () => {
    const a = activitePilote();
    const attenduDe: Record<string, string> = {
      'c-abs': 'M.P4.1.1.i1.a1',
      'c-rel': 'M.P4.1.1.i1.a2',
      'c-ord': 'M.P4.1.1.i1.a3',
    };
    const textes = new Map(a.items.map((i) => [i.id, i.text]));
    const classes = a.memberships.filter((m) => attenduDe[m.categoryId]);
    expect(classes.length).toBeGreaterThanOrEqual(9);
    for (const m of classes) {
      expect(texteOf(attenduDe[m.categoryId])).toContain((textes.get(m.itemId) as string).toLowerCase());
    }
  });

  it('chaque mot des paires de contraires figure dans l’un des attendus de position', () => {
    const a = activitePilote();
    const textes = new Map(a.items.map((i) => [i.id, i.text.toLowerCase()]));
    const positions = texteOf('M.P4.1.1.i1.a1') + ' ' + texteOf('M.P4.1.1.i1.a2');
    expect(a.pairs.length).toBeGreaterThanOrEqual(4);
    for (const p of a.pairs) {
      expect(positions).toContain(textes.get(p.leftId));
      expect(positions).toContain(textes.get(p.rightId));
    }
  });

  it('les rangs ordinaux viennent de l’attendu sur le vocabulaire ordinal', () => {
    const a = activitePilote();
    const textes = new Map(a.items.map((i) => [i.id, i.text.toLowerCase()]));
    const ordinaux = a.ranks.sort((x, y) => x.position - y.position).map((r) => textes.get(r.itemId));
    expect(ordinaux).toEqual(['premier', 'deuxième', 'troisième', 'dernier']);
    for (const mot of ordinaux) expect(texteOf('M.P4.1.1.i1.a3')).toContain(mot as string);
  });

  it('la scène choisie existe et chaque zone de l’activité existe dans la scène', () => {
    const a = activitePilote();
    const scene = SCENES[a.sceneId as string];
    expect(scene).toBeDefined();
    const zonesScene = new Set(scene.zones.map((z) => z.id));
    for (const c of a.categories.filter((x) => x.zone)) expect(zonesScene.has(c.id)).toBe(true);
  });

  it('aucun élément n’est validé : exemple non relu, la publication est refusée', () => {
    const a = activitePilote();
    expect(a.items.every((i) => !i.validated && i.origin === 'manuel')).toBe(true);
    const refus = canPublish(a, referentielCodes());
    expect(refus.ok).toBe(false);
    expect(refus.reasons).toContain(`${a.items.length} élément(s) pas encore validé(s).`);
  });

  it('les quatre tours se préparent sans erreur dans les trois profils', () => {
    for (const mechanic of ['associer', 'trier', 'ordre', 'placer'] as const) {
      for (const profile of ['soutien', 'standard', 'defi'] as const) {
        expect(() => setupRound(activitePilote(), mechanic, profile, makeRng(1))).not.toThrow();
      }
    }
  });
});
