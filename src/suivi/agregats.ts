import { sessionSignals } from '../engine/signals.js';
import type { MechanicId } from '../engine/types.js';
import type { SessionEnregistree } from './types.js';

/** Résultat vu par l'enseignant hors écran (jeu physique, oral) et saisi à la main. */
export interface ResultatManuel {
  studentCode: string;
  cible: string;
  resultat: 'reussi' | 'partiel' | 'a_reprendre';
  /** Date ISO. */
  date: string;
}

/** Seuils des états de la couche A. Valeurs de départ proposées par Claude, non validées scientifiquement. */
export interface SeuilsEtats {
  /** Réussite au premier essai à partir de laquelle une séance compte comme réussie. */
  reussite: number;
  /** Jeux différents réussis pour « stabilisé ». */
  jeuxDifferents: number;
  /** Jours différents pour « stabilisé ». */
  jours: number;
  /** Jeux différents où la même confusion apparaît pour « à reprendre ». */
  erreurRepetee: number;
}

export const SEUILS_ETATS_DEFAUT: SeuilsEtats = { reussite: 0.75, jeuxDifferents: 3, jours: 2, erreurRepetee: 2 };

export type Etat = 'stabilise' | 'en-cours' | 'a-reprendre' | 'pas-d-indice';
export type Jeu = MechanicId | 'physique';

const jourDe = (iso: string) => iso.slice(0, 10);
const r1De = (s: SessionEnregistree) => sessionSignals(s.results).r1;
const pourCible = (s: SessionEnregistree, cible?: string) => cible === undefined || s.cibles.includes(cible);
const moyenne = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Codes qui ont joué (ou dont l'enseignant a saisi un résultat) et codes qui n'ont rien joué, dans l'ordre de la liste. */
export function participation(
  codes: string[],
  sessions: SessionEnregistree[],
  manuels: ResultatManuel[],
  cible?: string,
): { joues: string[]; absents: string[] } {
  const vus = new Set<string>();
  for (const s of sessions) if (pourCible(s, cible)) vus.add(s.studentCode);
  for (const m of manuels) if (cible === undefined || m.cible === cible) vus.add(m.studentCode);
  return { joues: codes.filter((c) => vus.has(c)), absents: codes.filter((c) => !vus.has(c)) };
}

export interface ErreurType {
  juste: string;
  choisi: string;
  eleves: string[];
  mecaniques: MechanicId[];
}

/** Confusions (bonne réponse et mauvais choix) regroupées, la plus répandue d'abord. */
export function erreursParType(sessions: SessionEnregistree[], cible?: string): ErreurType[] {
  const groupes = new Map<string, ErreurType>();
  for (const s of sessions) {
    // Un tour joué au niveau au-dessus n'est pas une erreur au niveau de l'élève : exclu.
    if (!pourCible(s, cible) || s.above) continue;
    for (const r of s.results) {
      for (const w of r.wrongChoices) {
        const cle = `${r.correct}\u0000${w}`;
        let g = groupes.get(cle);
        if (!g) {
          g = { juste: s.labels[r.correct] ?? r.correct, choisi: s.labels[w] ?? w, eleves: [], mecaniques: [] };
          groupes.set(cle, g);
        }
        if (!g.eleves.includes(s.studentCode)) g.eleves.push(s.studentCode);
        if (!g.mecaniques.includes(s.mechanic)) g.mecaniques.push(s.mechanic);
      }
    }
  }
  return [...groupes.values()]
    .map((g) => ({ ...g, eleves: [...g.eleves].sort() }))
    .sort((a, b) => b.eleves.length - a.eleves.length || a.juste.localeCompare(b.juste) || a.choisi.localeCompare(b.choisi));
}

export interface LigneJeu {
  jeu: Jeu;
  joueurs: number;
  /**
   * Moyenne, sur les séances, de la part des éléments réussis au 1er essai ; null pour les saisies de l'enseignant.
   * Les tours joués au niveau au-dessus sont exclus (sauf si le jeu n'a été joué qu'ainsi) : ils ne font pas baisser la moyenne.
   */
  r1Moyen: number | null;
  derniere: string;
  /** Nombre de séances jouées au niveau au-dessus du profil attribué. */
  dontAuDessus: number;
}

/** Pour un attendu : ce qui a été joué, jeu par jeu, plus les résultats saisis par l'enseignant. Du plus ancien au plus récent. */
export function jeuxParCible(sessions: SessionEnregistree[], manuels: ResultatManuel[], cible: string): LigneJeu[] {
  const lignes: LigneJeu[] = [];
  const parJeu = new Map<MechanicId, SessionEnregistree[]>();
  for (const s of sessions) {
    if (!s.cibles.includes(cible)) continue;
    parJeu.set(s.mechanic, [...(parJeu.get(s.mechanic) ?? []), s]);
  }
  for (const [jeu, ss] of parJeu) {
    const aNiveau = ss.filter((s) => !s.above);
    lignes.push({
      jeu,
      joueurs: new Set(ss.map((s) => s.studentCode)).size,
      r1Moyen: moyenne((aNiveau.length > 0 ? aNiveau : ss).map(r1De)),
      derniere: ss.map((s) => s.endedAt).sort().at(-1) as string,
      dontAuDessus: ss.length - aNiveau.length,
    });
  }
  const ms = manuels.filter((m) => m.cible === cible);
  if (ms.length > 0) {
    lignes.push({ jeu: 'physique', joueurs: new Set(ms.map((m) => m.studentCode)).size, r1Moyen: null, derniere: ms.map((m) => m.date).sort().at(-1) as string, dontAuDessus: 0 });
  }
  return lignes.sort((a, b) => a.derniere.localeCompare(b.derniere));
}

/**
 * Indice d'acquisition d'un élève pour un attendu. Ce n'est pas une preuve : voir le bandeau du tableau de bord.
 * « à reprendre » l'emporte sur « stabilisé » : une confusion répétée mérite l'attention même si le reste réussit.
 */
export function etatEleve(
  code: string,
  cible: string,
  sessions: SessionEnregistree[],
  manuels: ResultatManuel[],
  seuils: SeuilsEtats = SEUILS_ETATS_DEFAUT,
): Etat {
  const ss = sessions.filter((s) => s.studentCode === code && s.cibles.includes(cible));
  const ms = manuels.filter((m) => m.studentCode === code && m.cible === cible);
  if (ss.length === 0 && ms.length === 0) return 'pas-d-indice';

  const derniereSaisie = [...ms].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  if (derniereSaisie?.resultat === 'a_reprendre') return 'a-reprendre';

  const mecaniquesParConfusion = new Map<string, Set<MechanicId>>();
  for (const s of ss) {
    if (s.above) continue; // une erreur au niveau au-dessus n'est jamais comptée contre l'élève
    for (const r of s.results) {
      for (const w of r.wrongChoices) {
        const cle = `${r.correct}\u0000${w}`;
        const ensemble = mecaniquesParConfusion.get(cle) ?? new Set<MechanicId>();
        ensemble.add(s.mechanic);
        mecaniquesParConfusion.set(cle, ensemble);
      }
    }
  }
  if ([...mecaniquesParConfusion.values()].some((m) => m.size >= seuils.erreurRepetee)) return 'a-reprendre';

  const jeux = new Set<Jeu>();
  const jours = new Set<string>();
  for (const s of ss) {
    if (r1De(s) >= seuils.reussite) {
      jeux.add(s.mechanic);
      jours.add(jourDe(s.endedAt));
    }
  }
  for (const m of ms) {
    if (m.resultat === 'reussi') {
      jeux.add('physique');
      jours.add(jourDe(m.date));
    }
  }
  return jeux.size >= seuils.jeuxDifferents && jours.size >= seuils.jours ? 'stabilise' : 'en-cours';
}

export interface PointEvolution {
  jour: string;
  r1: number;
}

/** Réussite au premier essai par jour (moyenne des séances du jour). null sous trois jours distincts : pas de tendance. */
export function evolution(sessions: SessionEnregistree[], cible: string, code?: string): PointEvolution[] | null {
  const parJour = new Map<string, number[]>();
  for (const s of sessions) {
    // Les tours au niveau au-dessus n'ont pas la même difficulté : ils ne tirent pas la courbe vers le bas.
    if (!s.cibles.includes(cible) || s.above || (code !== undefined && s.studentCode !== code)) continue;
    const j = jourDe(s.endedAt);
    parJour.set(j, [...(parJour.get(j) ?? []), r1De(s)]);
  }
  if (parJour.size < 3) return null;
  return [...parJour.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([jour, xs]) => ({ jour, r1: moyenne(xs) }));
}

export interface Fait {
  date: string;
  jeu: Jeu;
  r1: number | null;
  erreurs: string[];
  origine: 'ecran' | 'enseignant';
  /** Résultat saisi par l'enseignant, pour les lignes « enseignant ». */
  note?: 'reussi' | 'partiel' | 'a_reprendre';
  /** Tour joué au niveau au-dessus du profil attribué. */
  auDessus: boolean;
}

/** Tout ce qui est connu d'un code, sans étiquette d'état : à interpréter par l'enseignant. */
export function faitsParEleve(code: string, sessions: SessionEnregistree[], manuels: ResultatManuel[]): Fait[] {
  const faits: Fait[] = [];
  for (const s of sessions) {
    if (s.studentCode !== code) continue;
    const erreurs: string[] = [];
    for (const r of s.results) for (const w of r.wrongChoices) erreurs.push(`${s.labels[w] ?? w} au lieu de ${s.labels[r.correct] ?? r.correct}`);
    faits.push({ date: s.endedAt, jeu: s.mechanic, r1: r1De(s), erreurs, origine: 'ecran', auDessus: s.above });
  }
  for (const m of manuels) {
    if (m.studentCode !== code) continue;
    faits.push({ date: m.date, jeu: 'physique', r1: null, erreurs: [], origine: 'enseignant', note: m.resultat, auDessus: false });
  }
  return faits.sort((a, b) => a.date.localeCompare(b.date));
}
