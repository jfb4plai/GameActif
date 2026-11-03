import { describe, it, expect } from 'vitest';
import { PHYSICAL_TEMPLATES, templateProblems } from '../../src/physical/templates.js';
import type { PhysicalTemplate } from '../../src/physical/types.js';

// Copie indépendante : le modèle contient des fonctions, structuredClone ne s'applique pas.
const base = (): PhysicalTemplate => ({
  ...PHYSICAL_TEMPLATES.trier,
  moves: [...PHYSICAL_TEMPLATES.trier.moves],
  calm: { ...PHYSICAL_TEMPLATES.trier.calm },
});

describe('PHYSICAL_TEMPLATES', () => {
  it('chaque mécanique numérique a un jeu physique en regard', () => {
    expect(Object.keys(PHYSICAL_TEMPLATES).sort()).toEqual(['associer', 'ordre', 'placer', 'trier']);
  });

  it('les quatre modèles respectent les contraintes de JF', () => {
    for (const t of Object.values(PHYSICAL_TEMPLATES)) expect(templateProblems(t)).toEqual([]);
  });

  it('titres prévus par l’avenant §12', () => {
    expect(PHYSICAL_TEMPLATES.trier.title).toBe('Les boîtes aux lettres');
    expect(PHYSICAL_TEMPLATES.associer.title).toBe('Les paires à pincer');
    expect(PHYSICAL_TEMPLATES.ordre.title).toBe('La chaîne silencieuse');
    expect(PHYSICAL_TEMPLATES.placer.title).toBe('Place-le dans la classe');
  });

  it('la chaîne silencieuse se joue en silence', () => {
    expect(PHYSICAL_TEMPLATES.ordre.calm.voice).toBe('silence');
  });

  it('Place-le dans la classe n’autorise que des objets doux', () => {
    expect(PHYSICAL_TEMPLATES.placer.calm.safeMaterial).toContain('doux');
  });
});

describe('templateProblems', () => {
  it('refuse un modèle sans manipulation ni déplacement', () => {
    const t = base();
    t.moves = [];
    expect(templateProblems(t)).toContain('Il faut au moins une manipulation ou un déplacement.');
  });

  it('refuse un modèle où zéro ou plusieurs groupes se déplacent en même temps', () => {
    for (const n of [0, 2]) {
      const t = base();
      t.calm.maxGroupsMoving = n;
      expect(templateProblems(t)).toContain('Un seul groupe doit se déplacer à la fois.');
    }
  });

  it('refuse un modèle sans signal d’arrêt ou sans matériel sûr', () => {
    const a = base();
    a.calm.stopSignal = '  ';
    expect(templateProblems(a)).toContain('Il faut un signal d’arrêt.');
    const b = base();
    b.calm.safeMaterial = '';
    expect(templateProblems(b)).toContain('Il faut préciser le matériel sûr.');
  });

  it('refuse une voix qui n’est ni chuchotée ni silencieuse', () => {
    const t = base();
    (t.calm as { voice: string }).voice = 'normale';
    expect(templateProblems(t)).toContain('La voix doit être chuchotée ou silencieuse.');
  });

  it('refuse un déplacement sans chemin balisé', () => {
    const t = base();
    t.calm.pathMarked = false;
    expect(templateProblems(t)).toContain('Un déplacement exige un chemin balisé.');
  });
});
