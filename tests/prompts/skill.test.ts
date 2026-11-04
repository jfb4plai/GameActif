import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import garde from '../../src/prompts/garde-fous.json';

const MARQUES = ['Atari', 'Bubble', 'Meowdoku', 'Breakout', 'Arkanoid'];
const skill = readFileSync('skills/jeu-arcade/SKILL.md', 'utf8');

describe('skill jeu-arcade', () => {
  it('est à jour : égal à la sortie du script de génération', () => {
    const sortie = execFileSync('node', ['scripts/build-skill-arcade.mjs', '--stdout'], { encoding: 'utf8' });
    expect(skill).toBe(sortie);
  });

  it('a un en-tête avec le nom et une description de moins de 1 000 caractères', () => {
    const m = skill.match(/^---\nname: jeu-arcade\ndescription: (.+)\n---\n/);
    expect(m).not.toBeNull();
    const description = (m as RegExpMatchArray)[1];
    expect(description.length).toBeLessThan(1000);
    expect(description).toContain('GameActif');
    expect(description).toContain('tir aux bulles');
    expect(description).toContain('casse-briques');
  });

  it('contient les 15 garde-fous mot pour mot, les deux consignes et la vérification', () => {
    garde.garde_fous.forEach((g, i) => expect(skill).toContain(`${i + 1}. ${g}`));
    expect(skill).toContain(garde.modes.bulles.consigne);
    expect(skill).toContain(garde.modes.briques.consigne);
    for (const v of garde.verification) expect(skill).toContain(v);
  });

  it('demande le mode et le profil, lit le fichier d\'export et exclut le contexte de classe', () => {
    expect(skill).toContain('Demander le mode');
    expect(skill).toContain('Demander le profil');
    expect(skill).toContain('brouillon');
    expect(skill).toContain('Ne jamais inclure le contexte de classe');
  });

  it('ne contient ni marque, ni tiret cadratin, ni clé, ni adresse de serveur', () => {
    expect(skill).not.toContain('—');
    for (const m of MARQUES) expect(skill.toLowerCase()).not.toContain(m.toLowerCase());
    expect(skill).not.toMatch(/https?:\/\//);
    expect(skill).not.toMatch(/sk-|api[_ -]?key|supabase|vercel/i);
  });
});
