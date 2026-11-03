import { vi } from 'vitest';
import type { AuthClient, Utilisateur } from '../../src/compte/auth';

type Ecouteur = (evenement: string, session: { user: Utilisateur } | null) => void;

/** Client d'authentification factice partagé par les tests de l'interface. */
export function fauxAuth(opts: { session?: Utilisateur | null; erreurConnexion?: string; erreurInscription?: string; inscriptionAvecSession?: boolean } = {}) {
  const ecouteurs: Ecouteur[] = [];
  const diffuser = (u: Utilisateur | null) => ecouteurs.forEach((cb) => cb('SIGNED_IN', u ? { user: u } : null));
  const brut = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: opts.session ? { user: opts.session } : null } })),
      onAuthStateChange: vi.fn((cb: Ecouteur) => {
        ecouteurs.push(cb);
        return { data: { subscription: { unsubscribe: () => {} } } };
      }),
      signInWithPassword: vi.fn(async (p: { email: string; password: string }) => {
        if (opts.erreurConnexion) return { error: { message: opts.erreurConnexion } };
        diffuser({ id: 'u1', email: p.email });
        return { error: null };
      }),
      signUp: vi.fn(async (p: { email: string }) => {
        if (opts.erreurInscription) return { data: { session: null }, error: { message: opts.erreurInscription } };
        if (opts.inscriptionAvecSession) {
          diffuser({ id: 'u2', email: p.email });
          return { data: { session: { user: { id: 'u2', email: p.email } } }, error: null };
        }
        return { data: { session: null }, error: null };
      }),
      signOut: vi.fn(async () => {
        diffuser(null);
        return { error: null };
      }),
    },
  };
  return { client: brut as unknown as AuthClient, brut };
}
