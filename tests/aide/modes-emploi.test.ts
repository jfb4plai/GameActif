import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { AIDES, type AideId } from '../../src/aide/aides.js';

const sortie = (public_: 'enseignant' | 'eleve') => execFileSync('node', ['scripts/build-modes-emploi.mjs', '--stdout', public_], { encoding: 'utf8' });
// Fins de ligne normalisées : un checkout Windows (core.autocrlf) peut convertir le fichier versionné en CRLF.
const fichier = (nom: string) => readFileSync(new URL(`../../docs/modes-emploi/${nom}`, import.meta.url), 'utf-8').replace(/\r\n/g, '\n');

const ids = Object.keys(AIDES) as AideId[];
const enseignant = ids.filter((i) => AIDES[i].public === 'enseignant');
const eleve = ids.filter((i) => AIDES[i].public === 'eleve');

describe('modes d’emploi générés', () => {
  it('le mode d’emploi enseignant reprend chaque puce et chaque limite des neuf aides, et rien de l’aide élève', () => {
    const html = sortie('enseignant');
    expect(enseignant).toHaveLength(9);
    for (const id of enseignant) {
      for (const p of AIDES[id].puces) expect(html, p).toContain(p);
      expect(html).toContain(AIDES[id].limite as string);
    }
    for (const id of eleve) for (const p of AIDES[id].puces) expect(html, p).not.toContain(p);
  });

  it('le mode d’emploi élève ne contient que l’aide élève', () => {
    const html = sortie('eleve');
    for (const id of eleve) for (const p of AIDES[id].puces) expect(html, p).toContain(p);
    for (const id of enseignant) for (const p of AIDES[id].puces) expect(html, p).not.toContain(p);
  });

  for (const public_ of ['enseignant', 'eleve'] as const) {
    describe(public_, () => {
      const html = () => sortie(public_);

      it('ne contient ni « Soutien », ni tiret cadratin, ni l’autre adresse de contact', () => {
        expect(html()).not.toMatch(/Soutien/);
        expect(html()).not.toMatch(/—/);
        expect(html()).not.toMatch(/jf\.beguin@outlook\.com/);
      });

      it('donne le contact des outils PLAI et déclare la langue', () => {
        expect(html()).toContain('jeanfrancois.beguin@ens.ecl.be');
        expect(html()).toMatch(/<html lang="fr">/);
        expect(html()).toMatch(/<title>[^<]+<\/title>/);
      });

      it('n’a aucune ressource externe ni chemin absolu : ancres seulement (s’ouvre en file:// comme en ligne)', () => {
        const refs = [...html().matchAll(/\b(?:src|href)="([^"]*)"/g)].map((m) => m[1]);
        for (const r of refs) {
          expect(r, r).not.toMatch(/^(https?:|file:|\/|[A-Za-z]:\\)/);
        }
        expect(html()).not.toMatch(/<script/i);
        expect(html()).not.toMatch(/fonts\.googleapis/);
      });

      it('est déterministe : deux exécutions donnent le même texte', () => {
        expect(html()).toBe(html());
      });

      it('est identique au fichier versionné dans docs/modes-emploi/', () => {
        expect(fichier(`gameactif-${public_}.html`)).toBe(html());
      });
    });
  }
});
