import { describe, it, expect } from 'vitest';
import { buildPhysicalKit } from '../../src/physical/kit.js';
import { PHYSICAL_TEMPLATES } from '../../src/physical/templates.js';
import { setupRound } from '../../src/engine/setup.js';
import { makeRng } from '../../src/engine/rng.js';
import type { MechanicId } from '../../src/engine/types.js';
import { eauActivity, sceneActivity, toutesActivity } from '../fixtures.js';

const count = (kit: ReturnType<typeof buildPhysicalKit>, start: string) =>
  kit.material.find((m) => m.name.startsWith(start))?.count;

describe('buildPhysicalKit', () => {
  it('Trier en Standard : cartes, stations et boîtes suivent le tour du moteur', () => {
    const kit = buildPhysicalKit(eauActivity(), 'trier', 'standard', 1, 24);
    expect(kit.cards).toHaveLength(6);
    expect(kit.stations).toHaveLength(3);
    expect(count(kit, 'Boîtes')).toBe(3);
    expect(count(kit, 'Cartes-mots')).toBe(6);
  });

  it('une activité de 3 consignes donne 3 cartes, pas le maximum du profil', () => {
    const a = sceneActivity();
    a.memberships = a.memberships.slice(0, 3);
    const kit = buildPhysicalKit(a, 'placer', 'standard', 1, 24);
    expect(kit.cards).toHaveLength(3);
    expect(count(kit, 'Cartes-consignes')).toBe(3);
  });

  it('un texte de 90 caractères reste entier sur la carte', () => {
    const a = eauActivity();
    const long = 'x'.repeat(30) + ' ' + 'y'.repeat(30) + ' ' + 'z'.repeat(28);
    expect(long).toHaveLength(90);
    a.items[8].text = long;
    const kit = buildPhysicalKit(a, 'trier', 'defi', 1, 24);
    expect(kit.cards.find((c) => c.id === 't1')?.text).toBe(long);
  });

  it('l’ordre des cartes ne trahit pas la réponse (50 graines)', () => {
    for (const mechanic of ['associer', 'ordre'] as MechanicId[]) {
      for (let seed = 0; seed < 50; seed++) {
        const kit = buildPhysicalKit(eauActivity(), mechanic, 'standard', seed, 24);
        kit.cards.forEach((card, i) => {
          const answer = kit.answerKey.find((k) => k.cardId === card.id)?.stationId;
          expect(kit.stations[i].id).not.toBe(answer);
        });
      }
    }
  });

  it('le corrigé reprend les réponses du moteur', () => {
    const kit = buildPhysicalKit(eauActivity(), 'trier', 'standard', 3, 24);
    const round = setupRound(eauActivity(), 'trier', 'standard', makeRng(3));
    expect(kit.answerKey).toEqual(round.elements.map((e) => ({ cardId: e.id, stationId: e.correct })));
    expect(kit.cards.map((c) => c.id)).toEqual(round.elements.map((e) => e.id));
  });

  it('même graine, même fiche', () => {
    const a = buildPhysicalKit(eauActivity(), 'ordre', 'soutien', 7, 20);
    const b = buildPhysicalKit(eauActivity(), 'ordre', 'soutien', 7, 20);
    expect(a).toEqual(b);
  });

  it('le nombre d’équipes vaut effectif divisé par la taille maximale, au moins 1', () => {
    const kit = buildPhysicalKit(eauActivity(), 'trier', 'standard', 1, 24);
    expect(count(kit, 'Cartons')).toBe(Math.ceil(24 / PHYSICAL_TEMPLATES.trier.teamSize.max));
    expect(count(buildPhysicalKit(eauActivity(), 'trier', 'standard', 1, 0), 'Cartons')).toBe(1);
  });

  it('recopie titre, déplacements, garde-fous et adaptation du profil du modèle', () => {
    const kit = buildPhysicalKit(eauActivity(), 'trier', 'soutien', 1, 24);
    expect(kit.title).toBe(PHYSICAL_TEMPLATES.trier.title);
    expect(kit.calm).toEqual(PHYSICAL_TEMPLATES.trier.calm);
    expect(kit.differentiation).toBe(PHYSICAL_TEMPLATES.trier.differentiation.soutien);
  });
});

describe('buildPhysicalKit, nouveaux gabarits', () => {
  it('Comparer : une carte par comparaison, trois stations, corrigé du moteur', () => {
    const kit = buildPhysicalKit(toutesActivity(), 'comparer', 'standard', 1, 24);
    const tour = setupRound(toutesActivity(), 'comparer', 'standard', makeRng(1));
    expect(kit.cards).toHaveLength(5);
    expect(kit.stations.map((s) => s.label)).toEqual(['>', '<', '=']);
    expect(kit.answerKey).toEqual(tour.elements.map((e) => ({ cardId: e.id, stationId: e.correct })));
    expect(count(kit, 'Cartes-nombres')).toBe(10);
    expect(count(kit, 'Cartons-symboles')).toBe(kit.material.find((m) => m.name.startsWith('Cartons verts'))!.count * 3);
  });

  it('Mémo : toutes les cartes du deck, corrigé d’une ligne par paire', () => {
    const kit = buildPhysicalKit(eauActivity(), 'memo', 'standard', 1, 24);
    const tour = setupRound(eauActivity(), 'memo', 'standard', makeRng(1));
    expect(kit.cards.map((c) => c.id)).toEqual(tour.deck);
    expect(kit.cards).toHaveLength(2 * kit.answerKey.length);
    expect(kit.answerKey).toHaveLength(tour.elements.length);
    expect(count(kit, 'Cartes')).toBe(kit.cards.length);
  });

  it('QCM : stations en lettres, carte = question et réponses lettrées, corrigé = lettre juste', () => {
    const kit = buildPhysicalKit(toutesActivity(), 'qcm', 'standard', 1, 24);
    const tour = setupRound(toutesActivity(), 'qcm', 'standard', makeRng(1));
    expect(kit.stations.map((s) => s.id)).toEqual(['A', 'B', 'C']);
    expect(kit.cards).toHaveLength(tour.elements.length);
    for (const e of tour.elements) {
      const choices = e.choices as string[];
      const lettre = 'ABCD'[choices.indexOf(e.correct)];
      expect(kit.answerKey.find((k) => k.cardId === e.id)?.stationId).toBe(lettre);
      const texte = kit.cards.find((c) => c.id === e.id)!.text;
      expect(texte.startsWith(tour.labels[e.id])).toBe(true);
      choices.forEach((c, i) => expect(texte).toContain(`${'ABCD'[i]} : ${tour.labels[c]}`));
    }
  });
});
