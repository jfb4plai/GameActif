// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Parcours } from '../../src/ui/Parcours';
import { CalmProvider } from '../../src/ui/CalmContext';
import { AuthProvider } from '../../src/compte/auth';
import { magasinSuiviMemoire } from '../../src/suivi/lecture.js';
import { magasinMemoire } from '../../src/compte/activites.js';
import type { ClientSuivi } from '../../src/suivi/envoi.js';
import type { Stockage } from '../../src/parcours/stockage.js';
import type { StockageLocal } from '../../src/compte/invitation.js';
import { fauxAuth } from '../compte/fauxAuth';

afterEach(() => cleanup());

function memoire(): Stockage & StockageLocal {
  const d = new Map<string, string>();
  return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => void d.set(k, v), removeItem: (k) => void d.delete(k) };
}
const client: ClientSuivi = { rpc: async () => ({ data: 24, error: null }) };

function monter(opts: { suiviActif: boolean; session?: boolean; enseignant?: boolean }) {
  window.history.replaceState(null, '', '/');
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  const rpc = async () => ({ data: opts.enseignant ?? false, error: null });
  render(
    <CalmProvider>
      <AuthProvider client={fauxAuth({ session: opts.session ? { id: 'u1', email: 'prof@ecole.be' } : null }).client}>
        <Parcours
          stockage={memoire()}
          rpc={rpc}
          stockageInvitation={memoire()}
          magasin={magasinMemoire()}
          stockageSuivi={memoire()}
          suiviActif={opts.suiviActif}
          suivi={client}
          magasinSuivi={magasinSuiviMemoire()}
        />
      </AuthProvider>
    </CalmProvider>,
  );
}

describe('Parcours, suivi par code derrière son interrupteur', () => {
  it('suivi inactif : aucun « Qui joue ? » ni « Mes classes »', async () => {
    monter({ suiviActif: false, session: true, enseignant: true });
    await userEvent.click(screen.getByRole('button', { name: 'Voir l’exemple des positions (P4)' }));
    expect(screen.queryByRole('button', { name: 'Associer cet appareil à une classe' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Mes classes' })).toBeNull();
  });

  it('suivi actif : l’exemple propose d’associer l’appareil à une classe, sans compte requis', async () => {
    monter({ suiviActif: true });
    await userEvent.click(screen.getByRole('button', { name: 'Voir l’exemple des positions (P4)' }));
    expect(screen.getByRole('button', { name: 'Associer cet appareil à une classe' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Mes classes' })).toBeNull();
  });

  it('suivi actif et enseignant connecté : « Mes classes » avec la création de classe', async () => {
    monter({ suiviActif: true, session: true, enseignant: true });
    expect(await screen.findByRole('region', { name: 'Mes classes' })).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Créer une classe')).toBeTruthy());
  });

  it('suivi actif et compte sans accès enseignant : le code d’invitation, pas la création', async () => {
    monter({ suiviActif: true, session: true, enseignant: false });
    expect(await screen.findByRole('region', { name: 'Mes classes' })).toBeTruthy();
    const resume = screen.getByText('Rejoindre la classe d’un collègue (lecture seule)');
    expect((resume.closest('details') as HTMLDetailsElement).open).toBe(true);
    expect(screen.getByLabelText('Code d’accès d’un collègue')).toBeTruthy();
    expect(screen.queryByText('Créer une classe')).toBeNull();
  });
});
