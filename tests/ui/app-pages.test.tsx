// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import App from '../../src/App';

afterEach(() => {
  cleanup();
  window.location.hash = '';
  window.localStorage.clear();
});

describe('App, pages légales', () => {
  it('le parcours est affiché par défaut, avec le pied de page', () => {
    window.location.hash = '';
    render(<App />);
    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Confidentialité' })).toBeTruthy();
  });

  it('un hash inconnu affiche le parcours, pas une page blanche', () => {
    window.location.hash = '#/nimportequoi';
    render(<App />);
    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy();
  });

  it('#/confidentialite affiche la page, #/mentions l’autre, et le changement de hash se suit', async () => {
    window.location.hash = '#/confidentialite';
    render(<App />);
    expect(screen.getByRole('heading', { level: 2, name: 'Confidentialité' })).toBeTruthy();
    await act(async () => {
      window.location.hash = '#/mentions';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('heading', { level: 2, name: 'Mentions légales' })).toBeTruthy();
    await act(async () => {
      window.location.hash = '#/';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy();
  });

  it('visiter une page légale ne touche pas au brouillon enregistré', () => {
    const brouillon = JSON.stringify({
      v: 1,
      etape: 'niveau',
      brouillon: { niveau: 'P4', matiere: '', cibles: [], titre: 'Mon essai', contexte: '', familles: [{ label: '', elements: '' }, { label: '', elements: '' }, { label: '', elements: '' }], paires: '', etapes: '', comparaisons: '', qcm: '' },
    });
    window.localStorage.setItem('gameactif.brouillon.v1', brouillon);
    window.location.hash = '#/confidentialite';
    render(<App />);
    expect(window.localStorage.getItem('gameactif.brouillon.v1')).toBe(brouillon);
  });

  it('l’étiquette « aucune donnée enregistrée » reste vraie : sans compte disponible, elle est affichée', () => {
    window.location.hash = '';
    render(<App />);
    expect(screen.getByText('Maquette : aucune donnée enregistrée')).toBeTruthy();
  });
});
