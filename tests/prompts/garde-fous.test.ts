import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import brut from '../../src/prompts/garde-fous.json';
import { GARDE_FOUS, VERIFICATION } from '../../src/prompts/construire.js';

const MARQUES = ['Atari', 'Bubble', 'Meowdoku', 'Breakout', 'Arkanoid'];
const avenant = readFileSync('docs/superpowers/specs/2026-11-03-gameactif-avenant-referentiel.md', 'utf8');
const section = avenant.slice(avenant.indexOf('### Garde-fous communs'), avenant.indexOf('### Ce que l\'enseignant doit vérifier'));

describe('garde-fous', () => {
  it('en compte exactement 15, exportés tels quels', () => {
    expect(brut.garde_fous).toHaveLength(15);
    expect([...GARDE_FOUS]).toEqual(brut.garde_fous);
    expect(VERIFICATION).toHaveLength(5);
  });

  it('figurent mot pour mot, dans l\'ordre, dans la section 15 de l\'avenant', () => {
    brut.garde_fous.forEach((g, i) => {
      expect(section).toContain(`\n${i + 1}. ${g}\n`);
    });
  });

  it('ne contiennent ni tiret cadratin ni nom de marque', () => {
    const json = readFileSync('src/prompts/garde-fous.json', 'utf8');
    expect(json).not.toContain('—');
    for (const m of MARQUES) expect(json.toLowerCase()).not.toContain(m.toLowerCase());
  });
});
