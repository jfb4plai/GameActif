// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth, traduireErreurAuth, type AuthClient, type Utilisateur } from '../../src/compte/auth';

afterEach(() => cleanup());

type Ecouteur = (evenement: string, session: { user: Utilisateur } | null) => void;

function fauxClient(opts: { session?: Utilisateur | null; erreurConnexion?: string; erreurInscription?: string; inscriptionAvecSession?: boolean } = {}) {
  const ecouteurs: Ecouteur[] = [];
  const unsubscribe = vi.fn();
  const diffuser = (u: Utilisateur | null) => ecouteurs.forEach((cb) => cb('SIGNED_IN', u ? { user: u } : null));
  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: opts.session ? { user: opts.session } : null } })),
      onAuthStateChange: vi.fn((cb: Ecouteur) => {
        ecouteurs.push(cb);
        return { data: { subscription: { unsubscribe } } };
      }),
      signInWithPassword: vi.fn(async (p: { email: string; password: string }) => {
        if (opts.erreurConnexion) return { error: { message: opts.erreurConnexion } };
        diffuser({ id: 'u1', email: p.email });
        return { error: null };
      }),
      signUp: vi.fn(async (p: { email: string }) => {
        if (opts.erreurInscription) return { data: { session: null }, error: { message: opts.erreurInscription } };
        return { data: { session: opts.inscriptionAvecSession ? { user: { id: 'u2', email: p.email } } : null }, error: null };
      }),
      signOut: vi.fn(async () => {
        diffuser(null);
        return { error: null };
      }),
    },
  };
  return { client: client as unknown as AuthClient, brut: client, unsubscribe };
}

const enveloppe = (client?: AuthClient) =>
  function Enveloppe({ children }: { children: ReactNode }) {
    return <AuthProvider client={client}>{children}</AuthProvider>;
  };

describe('AuthProvider', () => {
  it('sans client ni configuration, la connexion n’est pas disponible mais l’application reste utilisable', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: enveloppe(undefined) });
    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.disponible).toBe(false);
    expect(result.current.user).toBeNull();
    await expect(result.current.seConnecter('a@b.be', 'motdepasse')).rejects.toThrow('La connexion n’est pas disponible pour le moment.');
  });

  it('lit la session existante au démarrage', async () => {
    const { client } = fauxClient({ session: { id: 'u1', email: 'a@b.be' } });
    const { result } = renderHook(() => useAuth(), { wrapper: enveloppe(client) });
    await waitFor(() => expect(result.current.user).toEqual({ id: 'u1', email: 'a@b.be' }));
    expect(result.current.chargement).toBe(false);
    expect(result.current.disponible).toBe(true);
  });

  it('se connecter met l’utilisateur à jour', async () => {
    const { client, brut } = fauxClient();
    const { result } = renderHook(() => useAuth(), { wrapper: enveloppe(client) });
    await waitFor(() => expect(result.current.chargement).toBe(false));
    await act(async () => {
      await result.current.seConnecter('prof@ecole.be', 'unmotdepasse');
    });
    expect(brut.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'prof@ecole.be', password: 'unmotdepasse' });
    await waitFor(() => expect(result.current.user?.email).toBe('prof@ecole.be'));
  });

  it('traduit l’erreur du serveur lors de la connexion', async () => {
    const { client } = fauxClient({ erreurConnexion: 'Invalid login credentials' });
    const { result } = renderHook(() => useAuth(), { wrapper: enveloppe(client) });
    await waitFor(() => expect(result.current.chargement).toBe(false));
    await expect(result.current.seConnecter('a@b.be', 'x')).rejects.toThrow('Adresse ou mot de passe incorrect.');
  });

  it('créer un compte demande une redirection explicite vers GameActif et signale la confirmation par courriel', async () => {
    const { client, brut } = fauxClient();
    const { result } = renderHook(() => useAuth(), { wrapper: enveloppe(client) });
    await waitFor(() => expect(result.current.chargement).toBe(false));
    let sortie: { confirmationRequise: boolean } | undefined;
    await act(async () => {
      sortie = await result.current.creerCompte('nouveau@ecole.be', 'unmotdepasse');
    });
    expect(brut.auth.signUp).toHaveBeenCalledWith({
      email: 'nouveau@ecole.be',
      password: 'unmotdepasse',
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    expect(sortie).toEqual({ confirmationRequise: true });
  });

  it('créer un compte qui ouvre déjà une session ne demande pas de confirmation', async () => {
    const { client } = fauxClient({ inscriptionAvecSession: true });
    const { result } = renderHook(() => useAuth(), { wrapper: enveloppe(client) });
    await waitFor(() => expect(result.current.chargement).toBe(false));
    let sortie: { confirmationRequise: boolean } | undefined;
    await act(async () => {
      sortie = await result.current.creerCompte('a@b.be', 'unmotdepasse');
    });
    expect(sortie).toEqual({ confirmationRequise: false });
  });

  it('traduit l’erreur de création de compte', async () => {
    const { client } = fauxClient({ erreurInscription: 'User already registered' });
    const { result } = renderHook(() => useAuth(), { wrapper: enveloppe(client) });
    await waitFor(() => expect(result.current.chargement).toBe(false));
    await expect(result.current.creerCompte('a@b.be', 'unmotdepasse')).rejects.toThrow('Cette adresse a déjà un compte. Connectez-vous plutôt.');
  });

  it('se déconnecter vide l’utilisateur', async () => {
    const { client } = fauxClient({ session: { id: 'u1', email: 'a@b.be' } });
    const { result } = renderHook(() => useAuth(), { wrapper: enveloppe(client) });
    await waitFor(() => expect(result.current.user).not.toBeNull());
    await act(async () => {
      await result.current.seDeconnecter();
    });
    await waitFor(() => expect(result.current.user).toBeNull());
  });

  it('se désabonne au démontage', async () => {
    const { client, unsubscribe } = fauxClient();
    const { unmount, result } = renderHook(() => useAuth(), { wrapper: enveloppe(client) });
    await waitFor(() => expect(result.current.chargement).toBe(false));
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});

describe('traduireErreurAuth', () => {
  it('traduit les cinq cas courants', () => {
    expect(traduireErreurAuth('Invalid login credentials')).toBe('Adresse ou mot de passe incorrect.');
    expect(traduireErreurAuth('User already registered')).toBe('Cette adresse a déjà un compte. Connectez-vous plutôt.');
    expect(traduireErreurAuth('Password should be at least 6 characters')).toBe('Le mot de passe est trop court ou trop simple. Essayez avec plus de caractères.');
    expect(traduireErreurAuth('Email not confirmed')).toBe('Votre adresse n’est pas encore confirmée. Cliquez sur le lien du courriel reçu.');
    expect(traduireErreurAuth('email rate limit exceeded')).toBe('Trop de tentatives. Attendez quelques minutes puis réessayez.');
  });

  it('ne laisse jamais passer un texte anglais ou technique inconnu', () => {
    const msg = traduireErreurAuth('FetchError: ECONNRESET at 10.0.0.1 {"code":500}');
    expect(msg).toBe('La connexion n’a pas abouti. Réessayez dans un instant.');
    expect(msg).not.toMatch(/Fetch|ECONN|500/);
  });
});
