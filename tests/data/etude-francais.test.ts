import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

const lancer = (...args: string[]) => execFileSync('node', ['scripts/etude-referentiel-francais.mjs', ...args], { encoding: 'utf8' });

describe('étude du référentiel de français (script en lecture seule)', () => {
  it('compte les attendus par année, sépare les compétences, et liste les fichiers illisibles', () => {
    const sortie = JSON.parse(lancer('tests/fixtures/referentiel-fr', '--json'));
    expect(sortie).toEqual({
      fichiers: 2,
      attendusParAnnee: { P3: 2, P4: 1 },
      attendusCompetencesParAnnee: { P3: 1, P4: 2 },
      illisibles: ['P5.json', 'P6.json'],
    });
  });

  it('ne modifie aucun fichier : le dossier d’entrée est lu seulement', () => {
    const avant = execFileSync('node', ['-e', "const fs=require('fs');const d='tests/fixtures/referentiel-fr/francais';console.log(fs.readdirSync(d).map(f=>f+':'+fs.statSync(d+'/'+f).mtimeMs).join('|'))"], { encoding: 'utf8' });
    lancer('tests/fixtures/referentiel-fr', '--json');
    const apres = execFileSync('node', ['-e', "const fs=require('fs');const d='tests/fixtures/referentiel-fr/francais';console.log(fs.readdirSync(d).map(f=>f+':'+fs.statSync(d+'/'+f).mtimeMs).join('|'))"], { encoding: 'utf8' });
    expect(apres).toBe(avant);
  });

  it('affiche un tableau lisible sans l’option --json', () => {
    const sortie = lancer('tests/fixtures/referentiel-fr');
    expect(sortie).toMatch(/P3\s+2/);
    expect(sortie).toMatch(/illisible/i);
  });

  it('échoue avec un message clair quand le dossier n’existe pas', () => {
    expect(() => execFileSync('node', ['scripts/etude-referentiel-francais.mjs', 'dossier-inexistant'], { encoding: 'utf8', stdio: 'pipe' })).toThrow(/introuvable/);
  });
});
