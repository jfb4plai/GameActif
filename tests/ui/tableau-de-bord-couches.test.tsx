// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { TableauDeBord } from '../../src/ui/TableauDeBord';
import { magasinSuiviMemoire, type ClasseLue } from '../../src/suivi/lecture.js';
import type { ResultatManuel } from '../../src/suivi/agregats.js';
import type { ResultatEnvoye, SessionEnregistree } from '../../src/suivi/types.js';
import type { MechanicId } from '../../src/engine/types.js';

afterEach(() => cleanup());

const C = 'M.P4.1.1.i1.a1';
const classe: ClasseLue = { id: 'c1', label: 'P4 B', nbCodes: 24, classCode: 'ABCD2345', purgeLe: '2027-08-30', proprietaire: true };

function el(correct: string, wrong: string[] = []): ResultatEnvoye {
  return { elementId: `el-${correct}`, mechanic: 'trier', firstTry: wrong.length === 0, tries: wrong.length + 1, hintUsed: false, revealed: false, wrongChoices: wrong, correct };
}
function s(code: string, mechanic: MechanicId, jour: string, resultats: ResultatEnvoye[], above = false): SessionEnregistree {
  return {
    sessionId: `${code}-${mechanic}-${jour}${above ? '-haut' : ''}`,
    studentCode: code,
    profile: 'standard',
    totalElements: resultats.length,
    endedAt: `${jour}T10:00:00.000Z`,
    results: resultats,
    cibles: [C],
    mechanic,
    labels: { devant: 'devant', derriere: 'derrière', entre: 'entre' },
    origine: 'ecran',
    above,
  };
}
const pas = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

function monter(sessions: SessionEnregistree[], manuels: ResultatManuel[] = []) {
  const store = magasinSuiviMemoire({ classes: [classe], sessions: { c1: sessions }, manuels: { c1: manuels } });
  render(<TableauDeBord classe={classe} store={store} stockage={pas} />);
}
async function choisirEleve(code: string) {
  const liste = await screen.findByLabelText('Élève');
  fireEvent.change(liste, { target: { value: code } });
}

describe('TableauDeBord, évolution et faits', () => {
  it('sous trois jours de séance : le message du minimum et aucune courbe', async () => {
    monter([s('E01', 'trier', '2026-11-09', [el('entre')]), s('E01', 'memo', '2026-11-10', [el('entre')])]);
    await choisirEleve('E01');
    expect(screen.getByText('Pas assez de séances pour une tendance (3 jours minimum).')).toBeTruthy();
    expect(document.querySelectorAll('svg circle')).toHaveLength(0);
  });

  it('à partir de trois jours : un point par jour, avec un tableau équivalent', async () => {
    monter([s('E01', 'trier', '2026-11-09', [el('entre'), el('devant', ['derriere'])]), s('E01', 'memo', '2026-11-10', [el('entre')]), s('E01', 'qcm', '2026-11-11', [el('entre')])]);
    await choisirEleve('E01');
    expect(document.querySelectorAll('svg circle')).toHaveLength(3);
    const tableau = screen.getByRole('table', { name: 'Réussite au 1er essai par jour' });
    expect(within(tableau).getAllByRole('row')).toHaveLength(4);
    expect(screen.getByRole('img', { name: /Courbe de la réussite/ })).toBeTruthy();
  });

  it('la vue « Toute la classe » donne la tendance de la classe sans les faits d’un code', async () => {
    monter([s('E01', 'trier', '2026-11-09', [el('entre')]), s('E02', 'memo', '2026-11-10', [el('entre')]), s('E03', 'qcm', '2026-11-11', [el('entre')])]);
    await screen.findByLabelText('Élève');
    expect(document.querySelectorAll('svg circle')).toHaveLength(3);
    expect(screen.getByText('Choisissez un code pour voir ses faits.')).toBeTruthy();
  });

  it('les faits distinguent le jeu sur écran du résultat saisi par l’enseignant', async () => {
    monter(
      [s('E01', 'trier', '2026-11-10', [el('entre'), el('devant', ['derriere'])])],
      [{ studentCode: 'E01', cible: C, resultat: 'partiel', date: '2026-11-09T10:00:00.000Z' }],
    );
    await choisirEleve('E01');
    const faits = screen.getByRole('table', { name: 'Faits pour E01' });
    const lignes = within(faits).getAllByRole('row').slice(1);
    expect(lignes).toHaveLength(2);
    expect(lignes[0].textContent).toMatch(/Jeu physique.*saisi par l’enseignant.*partiel/);
    expect(lignes[1].textContent).toMatch(/Trier.*50 %.*derrière au lieu de devant.*jeu sur écran/);
  });

  it('les faits indiquent un tour joué au niveau au-dessus', async () => {
    monter([s('E01', 'trier', '2026-11-10', [el('entre')], true), s('E01', 'memo', '2026-11-11', [el('entre')])]);
    await choisirEleve('E01');
    const faits = screen.getByRole('table', { name: 'Faits pour E01' });
    const lignes = within(faits).getAllByRole('row').slice(1);
    expect(lignes[0].textContent).toMatch(/Trier.*jeu sur écran, niveau au-dessus/);
    expect(lignes[1].textContent).toMatch(/Mémo/);
    expect(lignes[1].textContent).not.toMatch(/niveau au-dessus/);
  });

  it('place les couches dans l’ordre : états, évolution, faits', async () => {
    monter([s('E01', 'trier', '2026-11-09', [el('entre')])]);
    await choisirEleve('E01');
    const etats = screen.getByRole('heading', { name: 'Où en sont les élèves' });
    const evolution = screen.getByRole('heading', { name: 'Évolution dans le temps' });
    const faits = screen.getByRole('heading', { name: 'Faits par code' });
    expect(etats.compareDocumentPosition(evolution) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(evolution.compareDocumentPosition(faits) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
