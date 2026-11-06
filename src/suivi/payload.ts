import type { ElementResult, RoundState } from '../engine/round.js';
import type { ProfileId } from '../engine/types.js';
import type { ResultatEnvoye, SessionPayload } from './types.js';

/** Plafonds de `game_record_session` (supabase/migrations/20261107_game_suivi.sql) : au-delà, la base refuse toute la séance. */
const MAX_RESULTATS = 50;
const MAX_MAUVAIS_CHOIX = 10;
const MAX_ETIQUETTES = 100;
const MAX_LONGUEUR_ETIQUETTE = 80;

export interface ContexteSession {
  sessionId: string;
  round: RoundState;
  results: ElementResult[];
  profile: ProfileId;
  cibles: string[];
  maintenant: Date;
}

/**
 * Construit la séance à envoyer à partir du tour terminé. La bonne réponse de chaque élément est lue dans le tour ;
 * un résultat dont l'élément est inconnu du tour est ignoré. Rien d'autre que des identifiants et des étiquettes
 * de la consigne n'est copié.
 */
export function construirePayload(c: ContexteSession): SessionPayload {
  const corrects = new Map(c.round.elements.map((e) => [e.id, e.correct]));
  const results: ResultatEnvoye[] = [];
  for (const r of c.results) {
    if (results.length >= MAX_RESULTATS) break;
    const correct = corrects.get(r.elementId);
    if (correct === undefined) continue;
    // Le nombre d'essais reste exact ; seuls les premiers mauvais choix sont gardés (la base refuse la séance entière au-delà).
    results.push({ ...r, wrongChoices: r.wrongChoices.slice(0, MAX_MAUVAIS_CHOIX), correct });
  }

  const ids = new Set<string>();
  for (const r of results) {
    ids.add(r.correct);
    for (const w of r.wrongChoices) ids.add(w);
  }
  const labels: Record<string, string> = {};
  for (const id of ids) {
    if (Object.keys(labels).length >= MAX_ETIQUETTES) break;
    const label = c.round.labels[id];
    if (label !== undefined) labels[id] = label.slice(0, MAX_LONGUEUR_ETIQUETTE);
  }

  return {
    sessionId: c.sessionId,
    mechanic: c.round.mechanic,
    profile: c.profile,
    cibles: [...c.cibles],
    totalElements: Math.min(c.round.elements.length, MAX_RESULTATS),
    endedAt: c.maintenant.toISOString(),
    labels,
    results,
  };
}
