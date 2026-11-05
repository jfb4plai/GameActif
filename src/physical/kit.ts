import type { Activity, MechanicId, ProfileId } from '../engine/types.js';
import { makeRng } from '../engine/rng.js';
import { setupRound } from '../engine/setup.js';
import type { RoundState } from '../engine/round.js';
import { PHYSICAL_TEMPLATES } from './templates.js';
import type { PhysicalCounts, PhysicalKit } from './types.js';

/**
 * Fiche de jeu physique calculée depuis le MÊME tour que le jeu numérique : mêmes éléments validés,
 * mêmes quantités, même ordre de cartes (déjà mélangé par le moteur, jamais remélangé ici).
 * `pupils` ne sert qu'à calculer le nombre d'équipes.
 */
export function buildPhysicalKit(
  activity: Activity,
  mechanic: MechanicId,
  profile: ProfileId,
  seed: number,
  pupils: number,
): PhysicalKit {
  const template = PHYSICAL_TEMPLATES[mechanic];
  const round = setupRound(activity, mechanic, profile, makeRng(seed));
  const counts: PhysicalCounts = {
    elements: round.elements.length,
    stations: round.options.length,
    teams: Math.max(1, Math.ceil(pupils / template.teamSize.max)),
  };
  return {
    mechanic,
    title: template.title,
    moves: template.moves,
    durationMin: template.durationMin,
    material: template.material.map((m) => ({ name: m.name, count: m.count(counts), note: m.note })),
    setup: template.setup,
    play: template.play,
    calm: template.calm,
    differentiation: template.differentiation[profile],
    check: template.check,
    ...contenuDuKit(round),
  };
}

const LETTRES = 'ABCD';

/** Stations, cartes et corrigé d'un tour. Mémo imprime tout le deck ; QCM remplace les stations par des lettres. */
function contenuDuKit(round: RoundState): Pick<PhysicalKit, 'stations' | 'cards' | 'answerKey'> {
  const answerKey = round.elements.map((e) => ({ cardId: e.id, stationId: e.correct }));
  if (round.mechanic === 'memo') {
    return {
      stations: round.options.map((id) => ({ id, label: round.labels[id] })),
      cards: (round.deck ?? []).map((id) => ({ id, text: round.labels[id] })),
      answerKey,
    };
  }
  if (round.mechanic === 'qcm') {
    const largeur = Math.max(...round.elements.map((e) => e.choices?.length ?? 0));
    return {
      stations: Array.from({ length: largeur }, (_, i) => ({ id: LETTRES[i], label: LETTRES[i] })),
      cards: round.elements.map((e) => ({
        id: e.id,
        text: `${round.labels[e.id]} ${(e.choices ?? []).map((c, i) => `${LETTRES[i]} : ${round.labels[c]}`).join(', ')}`,
      })),
      answerKey: round.elements.map((e) => ({ cardId: e.id, stationId: LETTRES[(e.choices ?? []).indexOf(e.correct)] })),
    };
  }
  return {
    stations: round.options.map((id) => ({ id, label: round.labels[id] })),
    cards: round.elements.map((e) => ({ id: e.id, text: round.labels[e.id] })),
    answerKey,
  };
}
