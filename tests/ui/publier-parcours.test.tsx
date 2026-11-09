// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Parcours } from '../../src/ui/Parcours';
import { CalmProvider } from '../../src/ui/CalmContext';
import { AuthProvider } from '../../src/compte/auth';
import { fauxAuth } from '../compte/fauxAuth';
import { magasinMemoire } from '../../src/compte/activites.js';
import { magasinSuiviMemoire } from '../../src/suivi/lecture.js';
import { magasinPartageMemoire } from '../../src/partage/magasin.js';
import type { Stockage } from '../../src/parcours/stockage.js';
import type { StockageLocal } from '../../src/compte/invitation.js';

afterEach(() => cleanup());

const brouillon = {
  niveau: 'P4',
  matiere: 'mathematiques',
  cibles: ['M.P4.1.1.i1.a1'],
  titre: 'Les positions',
  contexte: '18 élèves de 4e primaire, vocabulaire de position travaillé la semaine dernière.',
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

function memoire(avecBrouillon = false, niveau = 'P4'): Stockage & StockageLocal {
  const d = new Map<string, string>();
  if (avecBrouillon) d.set('gameactif.brouillon.v1', JSON.stringify({ v: 1, etape: 'elements', brouillon: { ...brouillon, niveau, cibles: [`M.${niveau}.1.1.i1.a1`] } }));
  return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => void d.set(k, v), removeItem: (k) => void d.delete(k) };
}

async function monter(opts: { suiviActif: boolean; enseignant: boolean; niveau?: string }) {
  window.history.replaceState(null, '', '/');
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  render(
    <CalmProvider>
      <AuthProvider client={fauxAuth({ session: { id: 'u1', email: 'prof@ecole.be' } }).client}>
        <Parcours
          stockage={memoire(true, opts.niveau)}
          rpc={async () => ({ data: opts.enseignant, error: null })}
          stockageInvitation={memoire()}
          stockageSuivi={memoire()}
          magasin={magasinMemoire()}
          suiviActif={opts.suiviActif}
          magasinSuivi={magasinSuiviMemoire({ classes: [{ id: 'c1', label: 'P4 B', nbCodes: 24, classCode: 'ABCD2345', purgeLe: '2027-08-30', proprietaire: true }] })}
          magasinPartage={magasinPartageMemoire()}
        />
      </AuthProvider>
    </CalmProvider>,
  );
  await userEvent.click(await screen.findByRole('button', { name: 'Suivant' }));
  await screen.findByRole('heading', { name: 'Vos jeux' });
}

describe('Parcours, « Proposer à la classe » à l’étape « Vos jeux »', () => {
  it('suivi actif et enseignant connecté : le bouton est proposé', async () => {
    await monter({ suiviActif: true, enseignant: true });
    expect(await screen.findByRole('button', { name: 'Proposer à la classe' })).toBeTruthy();
  });

  it('un compte sans accès enseignant ne le voit pas', async () => {
    await monter({ suiviActif: true, enseignant: false });
    expect(screen.queryByRole('button', { name: 'Proposer à la classe' })).toBeNull();
  });

  it('avant la 3e primaire : pas de lien de partage, et une phrase explique pourquoi', async () => {
    for (const niveau of ['P1', 'P2']) {
      await monter({ suiviActif: true, enseignant: true, niveau });
      expect(screen.queryByRole('button', { name: 'Proposer à la classe' })).toBeNull();
      expect(screen.getByText(/à partir de la 3e primaire/)).toBeTruthy();
      cleanup();
    }
  });

  it('à partir de la 3e primaire : le bouton est proposé', async () => {
    await monter({ suiviActif: true, enseignant: true, niveau: 'P3' });
    expect(await screen.findByRole('button', { name: 'Proposer à la classe' })).toBeTruthy();
  });

  it('suivi inactif : pas de bouton', async () => {
    await monter({ suiviActif: false, enseignant: true });
    expect(screen.queryByRole('button', { name: 'Proposer à la classe' })).toBeNull();
  });
});
