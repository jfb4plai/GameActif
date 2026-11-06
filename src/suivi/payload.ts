import type { ElementResult, RoundState } from '../engine/round.js';
import type { ProfileId } from '../engine/types.js';
import type { ResultatEnvoye, SessionPayload } from './types.js';

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
    const correct = corrects.get(r.elementId);
    if (correct === undefined) continue;
    results.push({ ...r, wrongChoices: [...r.wrongChoices], correct });
  }

  const ids = new Set<string>();
  for (const r of results) {
    ids.add(r.correct);
    for (const w of r.wrongChoices) ids.add(w);
  }
  const labels: Record<string, string> = {};
  for (const id of ids) {
    const label = c.round.labels[id];
    if (label !== undefined) labels[id] = label;
  }

  return {
    sessionId: c.sessionId,
    mechanic: c.round.mechanic,
    profile: c.profile,
    cibles: [...c.cibles],
    totalElements: c.round.elements.length,
    endedAt: c.maintenant.toISOString(),
    labels,
    results,
  };
}
