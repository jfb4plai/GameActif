import type { ElementResult } from './round.js';
import type { ProfileId } from './types.js';

/** Seuils réglables par l'enseignant. Heuristiques de départ, non validées scientifiquement. */
export interface Thresholds {
  /** Part minimale des éléments jouée pour qu'une session compte. */
  minPlayedShare: number;
  /** Nombre de sessions récentes examinées (jamais moins). */
  windowSessions: number;
  /** « À alléger » quand R1 est strictement sous ce seuil dans toute la fenêtre. */
  allegerR1: number;
  /** « À relever » quand R1 ≥ r1, I ≤ i et E ≤ e dans toute la fenêtre. */
  relever: { r1: number; i: number; e: number };
  /** Élément « à signaler » à partir de ce taux d'échec au 1er essai. */
  elementFlag: number;
  /** Élément « prioritaire » à partir de ce taux. */
  elementPriority: number;
  /** Nombre d'élèves minimal pour afficher une confusion. */
  confusionMin: number;
  /** Nombre d'élèves minimal pour qualifier un élément. */
  minStudents: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  minPlayedShare: 0.5,
  windowSessions: 2,
  allegerR1: 0.5,
  relever: { r1: 0.9, i: 0.1, e: 1.1 },
  elementFlag: 0.4,
  elementPriority: 0.6,
  confusionMin: 3,
  minStudents: 5,
};

export interface SessionResults {
  sessionId: string;
  /** Code élève anonyme. */
  studentCode: string;
  profile: ProfileId;
  /** Nombre d'éléments que comptait le tour. */
  totalElements: number;
  /** Date ISO de fin ; sert à ordonner les sessions. */
  endedAt: string;
  results: ElementResult[];
}

export interface SessionSignals {
  /** Part des éléments réussis au 1er essai. */
  r1: number;
  /** Nombre moyen d'essais par élément. */
  e: number;
  /** Part des éléments pour lesquels un indice a été utilisé. */
  i: number;
}

export function sessionSignals(results: readonly ElementResult[]): SessionSignals {
  const n = results.length;
  if (n === 0) return { r1: 0, e: 0, i: 0 };
  return {
    r1: results.filter((r) => r.firstTry).length / n,
    e: results.reduce((sum, r) => sum + r.tries, 0) / n,
    i: results.filter((r) => r.hintUsed).length / n,
  };
}

export type LevelLabel = 'alleger' | 'adapte' | 'relever';

export interface LevelSuggestion {
  /** null tant que le nombre de sessions comptées est insuffisant. */
  label: LevelLabel | null;
  /** Nombre de sessions comptées (au moins minPlayedShare joué). */
  counted: number;
  /** Signaux de chaque session de la fenêtre, de la plus récente à la plus ancienne. */
  signals: SessionSignals[];
  /** Faux quand le profil actuel ne permet pas le changement suggéré (Soutien à alléger, Défi à relever). */
  applicable: boolean;
}

const byEndedDesc = (a: SessionResults, b: SessionResults) => (a.endedAt < b.endedAt ? 1 : a.endedAt > b.endedAt ? -1 : 0);

/** Suggestion pour UN élève sur UNE activité. L'enseignant décide : aucun changement automatique. */
export function suggestLevel(sessions: readonly SessionResults[], th: Thresholds = DEFAULT_THRESHOLDS): LevelSuggestion {
  const counted = sessions
    .filter((s) => s.totalElements > 0 && s.results.length / s.totalElements >= th.minPlayedShare)
    .sort(byEndedDesc);
  const window = counted.slice(0, th.windowSessions);
  const signals = window.map((s) => sessionSignals(s.results));
  if (window.length < th.windowSessions) {
    return { label: null, counted: counted.length, signals, applicable: false };
  }

  let label: LevelLabel = 'adapte';
  if (signals.every((s) => s.r1 < th.allegerR1)) {
    label = 'alleger';
  } else if (signals.every((s) => s.r1 >= th.relever.r1 && s.i <= th.relever.i && s.e <= th.relever.e)) {
    label = 'relever';
  }

  const profile = window[0].profile;
  const applicable = label === 'alleger' ? profile !== 'soutien' : label === 'relever' ? profile !== 'defi' : true;
  return { label, counted: counted.length, signals, applicable };
}

export type ElementFlag = 'ok' | 'signaler' | 'prioritaire' | 'peu-de-donnees';

export interface ElementStat {
  elementId: string;
  students: number;
  failedFirstTry: number;
  /** Taux d'échec au 1er essai. */
  rate: number;
  flag: ElementFlag;
  /** Mauvais choix produits par au moins `confusionMin` élèves (vide sous `minStudents`). */
  confusions: { optionId: string; count: number }[];
}

/** Vue « quoi réenseigner » : non nominative, résultat le plus récent de chaque élève par élément. */
export function elementStats(sessions: readonly SessionResults[], th: Thresholds = DEFAULT_THRESHOLDS): ElementStat[] {
  const oldestFirst = [...sessions].sort((a, b) => -byEndedDesc(a, b));
  const latest = new Map<string, Map<string, ElementResult>>();
  for (const s of oldestFirst) {
    for (const r of s.results) {
      let byStudent = latest.get(r.elementId);
      if (!byStudent) {
        byStudent = new Map();
        latest.set(r.elementId, byStudent);
      }
      byStudent.set(s.studentCode, r);
    }
  }

  const stats: ElementStat[] = [];
  for (const [elementId, byStudent] of latest) {
    const students = byStudent.size;
    const failedFirstTry = [...byStudent.values()].filter((r) => !r.firstTry).length;
    const rate = failedFirstTry / students;
    const flag: ElementFlag =
      students < th.minStudents
        ? 'peu-de-donnees'
        : rate >= th.elementPriority
          ? 'prioritaire'
          : rate >= th.elementFlag
            ? 'signaler'
            : 'ok';

    const counts = new Map<string, number>();
    for (const r of byStudent.values()) {
      for (const optionId of new Set(r.wrongChoices)) counts.set(optionId, (counts.get(optionId) ?? 0) + 1);
    }
    const confusions =
      flag === 'peu-de-donnees'
        ? []
        : [...counts]
            .filter(([, count]) => count >= th.confusionMin)
            .map(([optionId, count]) => ({ optionId, count }))
            .sort((a, b) => b.count - a.count);

    stats.push({ elementId, students, failedFirstTry, rate, flag, confusions });
  }
  return stats.sort((a, b) => b.rate - a.rate || a.elementId.localeCompare(b.elementId));
}

/** Libellés d'indicateurs déclarés au hub : doivent correspondre exactement (accents compris). */
export const HUB_INDICATOR_LABELS = { reussis: 'éléments réussis', repris: 'éléments repris' } as const;

export function summarizeSession(results: readonly ElementResult[]): { reussis: number; repris: number } {
  return {
    reussis: results.filter((r) => !r.revealed).length,
    repris: results.filter((r) => r.tries > 1 || r.revealed).length,
  };
}
