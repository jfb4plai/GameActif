// @vitest-environment jsdom
// Fait tourner les deux jeux de référence (bulles.html, briques.html) dans jsdom, avec un canevas factice,
// pour contrôler leur comportement : niveaux et barres du Tir aux bulles, flèche de direction du Casse-briques.
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';

type Etat = Record<string, any>;
interface Crochet {
  etat: () => Etat;
  [nom: string]: any;
}

const noop = () => undefined;
const ctxFactice = new Proxy(
  {},
  {
    get: (_t, p) => (p === 'measureText' ? () => ({ width: 10 }) : noop),
    set: () => true,
  },
);

function charger(nom: 'bulles' | 'briques', crochet: string, familles?: number): Crochet {
  const html = readFileSync(`src/prompts/references/${nom}.html`, 'utf8').split('\r\n').join('\n');
  const corps = (html.match(/<body>([\s\S]*?)<script>/) as RegExpMatchArray)[1];
  let script = (html.match(/<script>([\s\S]*?)<\/script>/) as RegExpMatchArray)[1];
  if (familles !== undefined) {
    const liste = Array.from({ length: familles }, (_v, i) => `{ nom: 'Famille ${i + 1}', elements: ['mot ${i + 1}a', 'mot ${i + 1}b'] }`);
    script = script.replace(/var DONNEES = \{[\s\S]*?\n  \};/, `var DONNEES = { familles: [${liste.join(', ')}] };`);
  }
  const fin = /demarrer\(\);\s*\}\)\(\);\s*$/;
  expect(script).toMatch(fin);
  script = script.replace(fin, `demarrer();\n${crochet}\n})();`);
  document.body.innerHTML = corps;
  const cv = document.getElementById('terrain') as HTMLCanvasElement;
  (cv as any).getContext = () => ctxFactice;
  cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: cv.width, height: cv.height, right: cv.width, bottom: cv.height, x: 0, y: 0, toJSON: noop }) as DOMRect;
  (window as any).requestAnimationFrame = () => 0;
  (window as any).cancelAnimationFrame = noop;
  new Function(script)();
  return (window as any).__t as Crochet;
}

const touche = (cle: string, maj = false) =>
  (document.getElementById('terrain') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: cle, shiftKey: maj, bubbles: true }));
const clic = (id: string) => (document.getElementById(id) as HTMLElement).click();
const pointeur = (type: string, x: number, y: number) =>
  (document.getElementById('terrain') as HTMLElement).dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
const retour = () => (document.getElementById('retour') as HTMLElement).textContent ?? '';

const CROCHET_BULLES =
  'window.__t = { etat: function () { return { cx: cx, barres: barres, niveau: niveau, erreurs: erreurs, pos: pos, cible: cible, angle: angle }; }, libre: libre, atteignable: atteignable };';
const CROCHET_BRIQUES =
  'window.__t = { etat: function () { return { ang: ang, px: px, PY: PY, W: W, balle: balle }; }, fleche: fleche, impact: impact };';

describe('Tir aux bulles : niveaux avec barres', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('démarre au niveau 1 : aucune barre, canon fixe, boutons de déplacement cachés', () => {
    const t = charger('bulles', CROCHET_BULLES);
    expect(t.etat().niveau).toBe(1);
    expect(t.etat().barres).toHaveLength(0);
    expect(document.getElementById('niveau-1')?.getAttribute('aria-pressed')).toBe('true');
    expect((document.getElementById('placer') as HTMLElement).hidden).toBe(true);
    expect((document.getElementById('canon-gauche') as HTMLElement).hidden).toBe(true);
  });

  for (const n of [2, 3, 4]) {
    for (const niveau of [2, 3]) {
      it(`niveau ${niveau}, ${n} familles : des barres existent et chaque amas reste atteignable`, () => {
        const t = charger('bulles', CROCHET_BULLES, n);
        clic(`niveau-${niveau}`);
        const e = t.etat();
        expect(e.niveau).toBe(niveau);
        expect(e.barres.length).toBeGreaterThanOrEqual(1);
        for (let i = 0; i < n; i++) expect(t.atteignable(i)).toBe(true);
        expect((document.getElementById('placer') as HTMLElement).hidden).toBe(false);
      });

      it(`niveau ${niveau}, ${n} familles : depuis la position de départ, au moins un amas est bloqué (la barre sert à quelque chose)`, () => {
        const t = charger('bulles', CROCHET_BULLES, n);
        clic(`niveau-${niveau}`);
        const { cx } = t.etat();
        const bloques = Array.from({ length: n }, (_v, i) => i).filter((i) => !t.libre(cx, i));
        expect(bloques.length).toBeGreaterThanOrEqual(1);
      });
    }
  }

  it('« Placer le canon » rend le tir possible vers chaque amas, y compris au clavier seul', () => {
    for (const n of [2, 3, 4]) {
      const t = charger('bulles', CROCHET_BULLES, n);
      clic('niveau-3');
      for (let k = 0; k < n; k++) {
        clic('placer');
        const e = t.etat();
        expect(t.libre(e.cx, e.cible)).toBe(true);
        touche('ArrowRight');
      }
    }
  });

  it('viser avec le pointeur après « Placer le canon » désigne bien l\'amas et le tir n\'est pas bloqué', () => {
    const n = 3;
    const t = charger('bulles', CROCHET_BULLES, n);
    clic('niveau-2');
    for (let i = 0; i < n; i++) {
      touche('ArrowRight');
      clic('placer');
      const e0 = t.etat();
      const cibleVoulue = e0.cible;
      pointeur('pointermove', (720 / (n + 1)) * (cibleVoulue + 1), 270);
      const e = t.etat();
      expect(e.cible).toBe(cibleVoulue);
      expect(t.libre(e.cx, e.cible)).toBe(true);
    }
  });

  it('un tir bloqué par une barre ne compte pas comme une erreur et ne fait pas avancer le jeu', () => {
    const t = charger('bulles', CROCHET_BULLES, 3);
    clic('calme');
    clic('niveau-2');
    let essais = 0;
    while (t.libre(t.etat().cx, t.etat().cible) && essais++ < 6) touche('ArrowRight');
    expect(t.libre(t.etat().cx, t.etat().cible)).toBe(false);
    touche('Enter');
    expect(retour().toLowerCase()).toContain('barre');
    expect(t.etat().erreurs).toBe(0);
    expect(t.etat().pos).toBe(0);
  });

  it('un tir libre est traité comme avant (bonne ou mauvaise réponse)', () => {
    charger('bulles', CROCHET_BULLES, 3);
    clic('calme');
    clic('niveau-2');
    clic('placer');
    touche('Enter');
    expect(retour()).toMatch(/Bien vu|Pas tout à fait/);
  });

  it('Maj + flèches déplacent le canon par pas de 30 et il reste dans le terrain', () => {
    const t = charger('bulles', CROCHET_BULLES, 3);
    clic('niveau-2');
    const x0 = t.etat().cx;
    touche('ArrowLeft', true);
    expect(t.etat().cx).toBe(x0 - 30);
    for (let k = 0; k < 40; k++) touche('ArrowRight', true);
    expect(t.etat().cx).toBeLessThanOrEqual(700);
    for (let k = 0; k < 40; k++) touche('ArrowLeft', true);
    expect(t.etat().cx).toBeGreaterThanOrEqual(20);
  });

  it('au niveau 1, Maj + flèches ne déplacent pas le canon et revenir au niveau 1 retire les barres', () => {
    const t = charger('bulles', CROCHET_BULLES, 3);
    const x0 = t.etat().cx;
    touche('ArrowLeft', true);
    expect(t.etat().cx).toBe(x0);
    clic('niveau-3');
    clic('niveau-1');
    expect(t.etat().barres).toHaveLength(0);
    expect(t.etat().cx).toBe(x0);
  });
});

describe('Casse-briques : flèche de direction sur le lanceur', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('au départ, la flèche pointe vers le haut et part de la balle posée sur la raquette', () => {
    const t = charger('briques', CROCHET_BRIQUES);
    const e = t.etat();
    expect(e.ang).toBe(0);
    const f = t.fleche();
    expect(f).not.toBeNull();
    expect(f.x1).toBeCloseTo(e.px, 5);
    expect(f.x2).toBeCloseTo(e.px, 5);
    expect(f.y2).toBeLessThan(f.y1);
  });

  it('le pointeur oriente la flèche vers lui, sans déplacer la raquette, tant que la balle n\'est pas lancée', () => {
    const t = charger('briques', CROCHET_BRIQUES);
    const { px } = t.etat();
    const y1 = t.fleche().y1;
    pointeur('pointermove', px + 100, y1 - 200);
    const e = t.etat();
    expect(e.ang).toBeCloseTo(Math.atan2(100, 200), 5);
    expect(e.px).toBe(px);
    const f = t.fleche();
    expect(Math.atan2(f.x2 - f.x1, f.y1 - f.y2)).toBeCloseTo(e.ang, 5);
  });

  it('la flèche est limitée à 60 degrés de la verticale : jamais de lancer presque horizontal', () => {
    const t = charger('briques', CROCHET_BRIQUES);
    const { px, PY } = t.etat();
    pointeur('pointermove', px + 600, PY - 5);
    expect(t.etat().ang).toBeCloseTo(Math.PI / 3, 5);
    pointeur('pointermove', px - 600, PY - 5);
    expect(t.etat().ang).toBeCloseTo(-Math.PI / 3, 5);
  });

  it('la balle part exactement dans la direction de la flèche, sans aléa', () => {
    const t = charger('briques', CROCHET_BRIQUES);
    const { px, PY } = t.etat();
    const vrai = Math.random;
    Math.random = () => {
      throw new Error('aucun aléa permis au lancer');
    };
    try {
      pointeur('pointermove', px - 150, PY - 150);
      const ang = t.etat().ang;
      touche(' ');
      const { balle } = t.etat();
      expect(balle.enJeu).toBe(true);
      expect(Math.atan2(balle.vx, -balle.vy)).toBeCloseTo(ang, 5);
      expect(Math.hypot(balle.vx, balle.vy)).toBeCloseTo(6.7, 5);
    } finally {
      Math.random = vrai;
    }
  });

  it('deux lancers avec la même flèche donnent la même vitesse', () => {
    const vit: number[][] = [];
    for (let k = 0; k < 2; k++) {
      const t = charger('briques', CROCHET_BRIQUES);
      const { px, PY } = t.etat();
      pointeur('pointermove', px + 80, PY - 120);
      touche('Enter');
      vit.push([t.etat().balle.vx, t.etat().balle.vy]);
    }
    expect(vit[0]).toEqual(vit[1]);
  });

  it('Maj + flèches et boutons tournent la flèche par pas de 0,1 rad ; flèches seules déplacent la raquette', () => {
    const t = charger('briques', CROCHET_BRIQUES);
    const px0 = t.etat().px;
    touche('ArrowRight', true);
    expect(t.etat().ang).toBeCloseTo(0.1, 5);
    touche('ArrowLeft', true);
    touche('ArrowLeft', true);
    expect(t.etat().ang).toBeCloseTo(-0.1, 5);
    clic('fleche-droite');
    expect(t.etat().ang).toBeCloseTo(0, 5);
    clic('fleche-gauche');
    expect(t.etat().ang).toBeCloseTo(-0.1, 5);
    expect(t.etat().px).toBe(px0);
    touche('ArrowLeft');
    expect(t.etat().px).toBe(px0 - 30);
    expect(t.etat().ang).toBeCloseTo(-0.1, 5);
  });

  it('une fois la balle lancée, le pointeur déplace la raquette et la flèche ne change plus', () => {
    const t = charger('briques', CROCHET_BRIQUES);
    const { px, PY } = t.etat();
    pointeur('pointermove', px + 50, PY - 100);
    const ang = t.etat().ang;
    touche(' ');
    pointeur('pointermove', px + 200, PY - 10);
    expect(t.etat().ang).toBe(ang);
    expect(t.etat().px).toBeCloseTo(px + 200, 5);
    expect(t.fleche()).toBeNull();
  });

  it('le trait pointillé s\'arrête au premier obstacle, dans le terrain', () => {
    const t = charger('briques', CROCHET_BRIQUES);
    const { px, PY, W } = t.etat();
    for (const dx of [-300, 0, 300]) {
      pointeur('pointermove', px + dx, PY - 300);
      const p = t.impact();
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(W);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(PY);
    }
  });

  it('en mode calme ou pas à pas, il n\'y a ni raquette ni flèche', () => {
    const t = charger('briques', CROCHET_BRIQUES);
    clic('calme');
    expect(t.fleche()).toBeNull();
    clic('calme');
    clic('pas');
    expect(t.fleche()).toBeNull();
  });
});

describe('consignes et prompts arcade : niveaux avec barres et flèche de direction', () => {
  it('la consigne du tir aux bulles décrit les trois niveaux, l\'absence d\'erreur sur tir bloqué et la garantie d\'accès', async () => {
    const garde = (await import('../../src/prompts/garde-fous.json')).default;
    const c = garde.modes.bulles.consigne;
    expect(c).toContain('Niveau 2 : une barre');
    expect(c).toContain('Niveau 3 : deux barres');
    expect(c).toContain('jamais une erreur');
    expect(c).toContain('TOUJOURS être possible');
    expect(c).toContain('42 px');
    expect(c).toContain('Placer le canon');
  });

  it('la consigne du casse-briques impose la flèche de direction et un lancer sans hasard', async () => {
    const garde = (await import('../../src/prompts/garde-fous.json')).default;
    const c = garde.modes.briques.consigne;
    expect(c).toContain('flèche de direction');
    expect(c).toContain('exactement dans la direction de la flèche');
    expect(c).toContain('sans aucun hasard');
  });

  it('les prompts construits embarquent les jeux de référence à jour', async () => {
    const { construirePrompt } = await import('../../src/prompts/construire.js');
    const { activitePilote } = await import('../../src/data/pilote.js');
    const bulles = construirePrompt(activitePilote(), 'bulles', 'standard', 1).texte;
    expect(bulles).toContain('id="niveau-3"');
    expect(bulles).toContain('function securiser()');
    const briques = construirePrompt(activitePilote(), 'briques', 'standard', 1).texte;
    expect(briques).toContain('id="fleche-gauche"');
    expect(briques).toContain('function fleche()');
    expect(briques).not.toContain('Math.random() < 0.5 ? -1 : 1) * 3');
  });
});
