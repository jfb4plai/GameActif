// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { TableauDeBord } from '../../src/ui/TableauDeBord';
import { magasinSuiviMemoire, type ClasseLue, type SuiviStore } from '../../src/suivi/lecture.js';
import type { ResultatEnvoye, SessionEnregistree } from '../../src/suivi/types.js';
import type { MechanicId } from '../../src/engine/types.js';
import type { StockageLocal } from '../../src/compte/invitation.js';

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

function stockage(roster?: Record<string, string>): StockageLocal {
  const d = new Map<string, string>();
  if (roster) d.set('gameactif.roster.v1.c1', JSON.stringify(roster));
  return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => void d.set(k, v), removeItem: (k) => void d.delete(k) };
}

const deuxSeances = () => magasinSuiviMemoire({ classes: [classe], sessions: { c1: [s('E01', 'trier', '2026-11-09', [el('entre'), el('devant', ['derriere'])]), s('E02', 'memo', '2026-11-10', [el('entre'), el('entre')])] } });

describe('TableauDeBord, couche des états', () => {
  it('annonce combien de codes ont joué et nomme ceux qui n’ont rien joué', async () => {
    render(<TableauDeBord classe={classe} store={deuxSeances()} stockage={stockage()} />);
    expect(await screen.findByText('2 codes sur 24 ont joué')).toBeTruthy();
    const absents = screen.getByText(/Pas encore joué/);
    expect(absents.textContent).toContain('E03');
    expect(absents.textContent).not.toContain('E01');
  });

  it('montre le type d’erreur avec les étiquettes de la consigne', async () => {
    render(<TableauDeBord classe={classe} store={deuxSeances()} stockage={stockage()} />);
    const tableau = await screen.findByRole('table', { name: 'Erreurs par type' });
    expect(within(tableau).getByText(/« derrière » choisi au lieu de « devant »/)).toBeTruthy();
  });

  it('montre le même attendu dans les autres jeux, avec la réussite au premier essai', async () => {
    render(<TableauDeBord classe={classe} store={deuxSeances()} stockage={stockage()} />);
    const tableau = await screen.findByRole('table', { name: 'Le même attendu dans les autres jeux' });
    expect(within(tableau).getByRole('row', { name: /Trier.*50 %/ })).toBeTruthy();
    expect(within(tableau).getByRole('row', { name: /Mémo.*100 %/ })).toBeTruthy();
  });

  it('compte à part les tours joués au niveau au-dessus et les exclut de la réussite moyenne', async () => {
    const store = magasinSuiviMemoire({
      classes: [classe],
      sessions: { c1: [s('E01', 'trier', '2026-11-09', [el('entre'), el('devant', ['derriere'])]), s('E02', 'trier', '2026-11-10', [el('entre'), el('entre')], true)] },
    });
    render(<TableauDeBord classe={classe} store={store} stockage={stockage()} />);
    const tableau = await screen.findByRole('table', { name: 'Le même attendu dans les autres jeux' });
    const ligne = within(tableau).getByRole('row', { name: /Trier/ });
    expect(ligne.textContent).toMatch(/dont 1 au niveau au-dessus/);
    expect(ligne.textContent).toMatch(/50 %/);
  });

  it('affiche toujours le bandeau « Indice, pas une preuve »', async () => {
    render(<TableauDeBord classe={classe} store={deuxSeances()} stockage={stockage()} />);
    expect(await screen.findByText(/Indice, pas une preuve/)).toBeTruthy();
  });

  it('remplace le code par le prénom de la liste locale, sans rien envoyer au magasin', async () => {
    const base = deuxSeances();
    const ecritures = {
      creerClasse: vi.fn(),
      supprimerClasse: vi.fn(),
      saisirManuel: vi.fn(),
      enregistrerObservation: vi.fn(),
      inviter: vi.fn(),
      rejoindre: vi.fn(),
      revoquer: vi.fn(),
    };
    const store: SuiviStore = { ...base, ...ecritures };
    render(<TableauDeBord classe={classe} store={store} stockage={stockage({ E01: 'Léa' })} />);
    const tableau = await screen.findByRole('table', { name: 'Où en sont les élèves' });
    expect(within(tableau).getByText(/Léa/)).toBeTruthy();
    for (const f of Object.values(ecritures)) expect(f).not.toHaveBeenCalled();
  });

  it('sans séance : message clair, aucun NaN, aucune erreur', async () => {
    const vide = magasinSuiviMemoire({ classes: [classe] });
    const { container } = render(<TableauDeBord classe={classe} store={vide} stockage={stockage()} />);
    expect(await screen.findByText('Aucune séance reçue pour cette classe.')).toBeTruthy();
    expect(container.textContent).not.toMatch(/NaN|undefined/);
  });

  it('un chargement qui échoue affiche une alerte en français', async () => {
    const store: SuiviStore = { ...deuxSeances(), sessions: vi.fn().mockRejectedValue(new Error('boom')) };
    render(<TableauDeBord classe={classe} store={store} stockage={stockage()} />);
    expect((await screen.findByRole('alert')).textContent).toMatch(/n’ont pas pu être chargés/);
  });

  it('changer un seuil change l’état affiché', async () => {
    const store = magasinSuiviMemoire({
      classes: [classe],
      sessions: { c1: [s('E01', 'trier', '2026-11-09', [el('entre'), el('entre')]), s('E01', 'memo', '2026-11-10', [el('entre'), el('entre')])] },
    });
    render(<TableauDeBord classe={classe} store={store} stockage={stockage()} />);
    const tableau = await screen.findByRole('table', { name: 'Où en sont les élèves' });
    expect(within(tableau).getByRole('row', { name: /En cours/ }).textContent).toContain('E01');
    fireEvent.change(screen.getByLabelText('Jeux différents réussis'), { target: { value: '2' } });
    expect(within(tableau).getByRole('row', { name: /Stabilisé/ }).textContent).toContain('E01');
  });

  it('présente les valeurs de départ des seuils comme une proposition non validée', async () => {
    render(<TableauDeBord classe={classe} store={deuxSeances()} stockage={stockage()} />);
    await screen.findByText('2 codes sur 24 ont joué');
    expect(screen.getByText(/proposition, non validée scientifiquement/)).toBeTruthy();
    expect((screen.getByLabelText('Jeux différents réussis') as HTMLInputElement).value).toBe('3');
  });

  it('ne code pas les états par la seule couleur : un mot accompagne chaque pictogramme', async () => {
    render(<TableauDeBord classe={classe} store={deuxSeances()} stockage={stockage()} />);
    const tableau = await screen.findByRole('table', { name: 'Où en sont les élèves' });
    for (const mot of ['Stabilisé', 'En cours', 'À reprendre', 'Pas d’indice']) expect(within(tableau).getByText(new RegExp(mot))).toBeTruthy();
  });
});
