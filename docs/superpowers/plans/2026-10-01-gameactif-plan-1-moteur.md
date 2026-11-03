# GameActif, plan 1 : moteur pur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le moteur pur de GameActif (modèle d'activité, validation, trois mécaniques Associer, Trier, Remettre en ordre, profils Soutien/Standard/Défi, signaux du tableau de bord), sans interface ni base de données, entièrement testé.

**Architecture:** Un seul moteur de « choix » générique (`round.ts`) : chaque mécanique est un tour où l'élève choisit, pour chaque élément, la bonne option parmi des options (associer : l'élément de droite ; trier : la catégorie ; ordre : la position). Les trois mécaniques ne sont que des fonctions de mise en place (`associer.ts`, `trier.ts`, `ordre.ts`) qui fabriquent un tour à partir d'une activité et d'un profil. Tout est fonction pure (état, action) vers (nouvel état, retour), avec un générateur aléatoire à graine pour des tests déterministes. Les signaux du tableau de bord (`signals.ts`) sont aussi purs : ils lisent des résultats d'éléments et appliquent des seuils réglables.

**Tech Stack:** TypeScript 5 strict, Vitest 2, Node 24 (module ESM, imports relatifs avec extension `.js`). Aucune dépendance d'exécution.

**Spec :** `gameactif/docs/superpowers/specs/2026-10-01-gameactif-design.md` (sections 5, 6, 7 pour la validation, 8 pour les seuils).

## Découpage en plans (feuille de route)

La spec couvre plusieurs sous-systèmes ; chaque plan livre un logiciel testable seul.

1. **Plan 1 (ce document) :** moteur pur (aucune UI, aucune base).
2. **Plan 2 :** application Vite/React/Tailwind, branding PLAI, rendu élève des trois mécaniques (thèmes, mascotte, mode calme, glisser-déposer + toucher + clavier, lecture à voix haute, carte de progression), sur données locales.
3. **Plan 3 :** création (thème, texte collé, .docx dans le navigateur, `api/generate` Haiku en JSON strict, zone éditable, validation carte par carte, avertissement noms d'élèves).
4. **Plan 4 :** Supabase (`game_activities`, `game_items`, `game_sessions`, `game_attempts`, RLS, GRANT) et pont HubActif (jeton, élève par code, événements, bouton « Assigner via HubActif »).
5. **Plan 5 :** tableau de bord enseignant (vues « quoi réenseigner » et « quel niveau ajuster », seuils réglables).

Ces plans se rédigent l'un après l'autre, après exécution du précédent, parce que leurs interfaces dépendent du code réel livré.

## Décision de modélisation à connaître

`ElementResult` (défini en tâche 3) est émis **une fois par élément résolu** dans une session. C'est la ligne qui sera stockée dans `game_attempts` au plan 4 (une ligne par élément résolu : réussite au 1er essai, nombre d'essais, indice utilisé, choix erronés). La spec section 8 dit « une ligne par action » : on retient « une ligne par élément résolu », seule lecture cohérente avec les champs agrégés listés.

## Structure des fichiers

```
gameactif/
  package.json
  tsconfig.json
  vitest.config.ts
  .gitignore
  src/engine/
    types.ts          types du modèle d'activité
    rng.ts            générateur à graine, mélange, mélange sans point fixe
    profiles.ts       paramètres des trois profils
    select.ts         choix des éléments selon le profil, évitement des alignements
    round.ts          moteur de choix générique (createRound, step, progress)
    availability.ts   relations valides, mécaniques disponibles
    validation.ts     validateActivity, canPublish, editStats
    associer.ts       setupAssocier
    trier.ts          setupTrier
    ordre.ts          setupOrdre
    setup.ts          setupRound (aiguillage par mécanique)
    signals.ts        seuils, signaux de session, suggestion de niveau, statistiques par élément, indicateurs hub
    index.ts          réexports
  tests/
    fixtures.ts       activité d'exemple FWB (cycle et états de l'eau), solveAll
    rng.test.ts
    select.test.ts
    round.test.ts
    availability.test.ts
    validation.test.ts
    associer.test.ts
    trier.test.ts
    ordre.test.ts
    setup.test.ts
    signals.test.ts
```

---

### Task 0: Dépôt et squelette du projet

**Files:**
- Create: `gameactif/package.json`, `gameactif/tsconfig.json`, `gameactif/vitest.config.ts`, `gameactif/.gitignore`

- [ ] **Step 1: Initialiser git et lier le dépôt GitHub**

Run (dans `C:\Users\jfbeg\OneDrive\claude-workspace\gameactif`) :

```bash
git init -b main
git remote add origin https://github.com/jfb4plai/GameActif.git
git fetch origin
git log origin/main --oneline 2>&1 | head -5
```

Expected : soit une erreur « unknown revision » (dépôt vide : continuer), soit des commits existants. Dans ce second cas, lancer `git merge origin/main --allow-unrelated-histories` avant la suite et résoudre un éventuel conflit sur `README.md` en gardant les deux contenus.

- [ ] **Step 2: Créer `package.json`**

```json
{
  "name": "gameactif",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "description": "GameActif : activités interactives différenciées, moteur pur",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^20.14.10",
    "typescript": "^5.5.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 3: Créer `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tests", "vitest.config.ts"]
}
```

- [ ] **Step 4: Créer `vitest.config.ts` et `.gitignore`**

`vitest.config.ts` :

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
```

`.gitignore` :

```
node_modules
dist
.env
.env.*
!.env.example
```

- [ ] **Step 5: Installer et vérifier l'outil**

Run : `npm install && npx vitest --version`
Expected : une version `2.x` s'affiche, sans erreur.

- [ ] **Step 6: Commit (squelette + spec + plan)**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore docs
git commit -m "chore: squelette du projet, spec et plan 1" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Types du modèle et générateur aléatoire

**Files:**
- Create: `src/engine/types.ts`, `src/engine/rng.ts`
- Test: `tests/rng.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

`tests/rng.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { makeRng, shuffle, shuffleNoFixedPoint } from '../src/engine/rng.js';

describe('makeRng', () => {
  it('est déterministe pour une même graine', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('reste dans [0, 1[', () => {
    const r = makeRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('donne des suites différentes pour des graines différentes', () => {
    expect(makeRng(1)()).not.toBe(makeRng(2)());
  });
});

describe('shuffle', () => {
  it('renvoie une permutation sans modifier l’entrée', () => {
    const input = ['a', 'b', 'c', 'd', 'e'];
    const out = shuffle(input, makeRng(3));
    expect([...out].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(input).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('shuffleNoFixedPoint', () => {
  it('ne laisse aucun élément à sa position d’origine (n de 2 à 8, 100 graines)', () => {
    for (let n = 2; n <= 8; n++) {
      const arr = Array.from({ length: n }, (_, i) => `x${i}`);
      for (let seed = 0; seed < 100; seed++) {
        const out = shuffleNoFixedPoint(arr, makeRng(seed));
        expect([...out].sort()).toEqual([...arr].sort());
        expect(out.every((v, i) => v !== arr[i])).toBe(true);
      }
    }
  });

  it('gère les tableaux de 0 ou 1 élément', () => {
    expect(shuffleNoFixedPoint([], makeRng(1))).toEqual([]);
    expect(shuffleNoFixedPoint(['a'], makeRng(1))).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run : `npx vitest run tests/rng.test.ts`
Expected : FAIL, module `../src/engine/rng.js` introuvable.

- [ ] **Step 3: Écrire les types**

`src/engine/types.ts` :

```ts
export type Difficulty = 'facile' | 'moyen' | 'difficile';
export type ProfileId = 'soutien' | 'standard' | 'defi';
export type MechanicId = 'associer' | 'trier' | 'ordre';

export interface Item {
  id: string;
  text: string;
  imageUrl?: string;
  difficulty: Difficulty;
  /** Validé explicitement par l'enseignant (split 80/20). */
  validated: boolean;
  origin: 'ia' | 'manuel';
  /** Retouché par l'enseignant depuis la proposition de l'IA. */
  modified: boolean;
}

export interface Category {
  id: string;
  label: string;
}

/** Appariement élément ↔ élément (mécanique Associer). */
export interface Pair {
  leftId: string;
  rightId: string;
}

/** Appartenance élément → catégorie (mécanique Trier). */
export interface Membership {
  itemId: string;
  categoryId: string;
}

/** Rang élément → position, de 1 à n (mécanique Remettre en ordre). */
export interface Rank {
  itemId: string;
  position: number;
}

export interface Activity {
  id: string;
  title: string;
  discipline: string;
  year: string;
  /** Contexte de classe : obligatoire pour publier. */
  context: string;
  items: Item[];
  categories: Category[];
  pairs: Pair[];
  memberships: Membership[];
  ranks: Rank[];
}
```

- [ ] **Step 4: Écrire le générateur**

`src/engine/rng.ts` :

```ts
export type Rng = () => number;

/** Générateur mulberry32 : déterministe pour une graine donnée, valeurs dans [0, 1[. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mélange de Fisher-Yates ; ne modifie pas l'entrée. */
export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Mélange sans point fixe : aucun élément ne reste à sa position d'origine (si n >= 2).
 * Sert à casser l'ordre d'écriture de l'enseignant, qui peut trahir la réponse.
 * Les éléments doivent être distincts entre eux.
 */
export function shuffleNoFixedPoint<T>(arr: readonly T[], rng: Rng): T[] {
  if (arr.length < 2) return arr.slice();
  for (let attempt = 0; attempt < 50; attempt++) {
    const out = shuffle(arr, rng);
    if (out.every((v, i) => v !== arr[i])) return out;
  }
  // Repli : rotation d'un cran, sans point fixe quand les éléments sont distincts.
  return arr.slice(1).concat(arr[0]);
}
```

- [ ] **Step 5: Lancer les tests et le typage**

Run : `npx vitest run tests/rng.test.ts && npm run typecheck`
Expected : tous les tests passent, `tsc` sans erreur.

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/rng.ts tests/rng.test.ts
git commit -m "feat(engine): types du modèle et générateur à graine" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Profils et sélection selon le profil

**Files:**
- Create: `src/engine/profiles.ts`, `src/engine/select.ts`
- Test: `tests/select.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

`tests/select.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { PROFILES } from '../src/engine/profiles.js';
import { orderByProfile, arrangeAgainst } from '../src/engine/select.js';
import { makeRng } from '../src/engine/rng.js';
import type { Difficulty } from '../src/engine/types.js';

interface E {
  id: string;
  d: Difficulty;
}
const entries: E[] = [
  { id: '1', d: 'difficile' },
  { id: '2', d: 'facile' },
  { id: '3', d: 'moyen' },
  { id: '4', d: 'facile' },
];

describe('PROFILES', () => {
  it('Soutien est le plus aidé, Défi limite les essais et supprime les indices', () => {
    expect(PROFILES.soutien.hintsPerRound).toBeGreaterThan(PROFILES.standard.hintsPerRound);
    expect(PROFILES.standard.hintsPerRound).toBeGreaterThan(PROFILES.defi.hintsPerRound);
    expect(PROFILES.soutien.maxItems).toBeLessThan(PROFILES.defi.maxItems);
    expect(PROFILES.soutien.maxTries).toBeNull();
    expect(PROFILES.defi.maxTries).toBe(3);
    expect(PROFILES.soutien.readAloud).toBe(true);
  });
});

describe('orderByProfile', () => {
  it('Soutien place les éléments faciles en premier', () => {
    const out = orderByProfile(entries, (e) => e.d, 'soutien', makeRng(1));
    expect(out.map((e) => e.d)).toEqual(['facile', 'facile', 'moyen', 'difficile']);
  });

  it('Défi place les éléments difficiles en premier', () => {
    const out = orderByProfile(entries, (e) => e.d, 'defi', makeRng(1));
    expect(out.map((e) => e.d)).toEqual(['difficile', 'moyen', 'facile', 'facile']);
  });

  it('Standard garde tous les éléments (permutation)', () => {
    const out = orderByProfile(entries, (e) => e.d, 'standard', makeRng(1));
    expect(out.map((e) => e.id).sort()).toEqual(['1', '2', '3', '4']);
  });
});

describe('arrangeAgainst', () => {
  it('ne place jamais une option en face de son élément (100 graines)', () => {
    const anchors = ['a1', 'a2', 'a3', 'a4'];
    const correctOf = new Map([
      ['a1', 'b1'],
      ['a2', 'b2'],
      ['a3', 'b3'],
      ['a4', 'b4'],
    ]);
    for (let seed = 0; seed < 100; seed++) {
      const out = arrangeAgainst(['b1', 'b2', 'b3', 'b4'], anchors, correctOf, makeRng(seed));
      expect([...out].sort()).toEqual(['b1', 'b2', 'b3', 'b4']);
      anchors.forEach((a, i) => expect(out[i]).not.toBe(correctOf.get(a)));
    }
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run : `npx vitest run tests/select.test.ts`
Expected : FAIL, modules introuvables.

- [ ] **Step 3: Écrire les profils**

`src/engine/profiles.ts` :

```ts
import type { ProfileId } from './types.js';

export interface ProfileParams {
  /** Nombre maximal d'éléments joués dans un tour. */
  maxItems: number;
  /** Options sans partenaire ajoutées en Associer. */
  distractors: number;
  /** Nombre maximal de catégories affichées en Trier. */
  maxCategories: number;
  /** Indices disponibles par tour (un indice écarte une mauvaise option). */
  hintsPerRound: number;
  /** Essais ratés avant révélation de la bonne réponse ; null = illimité. */
  maxTries: number | null;
  readAloud: boolean;
  visualAids: boolean;
}

/** Valeurs par défaut, à ajuster après les premiers usages réels. */
export const PROFILES: Record<ProfileId, ProfileParams> = {
  soutien: {
    maxItems: 4,
    distractors: 0,
    maxCategories: 2,
    hintsPerRound: 8,
    maxTries: null,
    readAloud: true,
    visualAids: true,
  },
  standard: {
    maxItems: 6,
    distractors: 0,
    maxCategories: 3,
    hintsPerRound: 3,
    maxTries: null,
    readAloud: false,
    visualAids: false,
  },
  defi: {
    maxItems: 8,
    distractors: 2,
    maxCategories: 4,
    hintsPerRound: 0,
    maxTries: 3,
    readAloud: false,
    visualAids: false,
  },
};

export const PROFILE_LABELS: Record<ProfileId, string> = {
  soutien: 'Soutien',
  standard: 'Standard',
  defi: 'Défi',
};
```

- [ ] **Step 4: Écrire la sélection**

`src/engine/select.ts` :

```ts
import type { Difficulty, ProfileId } from './types.js';
import { shuffle, type Rng } from './rng.js';

const RANK_SOUTIEN: Record<Difficulty, number> = { facile: 0, moyen: 1, difficile: 2 };
const RANK_DEFI: Record<Difficulty, number> = { difficile: 0, moyen: 1, facile: 2 };

/**
 * Ordonne des entrées selon la préférence du profil : faciles d'abord en Soutien,
 * difficiles d'abord en Défi, ordre aléatoire en Standard. À difficulté égale,
 * l'ordre est aléatoire (mélange préalable puis tri stable).
 */
export function orderByProfile<T>(
  entries: readonly T[],
  difficultyOf: (entry: T) => Difficulty,
  profile: ProfileId,
  rng: Rng,
): T[] {
  const mixed = shuffle(entries, rng);
  if (profile === 'standard') return mixed;
  const rank = profile === 'soutien' ? RANK_SOUTIEN : RANK_DEFI;
  return mixed.sort((a, b) => rank[difficultyOf(a)] - rank[difficultyOf(b)]);
}

/**
 * Mélange des options en évitant qu'une option se retrouve à la même position
 * que l'élément auquel elle répond (indice de surface par alignement).
 */
export function arrangeAgainst(
  options: readonly string[],
  anchors: readonly string[],
  correctOf: ReadonlyMap<string, string>,
  rng: Rng,
): string[] {
  const aligned = (arr: readonly string[]) =>
    anchors.some((anchor, i) => i < arr.length && arr[i] === correctOf.get(anchor));
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = shuffle(options, rng);
    if (!aligned(candidate)) return candidate;
  }
  // Repli : rotations successives d'un mélange jusqu'à trouver un arrangement sans alignement.
  let rotated = shuffle(options, rng);
  for (let k = 0; k < rotated.length; k++) {
    if (!aligned(rotated)) return rotated;
    rotated = rotated.slice(1).concat(rotated[0]);
  }
  return rotated;
}
```

- [ ] **Step 5: Lancer les tests et le typage**

Run : `npx vitest run tests/select.test.ts && npm run typecheck`
Expected : tous les tests passent, `tsc` sans erreur.

- [ ] **Step 6: Commit**

```bash
git add src/engine/profiles.ts src/engine/select.ts tests/select.test.ts
git commit -m "feat(engine): profils Soutien/Standard/Défi et sélection par profil" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Moteur de choix générique

**Files:**
- Create: `src/engine/round.ts`
- Test: `tests/round.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

`tests/round.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { createRound, step, progress, type RoundSpec, type RoundState } from '../src/engine/round.js';

function spec(over: Partial<RoundSpec> = {}): RoundSpec {
  return {
    mechanic: 'trier',
    exclusive: false,
    elements: [
      { id: 'e1', correct: 'A' },
      { id: 'e2', correct: 'B' },
    ],
    options: ['A', 'B', 'C'],
    labels: {},
    hintsLeft: 2,
    maxTries: null,
    ...over,
  };
}

const el = (s: RoundState, id: string) => s.elements.find((e) => e.id === id)!;

describe('choix correct', () => {
  it('résout l’élément au premier essai', () => {
    const r = step(createRound(spec()), { type: 'choose', elementId: 'e1', optionId: 'A' });
    expect(r.feedback.kind).toBe('correct');
    expect(el(r.state, 'e1').resolvedWith).toBe('A');
    expect(r.state.results).toEqual([
      { elementId: 'e1', mechanic: 'trier', firstTry: true, tries: 1, hintUsed: false, revealed: false, wrongChoices: [] },
    ]);
    expect(r.state.done).toBe(false);
    expect(progress(r.state)).toEqual({ resolved: 1, total: 2 });
  });

  it('termine le tour quand tous les éléments sont résolus', () => {
    let s = createRound(spec());
    s = step(s, { type: 'choose', elementId: 'e1', optionId: 'A' }).state;
    s = step(s, { type: 'choose', elementId: 'e2', optionId: 'B' }).state;
    expect(s.done).toBe(true);
    expect(progress(s)).toEqual({ resolved: 2, total: 2 });
  });
});

describe('choix erroné', () => {
  it('invite à réessayer sans résoudre, puis compte 2 essais', () => {
    let r = step(createRound(spec()), { type: 'choose', elementId: 'e1', optionId: 'C' });
    expect(r.feedback.kind).toBe('retry');
    expect(r.feedback.message).toBe('Pas tout à fait. Essaie encore.');
    expect(r.state.results).toEqual([]);
    expect(el(r.state, 'e1').wrong).toEqual(['C']);
    expect(el(r.state, 'e1').eliminated).toEqual(['C']);
    r = step(r.state, { type: 'choose', elementId: 'e1', optionId: 'A' });
    expect(r.state.results[0]).toMatchObject({ firstTry: false, tries: 2, wrongChoices: ['C'], revealed: false });
  });

  it('ignore le choix d’une option déjà écartée', () => {
    const first = step(createRound(spec()), { type: 'choose', elementId: 'e1', optionId: 'C' });
    const again = step(first.state, { type: 'choose', elementId: 'e1', optionId: 'C' });
    expect(again.feedback.kind).toBe('ignored');
    expect(again.state).toBe(first.state);
  });

  it('révèle la bonne réponse après maxTries erreurs', () => {
    let r = step(createRound(spec({ maxTries: 2 })), { type: 'choose', elementId: 'e1', optionId: 'C' });
    expect(r.feedback.kind).toBe('retry');
    r = step(r.state, { type: 'choose', elementId: 'e1', optionId: 'B' });
    expect(r.feedback.kind).toBe('reveal');
    expect(el(r.state, 'e1').resolvedWith).toBe('A');
    expect(r.state.results[0]).toMatchObject({
      firstTry: false,
      tries: 2,
      revealed: true,
      wrongChoices: ['C', 'B'],
    });
  });
});

describe('options exclusives (associer, ordre)', () => {
  it('une option déjà prise par un autre élément est ignorée', () => {
    let s = createRound(spec({ exclusive: true }));
    s = step(s, { type: 'choose', elementId: 'e1', optionId: 'A' }).state;
    const r = step(s, { type: 'choose', elementId: 'e2', optionId: 'A' });
    expect(r.feedback.kind).toBe('ignored');
    expect(r.state).toBe(s);
  });

  it('non exclusif : deux éléments peuvent partager la même option', () => {
    let s = createRound(spec({ elements: [{ id: 'e1', correct: 'A' }, { id: 'e2', correct: 'A' }] }));
    s = step(s, { type: 'choose', elementId: 'e1', optionId: 'A' }).state;
    const r = step(s, { type: 'choose', elementId: 'e2', optionId: 'A' });
    expect(r.feedback.kind).toBe('correct');
    expect(r.state.done).toBe(true);
  });
});

describe('indices', () => {
  it('écarte la première mauvaise option et consomme un indice', () => {
    const r = step(createRound(spec()), { type: 'hint', elementId: 'e1' });
    expect(r.feedback.kind).toBe('hint');
    expect(el(r.state, 'e1').eliminated).toEqual(['B']);
    expect(el(r.state, 'e1').hintUsed).toBe(true);
    expect(r.state.hintsLeft).toBe(1);
    const blocked = step(r.state, { type: 'choose', elementId: 'e1', optionId: 'B' });
    expect(blocked.feedback.kind).toBe('ignored');
    const solved = step(r.state, { type: 'choose', elementId: 'e1', optionId: 'A' });
    expect(solved.state.results[0]).toMatchObject({ firstTry: true, tries: 1, hintUsed: true });
  });

  it('ne propose pas d’indice quand il n’en reste plus', () => {
    const s = createRound(spec({ hintsLeft: 0 }));
    const r = step(s, { type: 'hint', elementId: 'e1' });
    expect(r.feedback.kind).toBe('no-hint');
    expect(r.state).toBe(s);
  });

  it('ne propose pas d’indice quand toutes les mauvaises options sont déjà écartées', () => {
    const s = createRound(spec({ options: ['A'] }));
    expect(step(s, { type: 'hint', elementId: 'e1' }).feedback.kind).toBe('no-hint');
  });

  it('en mode exclusif, n’écarte pas une option déjà prise par un autre élément', () => {
    let s = createRound(spec({ exclusive: true }));
    s = step(s, { type: 'choose', elementId: 'e1', optionId: 'A' }).state;
    const r = step(s, { type: 'hint', elementId: 'e2' });
    expect(el(r.state, 'e2').eliminated).toEqual(['C']);
  });
});

describe('actions invalides', () => {
  it('ignore un élément inconnu ou déjà résolu', () => {
    const s = createRound(spec());
    expect(step(s, { type: 'choose', elementId: 'zz', optionId: 'A' }).feedback.kind).toBe('ignored');
    const solved = step(s, { type: 'choose', elementId: 'e1', optionId: 'A' }).state;
    expect(step(solved, { type: 'choose', elementId: 'e1', optionId: 'B' }).feedback.kind).toBe('ignored');
  });

  it('ignore une option qui n’existe pas dans le tour', () => {
    const s = createRound(spec());
    expect(step(s, { type: 'choose', elementId: 'e1', optionId: 'Z' }).feedback.kind).toBe('ignored');
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run : `npx vitest run tests/round.test.ts`
Expected : FAIL, module `../src/engine/round.js` introuvable.

- [ ] **Step 3: Écrire le moteur**

`src/engine/round.ts` :

```ts
import type { MechanicId } from './types.js';

export interface ElementState {
  id: string;
  /** Identifiant de la bonne option. */
  correct: string;
  /** Option avec laquelle l'élément est résolu ; null tant qu'il ne l'est pas. */
  resolvedWith: string | null;
  /** Mauvais choix faits, dans l'ordre. */
  wrong: string[];
  /** Options grisées pour cet élément (mauvais choix et indices). */
  eliminated: string[];
  hintUsed: boolean;
  revealed: boolean;
}

/** Résultat d'un élément résolu : une ligne de `game_attempts` au plan 4. */
export interface ElementResult {
  elementId: string;
  mechanic: MechanicId;
  /** Résolu sans aucune erreur ni révélation. */
  firstTry: boolean;
  /** Nombre de choix faits, bonne réponse incluse (révélation : nombre d'erreurs). */
  tries: number;
  hintUsed: boolean;
  revealed: boolean;
  wrongChoices: string[];
}

export interface RoundState {
  mechanic: MechanicId;
  /** Une option résolue ne peut plus être choisie par un autre élément. */
  exclusive: boolean;
  /** Éléments dans l'ordre d'affichage. */
  elements: ElementState[];
  /** Options dans l'ordre d'affichage. */
  options: string[];
  /** Libellé affichable de chaque identifiant d'élément et d'option. */
  labels: Record<string, string>;
  hintsLeft: number;
  maxTries: number | null;
  results: ElementResult[];
  done: boolean;
}

export interface RoundSpec {
  mechanic: MechanicId;
  exclusive: boolean;
  elements: { id: string; correct: string }[];
  options: string[];
  labels: Record<string, string>;
  hintsLeft: number;
  maxTries: number | null;
}

export type Action =
  | { type: 'choose'; elementId: string; optionId: string }
  | { type: 'hint'; elementId: string };

export type FeedbackKind = 'correct' | 'retry' | 'reveal' | 'hint' | 'no-hint' | 'ignored';

export interface Feedback {
  kind: FeedbackKind;
  message: string;
}

export interface StepResult {
  state: RoundState;
  feedback: Feedback;
}

const FEEDBACK: Record<FeedbackKind, Feedback> = {
  correct: { kind: 'correct', message: 'Bien vu.' },
  retry: { kind: 'retry', message: 'Pas tout à fait. Essaie encore.' },
  reveal: { kind: 'reveal', message: 'Voici la bonne réponse. On continue.' },
  hint: { kind: 'hint', message: 'Une proposition a été écartée.' },
  'no-hint': { kind: 'no-hint', message: 'Plus d’indice utile pour celui-ci.' },
  ignored: { kind: 'ignored', message: '' },
};

export function createRound(spec: RoundSpec): RoundState {
  return {
    mechanic: spec.mechanic,
    exclusive: spec.exclusive,
    elements: spec.elements.map((e) => ({
      id: e.id,
      correct: e.correct,
      resolvedWith: null,
      wrong: [],
      eliminated: [],
      hintUsed: false,
      revealed: false,
    })),
    options: spec.options.slice(),
    labels: { ...spec.labels },
    hintsLeft: spec.hintsLeft,
    maxTries: spec.maxTries,
    results: [],
    done: false,
  };
}

export function progress(state: RoundState): { resolved: number; total: number } {
  return {
    resolved: state.elements.filter((e) => e.resolvedWith !== null).length,
    total: state.elements.length,
  };
}

function consumedOptions(state: RoundState): Set<string> {
  const out = new Set<string>();
  if (!state.exclusive) return out;
  for (const e of state.elements) if (e.resolvedWith !== null) out.add(e.resolvedWith);
  return out;
}

function withElement(state: RoundState, index: number, element: ElementState): RoundState {
  return { ...state, elements: state.elements.map((e, i) => (i === index ? element : e)) };
}

function resolve(state: RoundState, index: number, element: ElementState, revealed: boolean): StepResult {
  const resolved: ElementState = { ...element, resolvedWith: element.correct, revealed };
  const result: ElementResult = {
    elementId: element.id,
    mechanic: state.mechanic,
    firstTry: !revealed && element.wrong.length === 0,
    tries: element.wrong.length + (revealed ? 0 : 1),
    hintUsed: element.hintUsed,
    revealed,
    wrongChoices: element.wrong.slice(),
  };
  const next = withElement(state, index, resolved);
  return {
    state: { ...next, results: [...state.results, result], done: next.elements.every((e) => e.resolvedWith !== null) },
    feedback: revealed ? FEEDBACK.reveal : FEEDBACK.correct,
  };
}

function choose(state: RoundState, index: number, optionId: string): StepResult {
  const element = state.elements[index];
  if (
    !state.options.includes(optionId) ||
    element.eliminated.includes(optionId) ||
    consumedOptions(state).has(optionId)
  ) {
    return { state, feedback: FEEDBACK.ignored };
  }
  if (optionId === element.correct) return resolve(state, index, element, false);

  const failed: ElementState = {
    ...element,
    wrong: [...element.wrong, optionId],
    eliminated: [...element.eliminated, optionId],
  };
  if (state.maxTries !== null && failed.wrong.length >= state.maxTries) {
    return resolve(state, index, failed, true);
  }
  return { state: withElement(state, index, failed), feedback: FEEDBACK.retry };
}

function useHint(state: RoundState, index: number): StepResult {
  const element = state.elements[index];
  const consumed = consumedOptions(state);
  const candidate = state.options.find(
    (o) => o !== element.correct && !element.eliminated.includes(o) && !consumed.has(o),
  );
  if (state.hintsLeft <= 0 || candidate === undefined) {
    return { state, feedback: FEEDBACK['no-hint'] };
  }
  const hinted: ElementState = {
    ...element,
    eliminated: [...element.eliminated, candidate],
    hintUsed: true,
  };
  return {
    state: { ...withElement(state, index, hinted), hintsLeft: state.hintsLeft - 1 },
    feedback: FEEDBACK.hint,
  };
}

export function step(state: RoundState, action: Action): StepResult {
  const index = state.elements.findIndex((e) => e.id === action.elementId);
  if (index < 0 || state.done || state.elements[index].resolvedWith !== null) {
    return { state, feedback: FEEDBACK.ignored };
  }
  return action.type === 'hint' ? useHint(state, index) : choose(state, index, action.optionId);
}
```

- [ ] **Step 4: Lancer les tests et le typage**

Run : `npx vitest run tests/round.test.ts && npm run typecheck`
Expected : tous les tests passent, `tsc` sans erreur.

- [ ] **Step 5: Commit**

```bash
git add src/engine/round.ts tests/round.test.ts
git commit -m "feat(engine): moteur de choix générique (essais, indices, révélation)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Disponibilité des mécaniques et validation de l'activité

**Files:**
- Create: `tests/fixtures.ts`, `src/engine/availability.ts`, `src/engine/validation.ts`
- Test: `tests/availability.test.ts`, `tests/validation.test.ts`

- [ ] **Step 1: Écrire les fixtures partagées**

`tests/fixtures.ts` :

```ts
import type { Activity, Difficulty, Item } from '../src/engine/types.js';
import { step, type RoundState } from '../src/engine/round.js';

function item(id: string, text: string, difficulty: Difficulty = 'moyen'): Item {
  return { id, text, difficulty, validated: true, origin: 'manuel', modified: false };
}

/** Activité d'exemple FWB (sciences, cycle et états de l'eau) avec les trois types de relations. */
export function eauActivity(): Activity {
  return {
    id: 'act-eau',
    title: 'L’eau dans la nature',
    discipline: 'Sciences',
    year: '2e primaire',
    context: 'Classe de 12 élèves, vocabulaire très simple, beaucoup de lecture à voix haute.',
    items: [
      item('a1', 'évaporation', 'facile'),
      item('b1', 'passage du liquide au gaz'),
      item('a2', 'condensation'),
      item('b2', 'passage du gaz au liquide'),
      item('a3', 'solidification', 'difficile'),
      item('b3', 'passage du liquide au solide'),
      item('a4', 'fusion'),
      item('b4', 'passage du solide au liquide'),
      item('t1', 'glace', 'facile'),
      item('t2', 'neige', 'facile'),
      item('t3', 'grêle', 'difficile'),
      item('t4', 'pluie', 'facile'),
      item('t5', 'rivière'),
      item('t6', 'rosée'),
      item('t7', 'vapeur d’eau'),
      item('o1', 'L’eau des océans chauffe'),
      item('o2', 'L’eau s’évapore'),
      item('o3', 'La vapeur forme des nuages'),
      item('o4', 'La pluie tombe'),
      item('o5', 'L’eau s’infiltre dans le sol'),
    ],
    categories: [
      { id: 'c1', label: 'Eau solide' },
      { id: 'c2', label: 'Eau liquide' },
      { id: 'c3', label: 'Eau gazeuse' },
    ],
    pairs: [
      { leftId: 'a1', rightId: 'b1' },
      { leftId: 'a2', rightId: 'b2' },
      { leftId: 'a3', rightId: 'b3' },
      { leftId: 'a4', rightId: 'b4' },
    ],
    memberships: [
      { itemId: 't1', categoryId: 'c1' },
      { itemId: 't2', categoryId: 'c1' },
      { itemId: 't3', categoryId: 'c1' },
      { itemId: 't4', categoryId: 'c2' },
      { itemId: 't5', categoryId: 'c2' },
      { itemId: 't6', categoryId: 'c2' },
      { itemId: 't7', categoryId: 'c3' },
    ],
    ranks: [
      { itemId: 'o1', position: 1 },
      { itemId: 'o2', position: 2 },
      { itemId: 'o3', position: 3 },
      { itemId: 'o4', position: 4 },
      { itemId: 'o5', position: 5 },
    ],
  };
}

/** Joue un tour en choisissant la bonne option pour chaque élément. */
export function solveAll(state: RoundState): RoundState {
  let s = state;
  for (const el of state.elements) {
    s = step(s, { type: 'choose', elementId: el.id, optionId: el.correct }).state;
  }
  return s;
}
```

- [ ] **Step 2: Écrire les tests qui échouent**

`tests/availability.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { availableMechanics, validPairs, validMemberships, rankedItemIds } from '../src/engine/availability.js';
import { eauActivity } from './fixtures.js';

describe('availableMechanics', () => {
  it('les trois mécaniques sont disponibles pour l’activité complète', () => {
    const m = availableMechanics(eauActivity());
    expect(m.associer).toEqual({ available: true, missing: null });
    expect(m.trier).toEqual({ available: true, missing: null });
    expect(m.ordre).toEqual({ available: true, missing: null });
  });

  it('Associer demande au moins 2 paires', () => {
    const a = eauActivity();
    a.pairs = [{ leftId: 'a1', rightId: 'b1' }];
    expect(availableMechanics(a).associer).toEqual({ available: false, missing: 'Il faut au moins 2 paires.' });
  });

  it('Trier demande 2 catégories remplies et 3 éléments classés', () => {
    const a = eauActivity();
    a.memberships = a.memberships.filter((m) => m.categoryId === 'c1');
    expect(availableMechanics(a).trier).toEqual({
      available: false,
      missing: 'Il faut au moins 2 catégories contenant chacune un élément.',
    });
    const b = eauActivity();
    b.memberships = [
      { itemId: 't1', categoryId: 'c1' },
      { itemId: 't4', categoryId: 'c2' },
    ];
    expect(availableMechanics(b).trier).toEqual({
      available: false,
      missing: 'Il faut au moins 3 éléments classés.',
    });
  });

  it('Ordre demande 3 éléments avec des positions 1, 2, 3…', () => {
    const a = eauActivity();
    a.ranks = [
      { itemId: 'o1', position: 1 },
      { itemId: 'o2', position: 2 },
      { itemId: 'o4', position: 4 },
    ];
    expect(availableMechanics(a).ordre).toEqual({
      available: false,
      missing: 'Il faut au moins 3 éléments avec des positions 1, 2, 3…',
    });
  });
});

describe('relations valides', () => {
  it('ignore les paires dont un élément est inconnu ou identique', () => {
    const a = eauActivity();
    a.pairs.push({ leftId: 'zz', rightId: 'b1' }, { leftId: 'a1', rightId: 'a1' });
    expect(validPairs(a)).toHaveLength(4);
  });

  it('un élément classé deux fois garde sa première catégorie', () => {
    const a = eauActivity();
    a.memberships.push({ itemId: 't1', categoryId: 'c2' });
    const m = validMemberships(a).filter((x) => x.itemId === 't1');
    expect(m).toEqual([{ itemId: 't1', categoryId: 'c1' }]);
  });

  it('rankedItemIds renvoie les éléments dans l’ordre des positions', () => {
    const a = eauActivity();
    a.ranks = [...a.ranks].reverse();
    expect(rankedItemIds(a)).toEqual(['o1', 'o2', 'o3', 'o4', 'o5']);
  });
});
```

`tests/validation.test.ts` :

```ts
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
```

- [ ] **Step 3: Lancer les tests pour vérifier l'échec**

Run : `npx vitest run tests/availability.test.ts tests/validation.test.ts`
Expected : FAIL, modules introuvables.

- [ ] **Step 4: Écrire `availability.ts`**

`src/engine/availability.ts` :

```ts
import type { Activity, MechanicId, Membership, Pair } from './types.js';

export interface MechanicAvailability {
  available: boolean;
  /** Message affichable à l'enseignant quand la mécanique n'est pas disponible. */
  missing: string | null;
}

/** Paires dont les deux éléments existent et sont distincts. */
export function validPairs(activity: Activity): Pair[] {
  const ids = new Set(activity.items.map((i) => i.id));
  return activity.pairs.filter((p) => ids.has(p.leftId) && ids.has(p.rightId) && p.leftId !== p.rightId);
}

/** Classements valides ; un élément classé deux fois garde sa première catégorie. */
export function validMemberships(activity: Activity): Membership[] {
  const items = new Set(activity.items.map((i) => i.id));
  const cats = new Set(activity.categories.map((c) => c.id));
  const seen = new Set<string>();
  const out: Membership[] = [];
  for (const m of activity.memberships) {
    if (!items.has(m.itemId) || !cats.has(m.categoryId) || seen.has(m.itemId)) continue;
    seen.add(m.itemId);
    out.push(m);
  }
  return out;
}

/** Éléments ordonnés par position, ou null si les positions ne forment pas 1..n (n >= 3). */
export function rankedItemIds(activity: Activity): string[] | null {
  const items = new Set(activity.items.map((i) => i.id));
  const ranks = activity.ranks.filter((r) => items.has(r.itemId)).sort((a, b) => a.position - b.position);
  if (ranks.length < 3) return null;
  for (let i = 0; i < ranks.length; i++) {
    if (ranks[i].position !== i + 1) return null;
  }
  const ids = ranks.map((r) => r.itemId);
  return new Set(ids).size === ids.length ? ids : null;
}

export function availableMechanics(activity: Activity): Record<MechanicId, MechanicAvailability> {
  const memberships = validMemberships(activity);
  const filledCategories = new Set(memberships.map((m) => m.categoryId));

  let trier: MechanicAvailability = { available: true, missing: null };
  if (filledCategories.size < 2) {
    trier = { available: false, missing: 'Il faut au moins 2 catégories contenant chacune un élément.' };
  } else if (memberships.length < 3) {
    trier = { available: false, missing: 'Il faut au moins 3 éléments classés.' };
  }

  return {
    associer:
      validPairs(activity).length >= 2
        ? { available: true, missing: null }
        : { available: false, missing: 'Il faut au moins 2 paires.' },
    trier,
    ordre:
      rankedItemIds(activity) !== null
        ? { available: true, missing: null }
        : { available: false, missing: 'Il faut au moins 3 éléments avec des positions 1, 2, 3…' },
  };
}
```

- [ ] **Step 5: Écrire `validation.ts`**

`src/engine/validation.ts` :

```ts
import type { Activity, Item } from './types.js';
import { availableMechanics } from './availability.js';

/** Problèmes de structure (références cassées, doublons). Liste vide = structure saine. */
export function validateActivity(activity: Activity): string[] {
  const issues: string[] = [];

  const seen = new Set<string>();
  for (const id of [...activity.items.map((i) => i.id), ...activity.categories.map((c) => c.id)]) {
    if (seen.has(id)) issues.push(`Identifiant en double : ${id}`);
    seen.add(id);
  }

  const itemIds = new Set(activity.items.map((i) => i.id));
  const catIds = new Set(activity.categories.map((c) => c.id));

  for (const p of activity.pairs) {
    if (!itemIds.has(p.leftId) || !itemIds.has(p.rightId)) {
      issues.push(`Paire avec un élément inconnu : ${p.leftId} / ${p.rightId}`);
    } else if (p.leftId === p.rightId) {
      issues.push(`Paire d’un élément avec lui-même : ${p.leftId}`);
    }
  }

  const classed = new Set<string>();
  for (const m of activity.memberships) {
    if (!itemIds.has(m.itemId)) issues.push(`Classement d’un élément inconnu : ${m.itemId}`);
    else if (!catIds.has(m.categoryId)) issues.push(`Catégorie inconnue : ${m.categoryId}`);
    else if (classed.has(m.itemId)) issues.push(`Élément classé dans deux catégories : ${m.itemId}`);
    else classed.add(m.itemId);
  }

  const ranked = new Set<string>();
  const positions = new Set<number>();
  for (const r of activity.ranks) {
    if (!itemIds.has(r.itemId)) issues.push(`Rang d’un élément inconnu : ${r.itemId}`);
    else if (ranked.has(r.itemId)) issues.push(`Élément classé deux fois dans l’ordre : ${r.itemId}`);
    else ranked.add(r.itemId);
    if (positions.has(r.position)) issues.push(`Position en double : ${r.position}`);
    positions.add(r.position);
  }

  return issues;
}

/** Règles de publication du split 80/20 : contexte, validation de chaque élément, structure saine. */
export function canPublish(activity: Activity): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (activity.context.trim() === '') reasons.push('Le contexte de classe est obligatoire.');
  const pending = activity.items.filter((i) => !i.validated).length;
  if (pending > 0) reasons.push(`${pending} élément(s) pas encore validé(s).`);
  reasons.push(...validateActivity(activity));
  if (!Object.values(availableMechanics(activity)).some((m) => m.available)) {
    reasons.push('Aucune mécanique disponible : complétez au moins une relation.');
  }
  return { ok: reasons.length === 0, reasons };
}

/** Miroir pour l'enseignant : parmi les éléments proposés par l'IA, combien ont été retouchés. */
export function editStats(items: readonly Item[]): { total: number; modified: number; unchanged: number } {
  const proposed = items.filter((i) => i.origin === 'ia');
  const modified = proposed.filter((i) => i.modified).length;
  return { total: proposed.length, modified, unchanged: proposed.length - modified };
}
```

- [ ] **Step 6: Lancer les tests et le typage**

Run : `npx vitest run tests/availability.test.ts tests/validation.test.ts && npm run typecheck`
Expected : tous les tests passent, `tsc` sans erreur.

- [ ] **Step 7: Commit**

```bash
git add tests/fixtures.ts src/engine/availability.ts src/engine/validation.ts tests/availability.test.ts tests/validation.test.ts
git commit -m "feat(engine): disponibilité des mécaniques et règles de publication 80/20" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Mise en place de la mécanique Associer

**Files:**
- Create: `src/engine/associer.ts`
- Test: `tests/associer.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

`tests/associer.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { setupAssocier } from '../src/engine/associer.js';
import { makeRng } from '../src/engine/rng.js';
import { eauActivity, solveAll } from './fixtures.js';

describe('setupAssocier', () => {
  it('prépare un tour exclusif avec une option par élément et des libellés', () => {
    const s = setupAssocier(eauActivity(), 'standard', makeRng(1));
    expect(s.mechanic).toBe('associer');
    expect(s.exclusive).toBe(true);
    expect(s.elements).toHaveLength(4);
    expect(s.options).toHaveLength(4);
    expect(s.labels.a1).toBe('évaporation');
    expect(s.labels.b1).toBe('passage du liquide au gaz');
    const rightOf: Record<string, string> = { a1: 'b1', a2: 'b2', a3: 'b3', a4: 'b4' };
    for (const e of s.elements) expect(e.correct).toBe(rightOf[e.id]);
  });

  it('casse l’ordre d’écriture et l’alignement avec les options (50 graines)', () => {
    const authoring = ['a1', 'a2', 'a3', 'a4'];
    for (let seed = 0; seed < 50; seed++) {
      const s = setupAssocier(eauActivity(), 'standard', makeRng(seed));
      expect(s.elements.map((e) => e.id)).not.toEqual(authoring);
      s.elements.forEach((e, i) => expect(s.options[i]).not.toBe(e.correct));
    }
  });

  it('Défi ajoute des distracteurs et limite les essais sans indice', () => {
    const s = setupAssocier(eauActivity(), 'defi', makeRng(2), { maxItems: 3, distractors: 1 });
    expect(s.elements).toHaveLength(3);
    expect(s.options).toHaveLength(4);
    const distractors = s.options.filter((o) => !s.elements.some((e) => e.correct === o));
    expect(distractors).toHaveLength(1);
    expect(s.maxTries).toBe(3);
    expect(s.hintsLeft).toBe(0);
  });

  it('Soutien retient les paires faciles, Défi les difficiles (20 graines)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const soutien = setupAssocier(eauActivity(), 'soutien', makeRng(seed), { maxItems: 2 }).elements.map((e) => e.id);
      expect(soutien).toContain('a1');
      expect(soutien).not.toContain('a3');
      const defi = setupAssocier(eauActivity(), 'defi', makeRng(seed), { maxItems: 2, distractors: 0 }).elements.map((e) => e.id);
      expect(defi).toContain('a3');
      expect(defi).not.toContain('a1');
    }
  });

  it('se termine quand tout est bien associé', () => {
    const s = solveAll(setupAssocier(eauActivity(), 'standard', makeRng(5)));
    expect(s.done).toBe(true);
    expect(s.results).toHaveLength(4);
    expect(s.results.every((r) => r.firstTry)).toBe(true);
  });

  it('refuse de se préparer sans 2 paires', () => {
    const a = eauActivity();
    a.pairs = [{ leftId: 'a1', rightId: 'b1' }];
    expect(() => setupAssocier(a, 'standard', makeRng(1))).toThrow('Associer indisponible');
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run : `npx vitest run tests/associer.test.ts`
Expected : FAIL, module `../src/engine/associer.js` introuvable.

- [ ] **Step 3: Écrire `associer.ts`**

`src/engine/associer.ts` :

```ts
import type { Activity, ProfileId } from './types.js';
import { PROFILES, type ProfileParams } from './profiles.js';
import { createRound, type RoundState } from './round.js';
import { arrangeAgainst, orderByProfile } from './select.js';
import { shuffleNoFixedPoint, type Rng } from './rng.js';
import { validPairs } from './availability.js';

/**
 * Associer : pour chaque élément de gauche, choisir son partenaire parmi les options de droite.
 * Les paires non retenues par le profil servent de distracteurs (leur partenaire de droite reste sans correspondant).
 */
export function setupAssocier(
  activity: Activity,
  profile: ProfileId,
  rng: Rng,
  overrides: Partial<ProfileParams> = {},
): RoundState {
  const params = { ...PROFILES[profile], ...overrides };
  const pairs = validPairs(activity);
  if (pairs.length < 2) throw new Error('Associer indisponible : il faut au moins 2 paires.');

  const difficulty = new Map(activity.items.map((i) => [i.id, i.difficulty] as const));
  const ordered = orderByProfile(pairs, (p) => difficulty.get(p.leftId) ?? 'moyen', profile, rng);
  const active = ordered.slice(0, params.maxItems);
  const distractors = ordered.slice(params.maxItems, params.maxItems + params.distractors);

  const activeSet = new Set(active);
  const authoringLefts = pairs.filter((p) => activeSet.has(p)).map((p) => p.leftId);
  const lefts = shuffleNoFixedPoint(authoringLefts, rng);

  const correctOf = new Map(active.map((p) => [p.leftId, p.rightId] as const));
  const rights = arrangeAgainst([...active, ...distractors].map((p) => p.rightId), lefts, correctOf, rng);

  const labels: Record<string, string> = {};
  for (const item of activity.items) labels[item.id] = item.text;

  return createRound({
    mechanic: 'associer',
    exclusive: true,
    elements: lefts.map((id) => ({ id, correct: correctOf.get(id) as string })),
    options: rights,
    labels,
    hintsLeft: params.hintsPerRound,
    maxTries: params.maxTries,
  });
}
```

- [ ] **Step 4: Lancer les tests et le typage**

Run : `npx vitest run tests/associer.test.ts && npm run typecheck`
Expected : tous les tests passent, `tsc` sans erreur.

- [ ] **Step 5: Commit**

```bash
git add src/engine/associer.ts tests/associer.test.ts
git commit -m "feat(engine): mécanique Associer (profils, distracteurs, anti-alignement)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Mise en place de la mécanique Trier

**Files:**
- Create: `src/engine/trier.ts`
- Test: `tests/trier.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

`tests/trier.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { setupTrier } from '../src/engine/trier.js';
import { makeRng } from '../src/engine/rng.js';
import { eauActivity, solveAll } from './fixtures.js';

const categoryOf: Record<string, string> = {
  t1: 'c1', t2: 'c1', t3: 'c1', t4: 'c2', t5: 'c2', t6: 'c2', t7: 'c3',
};

describe('setupTrier', () => {
  it('prépare un tour non exclusif où chaque élément connaît sa catégorie', () => {
    const s = setupTrier(eauActivity(), 'standard', makeRng(1));
    expect(s.mechanic).toBe('trier');
    expect(s.exclusive).toBe(false);
    expect(s.elements).toHaveLength(6);
    expect(s.options).toHaveLength(3);
    for (const e of s.elements) expect(e.correct).toBe(categoryOf[e.id]);
    expect(s.labels.c1).toBe('Eau solide');
    expect(s.labels.t1).toBe('glace');
  });

  it('Soutien : 2 catégories, 4 éléments, chaque catégorie reçoit au moins un élément (30 graines)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const s = setupTrier(eauActivity(), 'soutien', makeRng(seed));
      expect(s.elements).toHaveLength(4);
      expect(new Set(s.options)).toEqual(new Set(['c1', 'c2']));
      expect(new Set(s.elements.map((e) => e.correct))).toEqual(new Set(['c1', 'c2']));
    }
  });

  it('Défi : toutes les catégories et tous les éléments classés', () => {
    const s = setupTrier(eauActivity(), 'defi', makeRng(3));
    expect(s.elements).toHaveLength(7);
    expect(s.options).toHaveLength(3);
    expect(s.maxTries).toBe(3);
  });

  it('casse l’ordre d’écriture, qui regroupe les éléments par catégorie (50 graines)', () => {
    const activity = eauActivity();
    for (let seed = 0; seed < 50; seed++) {
      const s = setupTrier(activity, 'standard', makeRng(seed));
      const ids = s.elements.map((e) => e.id);
      const authoring = activity.items.map((i) => i.id).filter((id) => ids.includes(id));
      expect(ids).not.toEqual(authoring);
      ids.forEach((id, i) => expect(id).not.toBe(authoring[i]));
    }
  });

  it('se termine quand tout est bien classé', () => {
    const s = solveAll(setupTrier(eauActivity(), 'standard', makeRng(5)));
    expect(s.done).toBe(true);
    expect(s.results.every((r) => r.firstTry)).toBe(true);
  });

  it('refuse de se préparer avec une seule catégorie utilisable', () => {
    const a = eauActivity();
    a.memberships = a.memberships.filter((m) => m.categoryId === 'c1');
    expect(() => setupTrier(a, 'standard', makeRng(1))).toThrow('Trier indisponible');
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run : `npx vitest run tests/trier.test.ts`
Expected : FAIL, module `../src/engine/trier.js` introuvable.

- [ ] **Step 3: Écrire `trier.ts`**

`src/engine/trier.ts` :

```ts
import type { Activity, ProfileId } from './types.js';
import { PROFILES, type ProfileParams } from './profiles.js';
import { createRound, type RoundState } from './round.js';
import { orderByProfile } from './select.js';
import { shuffle, shuffleNoFixedPoint, type Rng } from './rng.js';
import { validMemberships } from './availability.js';

/**
 * Trier : pour chaque élément, choisir sa catégorie.
 * Le profil limite le nombre de catégories et d'éléments ; la sélection se fait en tourniquet
 * entre catégories pour que chacune reçoive au moins un élément.
 */
export function setupTrier(
  activity: Activity,
  profile: ProfileId,
  rng: Rng,
  overrides: Partial<ProfileParams> = {},
): RoundState {
  const params = { ...PROFILES[profile], ...overrides };
  const difficulty = new Map(activity.items.map((i) => [i.id, i.difficulty] as const));

  const byCategory = new Map<string, string[]>();
  for (const m of validMemberships(activity)) {
    const list = byCategory.get(m.categoryId) ?? [];
    list.push(m.itemId);
    byCategory.set(m.categoryId, list);
  }

  const shown = activity.categories.filter((c) => byCategory.has(c.id)).slice(0, params.maxCategories);
  if (shown.length < 2) throw new Error('Trier indisponible : il faut au moins 2 catégories contenant un élément.');

  const groups = shown.map((c) => ({
    categoryId: c.id,
    ids: orderByProfile(byCategory.get(c.id) as string[], (id) => difficulty.get(id) ?? 'moyen', profile, rng),
  }));

  const picked = new Map<string, string>();
  for (let round = 0; picked.size < params.maxItems; round++) {
    let added = false;
    for (const g of groups) {
      if (picked.size >= params.maxItems) break;
      const id = g.ids[round];
      if (id !== undefined) {
        picked.set(id, g.categoryId);
        added = true;
      }
    }
    if (!added) break;
  }

  const usedCategories = shown.filter((c) => [...picked.values()].includes(c.id));
  if (usedCategories.length < 2) throw new Error('Trier indisponible : il faut au moins 2 catégories contenant un élément.');

  const authoring = activity.items.map((i) => i.id).filter((id) => picked.has(id));
  const elements = shuffleNoFixedPoint(authoring, rng);

  const labels: Record<string, string> = {};
  for (const item of activity.items) labels[item.id] = item.text;
  for (const c of activity.categories) labels[c.id] = c.label;

  return createRound({
    mechanic: 'trier',
    exclusive: false,
    elements: elements.map((id) => ({ id, correct: picked.get(id) as string })),
    options: shuffle(usedCategories.map((c) => c.id), rng),
    labels,
    hintsLeft: params.hintsPerRound,
    maxTries: params.maxTries,
  });
}
```

- [ ] **Step 4: Lancer les tests et le typage**

Run : `npx vitest run tests/trier.test.ts && npm run typecheck`
Expected : tous les tests passent, `tsc` sans erreur.

- [ ] **Step 5: Commit**

```bash
git add src/engine/trier.ts tests/trier.test.ts
git commit -m "feat(engine): mécanique Trier (catégories limitées par profil, tourniquet)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Mécanique Remettre en ordre et aiguillage

**Files:**
- Create: `src/engine/ordre.ts`, `src/engine/setup.ts`, `src/engine/index.ts`
- Test: `tests/ordre.test.ts`, `tests/setup.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

`tests/ordre.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { setupOrdre } from '../src/engine/ordre.js';
import { makeRng } from '../src/engine/rng.js';
import { eauActivity, solveAll } from './fixtures.js';

describe('setupOrdre', () => {
  it('prépare un tour exclusif où chaque étape a sa position', () => {
    const s = setupOrdre(eauActivity(), 'standard', makeRng(1));
    expect(s.mechanic).toBe('ordre');
    expect(s.exclusive).toBe(true);
    expect(s.elements).toHaveLength(5);
    expect(s.options).toEqual(['pos-1', 'pos-2', 'pos-3', 'pos-4', 'pos-5']);
    expect(s.elements.find((e) => e.id === 'o3')?.correct).toBe('pos-3');
    expect(s.labels['pos-3']).toBe('3');
    expect(s.labels.o3).toBe('La vapeur forme des nuages');
  });

  it('casse l’ordre d’écriture : les étapes ne sont jamais affichées dans le bon ordre (50 graines)', () => {
    const authoring = ['o1', 'o2', 'o3', 'o4', 'o5'];
    for (let seed = 0; seed < 50; seed++) {
      const ids = setupOrdre(eauActivity(), 'standard', makeRng(seed)).elements.map((e) => e.id);
      expect(ids).not.toEqual(authoring);
      ids.forEach((id, i) => expect(id).not.toBe(authoring[i]));
    }
  });

  it('Soutien : fenêtre de 4 étapes consécutives, positions renumérotées de 1 à 4 (30 graines)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const s = setupOrdre(eauActivity(), 'soutien', makeRng(seed));
      expect(s.elements).toHaveLength(4);
      expect(s.options).toEqual(['pos-1', 'pos-2', 'pos-3', 'pos-4']);
      const numbers = s.elements.map((e) => Number(e.id.slice(1))).sort((a, b) => a - b);
      numbers.forEach((n, i) => {
        if (i > 0) expect(n).toBe(numbers[i - 1] + 1);
      });
      const first = s.elements.find((e) => Number(e.id.slice(1)) === numbers[0]);
      expect(first?.correct).toBe('pos-1');
    }
  });

  it('se termine quand tout est bien rangé', () => {
    const s = solveAll(setupOrdre(eauActivity(), 'standard', makeRng(5)));
    expect(s.done).toBe(true);
    expect(s.results.every((r) => r.firstTry)).toBe(true);
  });

  it('refuse de se préparer quand les positions ne forment pas 1, 2, 3…', () => {
    const a = eauActivity();
    a.ranks = [
      { itemId: 'o1', position: 1 },
      { itemId: 'o2', position: 2 },
      { itemId: 'o4', position: 4 },
    ];
    expect(() => setupOrdre(a, 'standard', makeRng(1))).toThrow('Ordre indisponible');
  });
});
```

`tests/setup.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { setupRound } from '../src/engine/setup.js';
import { makeRng } from '../src/engine/rng.js';
import { eauActivity } from './fixtures.js';

describe('setupRound', () => {
  it('aiguille vers la bonne mécanique', () => {
    const a = eauActivity();
    expect(setupRound(a, 'associer', 'standard', makeRng(1)).mechanic).toBe('associer');
    expect(setupRound(a, 'trier', 'standard', makeRng(1)).mechanic).toBe('trier');
    expect(setupRound(a, 'ordre', 'standard', makeRng(1)).mechanic).toBe('ordre');
  });

  it('est déterministe pour une même graine', () => {
    const a = eauActivity();
    expect(setupRound(a, 'trier', 'standard', makeRng(9))).toEqual(setupRound(a, 'trier', 'standard', makeRng(9)));
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run : `npx vitest run tests/ordre.test.ts tests/setup.test.ts`
Expected : FAIL, modules introuvables.

- [ ] **Step 3: Écrire `ordre.ts`**

`src/engine/ordre.ts` :

```ts
import type { Activity, ProfileId } from './types.js';
import { PROFILES, type ProfileParams } from './profiles.js';
import { createRound, type RoundState } from './round.js';
import { shuffleNoFixedPoint, type Rng } from './rng.js';
import { rankedItemIds } from './availability.js';

/**
 * Remettre en ordre : placer chaque étape dans sa position (cases numérotées).
 * Le profil limite la longueur : on joue une fenêtre d'étapes consécutives, renumérotée à partir de 1.
 * Les identifiants de position sont préfixés (`pos-1`…) pour ne jamais entrer en collision avec des identifiants d'éléments.
 */
export function setupOrdre(
  activity: Activity,
  profile: ProfileId,
  rng: Rng,
  overrides: Partial<ProfileParams> = {},
): RoundState {
  const params = { ...PROFILES[profile], ...overrides };
  const ids = rankedItemIds(activity);
  if (!ids) throw new Error('Ordre indisponible : il faut au moins 3 éléments avec des positions 1, 2, 3…');

  const size = Math.min(params.maxItems, ids.length);
  const start = Math.floor(rng() * (ids.length - size + 1));
  const windowIds = ids.slice(start, start + size);
  const positions = windowIds.map((_, k) => `pos-${k + 1}`);
  const correctOf = new Map(windowIds.map((id, k) => [id, positions[k]] as const));

  const labels: Record<string, string> = {};
  for (const item of activity.items) labels[item.id] = item.text;
  positions.forEach((p, k) => {
    labels[p] = String(k + 1);
  });

  return createRound({
    mechanic: 'ordre',
    exclusive: true,
    elements: shuffleNoFixedPoint(windowIds, rng).map((id) => ({ id, correct: correctOf.get(id) as string })),
    options: positions,
    labels,
    hintsLeft: params.hintsPerRound,
    maxTries: params.maxTries,
  });
}
```

- [ ] **Step 4: Écrire `setup.ts` et `index.ts`**

`src/engine/setup.ts` :

```ts
import type { Activity, MechanicId, ProfileId } from './types.js';
import type { ProfileParams } from './profiles.js';
import type { RoundState } from './round.js';
import type { Rng } from './rng.js';
import { setupAssocier } from './associer.js';
import { setupTrier } from './trier.js';
import { setupOrdre } from './ordre.js';

/** Prépare un tour pour la mécanique demandée. Vérifier `availableMechanics` avant : lève une erreur sinon. */
export function setupRound(
  activity: Activity,
  mechanic: MechanicId,
  profile: ProfileId,
  rng: Rng,
  overrides: Partial<ProfileParams> = {},
): RoundState {
  switch (mechanic) {
    case 'associer':
      return setupAssocier(activity, profile, rng, overrides);
    case 'trier':
      return setupTrier(activity, profile, rng, overrides);
    case 'ordre':
      return setupOrdre(activity, profile, rng, overrides);
  }
}
```

`src/engine/index.ts` :

```ts
export * from './types.js';
export * from './rng.js';
export * from './profiles.js';
export * from './round.js';
export * from './availability.js';
export * from './validation.js';
export * from './setup.js';
export * from './associer.js';
export * from './trier.js';
export * from './ordre.js';
```

(`signals.ts` est ajouté à l'index à la tâche 8.)

- [ ] **Step 5: Lancer les tests et le typage**

Run : `npx vitest run tests/ordre.test.ts tests/setup.test.ts && npm run typecheck`
Expected : tous les tests passent, `tsc` sans erreur.

- [ ] **Step 6: Commit**

```bash
git add src/engine/ordre.ts src/engine/setup.ts src/engine/index.ts tests/ordre.test.ts tests/setup.test.ts
git commit -m "feat(engine): mécanique Remettre en ordre et aiguillage par mécanique" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Signaux du tableau de bord et indicateurs du hub

**Files:**
- Create: `src/engine/signals.ts`
- Modify: `src/engine/index.ts` (ajouter l'export de `signals.js`)
- Test: `tests/signals.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

`tests/signals.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_THRESHOLDS,
  HUB_INDICATOR_LABELS,
  elementStats,
  sessionSignals,
  suggestLevel,
  summarizeSession,
  type SessionResults,
} from '../src/engine/signals.js';
import type { ElementResult } from '../src/engine/round.js';
import type { ProfileId } from '../src/engine/types.js';

function res(elementId: string, over: Partial<ElementResult> = {}): ElementResult {
  return {
    elementId,
    mechanic: 'trier',
    firstTry: true,
    tries: 1,
    hintUsed: false,
    revealed: false,
    wrongChoices: [],
    ...over,
  };
}

function sess(
  code: string,
  endedAt: string,
  results: ElementResult[],
  profile: ProfileId = 'standard',
  totalElements = results.length,
): SessionResults {
  return { sessionId: `${code}-${endedAt}`, studentCode: code, profile, totalElements, endedAt, results };
}

const good = (id: string) => res(id);
const bad = (id: string) => res(id, { firstTry: false, tries: 2, wrongChoices: ['X'] });

describe('sessionSignals', () => {
  it('calcule R1, E et I', () => {
    const s = sessionSignals([good('a'), bad('b'), res('c', { hintUsed: true, tries: 3, firstTry: false }), good('d')]);
    expect(s.r1).toBe(0.5);
    expect(s.e).toBe((1 + 2 + 3 + 1) / 4);
    expect(s.i).toBe(0.25);
  });

  it('renvoie des zéros pour une session vide', () => {
    expect(sessionSignals([])).toEqual({ r1: 0, e: 0, i: 0 });
  });
});

describe('suggestLevel', () => {
  const weak = (day: string) => sess('s1', day, [good('a'), bad('b'), bad('c'), bad('d')]);
  const strong = (day: string) => sess('s1', day, [good('a'), good('b'), good('c'), good('d')]);
  const middle = (day: string) => sess('s1', day, [good('a'), good('b'), good('c'), bad('d')]);

  it('ne propose rien avec moins de 2 sessions comptées', () => {
    const r = suggestLevel([weak('2026-10-01')]);
    expect(r.label).toBeNull();
    expect(r.counted).toBe(1);
  });

  it('propose d’alléger quand R1 est sous 50 % dans les 2 dernières sessions', () => {
    const r = suggestLevel([weak('2026-10-01'), weak('2026-10-02')]);
    expect(r.label).toBe('alleger');
    expect(r.applicable).toBe(true);
    expect(r.signals).toHaveLength(2);
  });

  it('propose de relever quand R1 ≥ 90 %, indices ≤ 10 % et essais ≤ 1,1', () => {
    const r = suggestLevel([strong('2026-10-01'), strong('2026-10-02')]);
    expect(r.label).toBe('relever');
    expect(r.applicable).toBe(true);
  });

  it('juge adapté dans les autres cas', () => {
    expect(suggestLevel([middle('2026-10-01'), middle('2026-10-02')]).label).toBe('adapte');
  });

  it('refuse de relever si un indice a été utilisé', () => {
    const withHint = sess('s1', '2026-10-02', [res('a', { hintUsed: true }), good('b'), good('c'), good('d')]);
    expect(suggestLevel([strong('2026-10-01'), withHint]).label).toBe('adapte');
  });

  it('ignore les sessions où moins de 50 % des éléments ont été joués', () => {
    const abandoned = sess('s1', '2026-10-03', [bad('a')], 'standard', 10);
    const r = suggestLevel([weak('2026-10-01'), abandoned]);
    expect(r.counted).toBe(1);
    expect(r.label).toBeNull();
  });

  it('ne retient que les 2 sessions les plus récentes', () => {
    const r = suggestLevel([weak('2026-09-28'), strong('2026-10-01'), strong('2026-10-02')]);
    expect(r.label).toBe('relever');
  });

  it('marque la suggestion non applicable aux profils extrêmes', () => {
    const soutienWeak = (day: string) => sess('s1', day, [good('a'), bad('b'), bad('c'), bad('d')], 'soutien');
    expect(suggestLevel([soutienWeak('2026-10-01'), soutienWeak('2026-10-02')]).applicable).toBe(false);
    const defiStrong = (day: string) => sess('s1', day, [good('a'), good('b'), good('c'), good('d')], 'defi');
    expect(suggestLevel([defiStrong('2026-10-01'), defiStrong('2026-10-02')]).applicable).toBe(false);
  });
});

describe('elementStats', () => {
  const students = (n: number) => Array.from({ length: n }, (_, i) => `s${i + 1}`);

  it('signale « peu de données » sous 5 élèves, sans libellé ni confusions', () => {
    const sessions = students(4).map((c) => sess(c, '2026-10-01', [bad('e1')]));
    const [stat] = elementStats(sessions);
    expect(stat.students).toBe(4);
    expect(stat.rate).toBe(1);
    expect(stat.flag).toBe('peu-de-donnees');
    expect(stat.confusions).toEqual([]);
  });

  it('classe prioritaire à partir de 60 % d’échecs, à signaler à partir de 40 %, sinon ok', () => {
    const make = (fails: number) =>
      students(5).map((c, i) => sess(c, '2026-10-01', [i < fails ? bad('e1') : good('e1')]));
    expect(elementStats(make(5))[0].flag).toBe('prioritaire');
    expect(elementStats(make(3))[0].flag).toBe('prioritaire');
    expect(elementStats(make(2))[0].flag).toBe('signaler');
    expect(elementStats(make(1))[0].flag).toBe('ok');
  });

  it('retient une confusion à partir de 3 élèves, une fois par élève', () => {
    const sessions = [
      ...students(3).map((c) => sess(c, '2026-10-01', [res('e1', { firstTry: false, tries: 3, wrongChoices: ['X', 'X'] })])),
      sess('s4', '2026-10-01', [res('e1', { firstTry: false, tries: 2, wrongChoices: ['Y'] })]),
      sess('s5', '2026-10-01', [good('e1')]),
    ];
    const [stat] = elementStats(sessions);
    expect(stat.confusions).toEqual([{ optionId: 'X', count: 3 }]);
  });

  it('ne garde que le résultat le plus récent de chaque élève', () => {
    const sessions = [
      ...students(5).map((c) => sess(c, '2026-10-01', [bad('e1')])),
      ...students(5).map((c) => sess(c, '2026-10-02', [good('e1')])),
    ];
    const [stat] = elementStats(sessions);
    expect(stat.students).toBe(5);
    expect(stat.rate).toBe(0);
    expect(stat.flag).toBe('ok');
  });

  it('trie du plus raté au moins raté', () => {
    const sessions = students(5).map((c) => sess(c, '2026-10-01', [good('easy'), bad('hard')]));
    expect(elementStats(sessions).map((s) => s.elementId)).toEqual(['hard', 'easy']);
  });
});

describe('indicateurs du hub', () => {
  it('compte les éléments réussis et repris', () => {
    const summary = summarizeSession([
      good('a'),
      bad('b'),
      res('c', { revealed: true, firstTry: false, tries: 3 }),
    ]);
    expect(summary).toEqual({ reussis: 2, repris: 2 });
  });

  it('utilise exactement les libellés déclarés au hub', () => {
    expect(HUB_INDICATOR_LABELS).toEqual({ reussis: 'éléments réussis', repris: 'éléments repris' });
  });
});

describe('seuils par défaut', () => {
  it('correspondent à la spec section 8', () => {
    expect(DEFAULT_THRESHOLDS).toEqual({
      minPlayedShare: 0.5,
      windowSessions: 2,
      allegerR1: 0.5,
      relever: { r1: 0.9, i: 0.1, e: 1.1 },
      elementFlag: 0.4,
      elementPriority: 0.6,
      confusionMin: 3,
      minStudents: 5,
    });
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run : `npx vitest run tests/signals.test.ts`
Expected : FAIL, module `../src/engine/signals.js` introuvable.

- [ ] **Step 3: Écrire `signals.ts`**

`src/engine/signals.ts` :

```ts
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
```

- [ ] **Step 4: Ajouter l'export dans `index.ts`**

Dans `src/engine/index.ts`, ajouter la ligne :

```ts
export * from './signals.js';
```

- [ ] **Step 5: Lancer les tests et le typage**

Run : `npx vitest run tests/signals.test.ts && npm run typecheck`
Expected : tous les tests passent, `tsc` sans erreur.

- [ ] **Step 6: Commit**

```bash
git add src/engine/signals.ts src/engine/index.ts tests/signals.test.ts
git commit -m "feat(engine): signaux du tableau de bord, seuils réglables, indicateurs hub" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Vérification globale et sauvegarde

**Files:**
- Modify: `memory/gameactif-session-prompt.md` (ligne « Reste »)

- [ ] **Step 1: Lancer toute la suite et le typage**

Run : `npm test && npm run typecheck`
Expected : tous les fichiers de test passent (`rng`, `select`, `round`, `availability`, `validation`, `associer`, `trier`, `ordre`, `setup`, `signals`), `tsc` sans erreur.

- [ ] **Step 2: Test de fumée bout en bout du moteur**

Run (depuis `gameactif/`) :

```bash
npx vitest run --reporter=verbose 2>&1 | tail -20
```

Expected : aucune ligne `FAIL`, ni `skipped`.

- [ ] **Step 3: Mettre à jour le fil conducteur**

Dans `C:\Users\jfbeg\OneDrive\claude-workspace\memory\gameactif-session-prompt.md`, remplacer la ligne qui commence par `Reste :` par :

```
Reste : plan 1 (moteur pur) exécuté ; plans 2 à 5 à rédiger un par un (voir feuille de route en tête de `gameactif/docs/superpowers/plans/2026-10-01-gameactif-plan-1-moteur.md`). Sous-domaine Vercel à créer par JF au moment du premier push utile.
```

- [ ] **Step 4: Pousser sur GitHub (après accord de JF)**

Le moteur seul n'a rien à déployer : le push sert de sauvegarde. Demander l'accord de JF avant de pousser, puis :

```bash
git status
git push -u origin main
```

Expected : branche `main` créée sur `jfb4plai/GameActif` (authentification par les identifiants GCM en cache, sans `gh`).

---

## Auto-revue du plan contre la spec

| Exigence de la spec | Tâche |
|---|---|
| §5 modèle : éléments, relations (appariement, appartenance, rang), marqueur de difficulté, état de validation | 1 |
| §5 mécaniques disponibles selon les relations remplies, avec message | 4 |
| §6 trois mécaniques, un seul moteur, profils en paramètres, sans changer le contenu | 2, 3, 5, 6, 7 |
| §6 marqueur de difficulté filtre les éléments selon le profil | 2 (`orderByProfile`), 5, 6 |
| §7 publication impossible sans contexte ni validation de chaque élément, compteur modifiés/inchangés | 4 |
| §7 mélange et absence d'indice de surface (test de non-régression) | 1, 2, 5, 6, 7 |
| §8 seuils par défaut, sessions comptées, fenêtre de 2, libellés, applicabilité, sous 5 élèves | 8 |
| §8 indicateurs hub (`éléments réussis`, `éléments repris`), sans score global | 8 |
| §10 retours bienveillants, jamais de « Faux », pas de perte de points | 3 (messages de `FEEDBACK`) |
| §11 tests des moteurs, profils, signaux | 1 à 8 |

Hors de ce plan, couverts par les plans suivants : rendu et accessibilité (§10, plan 2), création et .docx (§7, plan 3), tables, RLS, HubActif (§8, §9, plan 4), tableau de bord affiché (§8, plan 5). Les noms utilisés d'une tâche à l'autre sont cohérents : `RoundState`, `ElementResult`, `step`, `createRound`, `setupRound`, `availableMechanics`, `canPublish`, `suggestLevel`, `elementStats`, `summarizeSession`, `DEFAULT_THRESHOLDS`, `HUB_INDICATOR_LABELS`.

### Task 10 (ajout 2026-11-03, avenant référentiel) : champ `cibles`

À détailler au moment de l'exécution, après lecture de `types.ts` (tâche 1) et de `validate.ts` (tâche 4) tels que livrés.

- [ ] Ajouter `cibles: string[]` au modèle d'activité (codes d'attendus, forme `M.P4.1.1.i1.a1`).
- [ ] Validation : publication refusée si `cibles` compte moins de 1 ou plus de 3 codes, ou un code qui n'existe pas dans `data/referentiel-maths-p3-p4.json`.
- [ ] Tests unitaires : 0 cible refusée, 4 cibles refusées, code inconnu refusé, 1 à 3 codes connus acceptés.
- [ ] Script `scripts/build-referentiel.mjs` déjà écrit (2026-11-03) : 323 attendus (P3 150 + P4 173). Le brancher sur `npm run build:referentiel` et sur la tâche 9 (vérification globale).

Aperçu visuel de l'ancrage : `gameactif/previsualisation/index.html` (maquette, aucune donnée enregistrée).

### Task 11 (ajout 2026-11-03) : mécanique « Placer dans une scène »

À détailler à l'exécution, après les tâches 3 et 5 à 7. Voir avenant section 11. Mise en place `placer.ts` : une consigne = un tour de choix où les options sont les zones de la scène ; le moteur ne connaît pas les coordonnées (rendu seul). Tests : consigne sans zone refusée, zone attendue unique, indice selon profil, aucun mélange de zones ni de position qui trahisse la réponse.
