// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Parcours } from '../../src/ui/Parcours';
import { CalmProvider } from '../../src/ui/CalmContext';
import { AuthProvider } from '../../src/compte/auth';
import { fauxAuth } from '../compte/fauxAuth';
import type { ClientPartage } from '../../src/partage/lecture.js';
import type { ClientSuivi } from '../../src/suivi/envoi.js';
import type { Stockage } from '../../src/parcours/stockage.js';
import type { StockageLocal } from '../../src/compte/invitation.js';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

function memoire(): Stockage & StockageLocal {
  const d = new Map<string, string>();
  return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => void d.set(k, v), removeItem: (k) => void d.delete(k) };
}

const brouillon = {
  niveau: 'P4',
  matiere: 'mathematiques',
  cibles: ['M.P4.1.1.i1.a1'],
  titre: 'Les positions',
  contexte: 'Activité partagée à la classe',
  familles: [
    { label: 'Position absolue', elements: 'à l’intérieur\nentre' },
    { label: 'Position relative', elements: 'devant\nà gauche' },
    { label: '', elements: '' },
  ],
  paires: 'devant | derrière\nà droite | à gauche',
  etapes: 'premier\ndeuxième\ntroisième',
  comparaisons: '',
  qcm: '',
};
const partage: ClientPartage & ClientSuivi = {
  async rpc(nom: string) {
    if (nom === 'game_get_shared_activity') return { data: { titre: 'Les positions', brouillon, mode: 'meme', profilDefaut: 'standard', classCode: 'ABCD2345', nbCodes: 24 }, error: null };
    return { data: 24, error: null };
  },
};

function monter(adresse: string, suiviActif: boolean) {
  window.history.replaceState(null, '', adresse);
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  render(
    <CalmProvider>
      <AuthProvider client={fauxAuth().client}>
        <Parcours stockage={memoire()} stockageInvitation={memoire()} stockageSuivi={memoire()} suiviActif={suiviActif} partage={partage} />
      </AuthProvider>
    </CalmProvider>,
  );
}

describe('Parcours, ouverture d’un lien d’activité', () => {
  it('suivi actif : la vue élève remplace le parcours, et l’adresse est gardée pour qu’un rechargement rouvre l’activité', async () => {
    monter('/?activite=K7M2XQ9A', true);
    expect(await screen.findByRole('heading', { name: 'Les positions' })).toBeTruthy();
    expect(screen.queryByText(/Étape 1 sur 5/)).toBeNull();
    expect(window.location.search).toContain('activite=K7M2XQ9A');
  });

  it('suivi inactif : le parcours habituel s’affiche', () => {
    monter('/?activite=K7M2XQ9A', false);
    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy();
  });

  it('un code mal formé : le parcours habituel s’affiche', () => {
    monter('/?activite=abc', true);
    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy();
  });

  it('sans lien : le parcours habituel s’affiche', () => {
    monter('/', true);
    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy();
  });
});
