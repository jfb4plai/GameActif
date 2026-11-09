import { describe, it, expect } from 'vitest';
import { MECANIQUES, mecanique, ordreAffichage } from '../src/engine/mecaniques.js';
import { availableMechanics } from '../src/engine/availability.js';
import { setupRound } from '../src/engine/setup.js';
import { makeRng } from '../src/engine/rng.js';
import { toutesActivity } from './fixtures.js';

describe('MECANIQUES', () => {
  it('liste les sept mécaniques une fois chacune', () => {
    expect(MECANIQUES.map((m) => m.id).sort()).toEqual(['associer', 'comparer', 'memo', 'ordre', 'placer', 'qcm', 'trier']);
  });

  it('suit l’ordre d’affichage prévu et les libellés', () => {
    expect(MECANIQUES.map((m) => m.id)).toEqual(['trier', 'associer', 'memo', 'ordre', 'comparer', 'qcm', 'placer']);
    expect(MECANIQUES.map((m) => m.label)).toEqual([
      'Trier', 'Associer', 'Mémo', 'Remettre en ordre', 'Comparer', 'QCM libre', 'Placer dans une scène',
    ]);
  });

  it('de la 1re à la 3e primaire, Associer passe en tête et le reste garde son ordre', () => {
    const attendu = ['associer', 'trier', 'memo', 'ordre', 'comparer', 'qcm', 'placer'];
    for (const annee of ['1re primaire', '2e primaire', '3e primaire']) expect(ordreAffichage(annee).map((m) => m.id)).toEqual(attendu);
  });

  it('de la 4e primaire à la 6e, ou pour un niveau inconnu, l’ordre prévu est conservé', () => {
    const prevu = MECANIQUES.map((m) => m.id);
    for (const annee of ['4e primaire', '5e primaire', '6e primaire', 'inconnu', '']) expect(ordreAffichage(annee).map((m) => m.id)).toEqual(prevu);
  });

  it('placer est la seule mécanique hors atelier', () => {
    expect(MECANIQUES.filter((m) => !m.atelier).map((m) => m.id)).toEqual(['placer']);
  });

  it('mecanique() retrouve une définition par identifiant', () => {
    expect(mecanique('qcm').label).toBe('QCM libre');
  });

  it('chaque mécanique disponible dans toutesActivity() se prépare', () => {
    const act = toutesActivity();
    const dispo = availableMechanics(act);
    const prets = MECANIQUES.filter((m) => dispo[m.id].available);
    expect(prets.length).toBe(7);
    for (const m of prets) expect(setupRound(act, m.id, 'standard', makeRng(1)).mechanic).toBe(m.id);
  });
});
