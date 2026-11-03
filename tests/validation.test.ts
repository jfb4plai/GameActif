import { describe, it, expect } from 'vitest';
import { validateActivity, canPublish, editStats } from '../src/engine/validation.js';
import { eauActivity } from './fixtures.js';

describe('validateActivity', () => {
  it('ne signale rien pour l’activité complète', () => {
    expect(validateActivity(eauActivity())).toEqual([]);
  });

  it('signale un identifiant en double', () => {
    const a = eauActivity();
    a.categories.push({ id: 'a1', label: 'Doublon' });
    expect(validateActivity(a)).toContain('Identifiant en double : a1');
  });

  it('signale une paire avec un élément inconnu', () => {
    const a = eauActivity();
    a.pairs.push({ leftId: 'zz', rightId: 'b1' });
    expect(validateActivity(a)).toContain('Paire avec un élément inconnu : zz / b1');
  });

  it('signale un élément classé dans deux catégories', () => {
    const a = eauActivity();
    a.memberships.push({ itemId: 't1', categoryId: 'c2' });
    expect(validateActivity(a)).toContain('Élément classé dans deux catégories : t1');
  });

  it('signale une position en double', () => {
    const a = eauActivity();
    a.ranks.push({ itemId: 'a1', position: 2 });
    expect(validateActivity(a)).toContain('Position en double : 2');
  });
});

describe('canPublish', () => {
  it('autorise l’activité complète et validée', () => {
    expect(canPublish(eauActivity())).toEqual({ ok: true, reasons: [] });
  });

  it('refuse sans contexte de classe', () => {
    const a = eauActivity();
    a.context = '   ';
    expect(canPublish(a).reasons).toContain('Le contexte de classe est obligatoire.');
  });

  it('refuse tant qu’un élément n’est pas validé', () => {
    const a = eauActivity();
    a.items[0].validated = false;
    a.items[1].validated = false;
    const r = canPublish(a);
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain('2 élément(s) pas encore validé(s).');
  });

  it('refuse quand aucune mécanique n’est disponible', () => {
    const a = eauActivity();
    a.pairs = [];
    a.memberships = [];
    a.ranks = [];
    expect(canPublish(a).reasons).toContain('Aucune mécanique disponible : complétez au moins une relation.');
  });
});

describe('cibles (attendus du référentiel)', () => {
  const known = new Set(['M.P4.1.1.i1.a1', 'M.P4.1.1.i1.a2', 'M.P4.1.1.i1.a3', 'M.P4.1.1.i2.a2', 'TEST.eau.1']);

  it('refuse sans aucune cible', () => {
    const a = eauActivity();
    a.cibles = [];
    expect(canPublish(a).reasons).toContain('Il faut choisir de 1 à 3 attendus du référentiel.');
  });

  it('refuse plus de 3 cibles', () => {
    const a = eauActivity();
    a.cibles = ['M.P4.1.1.i1.a1', 'M.P4.1.1.i1.a2', 'M.P4.1.1.i1.a3', 'M.P4.1.1.i2.a2'];
    expect(canPublish(a, known).reasons).toContain('Il faut choisir de 1 à 3 attendus du référentiel.');
  });

  it('refuse un code inconnu du jeu de données', () => {
    const a = eauActivity();
    a.cibles = ['M.P4.9.9.i9.a9'];
    expect(canPublish(a, known).reasons).toContain('Attendu inconnu : M.P4.9.9.i9.a9');
  });

  it('refuse un même attendu choisi deux fois', () => {
    const a = eauActivity();
    a.cibles = ['M.P4.1.1.i1.a1', 'M.P4.1.1.i1.a1'];
    expect(canPublish(a, known).reasons).toContain('Attendu choisi deux fois : M.P4.1.1.i1.a1');
  });

  it('accepte de 1 à 3 codes connus', () => {
    const a = eauActivity();
    a.cibles = ['M.P4.1.1.i1.a1', 'M.P4.1.1.i1.a2', 'M.P4.1.1.i1.a3'];
    expect(canPublish(a, known)).toEqual({ ok: true, reasons: [] });
  });

  it('sans jeu de données fourni, ne contrôle que le nombre', () => {
    const a = eauActivity();
    a.cibles = ['inconnu-mais-non-controle'];
    expect(canPublish(a)).toEqual({ ok: true, reasons: [] });
  });
});

describe('editStats', () => {
  it('compte les éléments proposés par l’IA, modifiés ou non', () => {
    const a = eauActivity();
    a.items[0].origin = 'ia';
    a.items[0].modified = true;
    a.items[1].origin = 'ia';
    a.items[2].origin = 'ia';
    expect(editStats(a.items)).toEqual({ total: 3, modified: 1, unchanged: 2 });
  });
});
