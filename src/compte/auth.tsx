import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getSupabase } from '../lib/supabase.js';

export interface Utilisateur {
  id: string;
  email?: string;
}

type Erreur = { message: string } | null;

/** Sous-ensemble de supabase.auth utilisé ici : permet d'injecter un client factice dans les tests. */
export interface AuthClient {
  auth: {
    getSession(): Promise<{ data: { session: { user: Utilisateur } | null } }>;
    onAuthStateChange(cb: (evenement: string, session: { user: Utilisateur } | null) => void): {
      data: { subscription: { unsubscribe(): void } };
    };
    signInWithPassword(p: { email: string; password: string }): Promise<{ error: Erreur }>;
    signUp(p: { email: string; password: string; options: { emailRedirectTo: string } }): Promise<{ data: { session: unknown | null }; error: Erreur }>;
    signOut(): Promise<{ error: Erreur }>;
  };
}

interface AuthValeur {
  user: Utilisateur | null;
  chargement: boolean;
  /** Faux quand l'application n'est pas configurée pour la connexion : le parcours anonyme reste utilisable. */
  disponible: boolean;
  seConnecter(email: string, mdp: string): Promise<void>;
  creerCompte(email: string, mdp: string): Promise<{ confirmationRequise: boolean }>;
  seDeconnecter(): Promise<void>;
}

const INDISPONIBLE = 'La connexion n’est pas disponible pour le moment.';

/** Messages français pour les erreurs courantes ; tout le reste devient un message générique, sans texte technique. */
export function traduireErreurAuth(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Adresse ou mot de passe incorrect.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Cette adresse a déjà un compte. Connectez-vous plutôt.';
  if (m.includes('password should be at least') || m.includes('weak password') || m.includes('password is too')) {
    return 'Le mot de passe est trop court ou trop simple. Essayez avec plus de caractères.';
  }
  if (m.includes('email not confirmed')) return 'Votre adresse n’est pas encore confirmée. Cliquez sur le lien du courriel reçu.';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes')) return 'Trop de tentatives. Attendez quelques minutes puis réessayez.';
  return 'La connexion n’a pas abouti. Réessayez dans un instant.';
}

const Contexte = createContext<AuthValeur | null>(null);

export function AuthProvider({ client, children }: { client?: AuthClient; children: ReactNode }) {
  const [user, setUser] = useState<Utilisateur | null>(null);
  const [chargement, setChargement] = useState(true);

  // Sans configuration, l'application reste utilisable : seules les actions de compte échouent.
  const c = useMemo<AuthClient | null>(() => {
    if (client) return client;
    try {
      return getSupabase() as unknown as AuthClient;
    } catch {
      return null;
    }
  }, [client]);

  useEffect(() => {
    if (!c) {
      setChargement(false);
      return;
    }
    let actif = true;
    void c.auth.getSession().then(({ data }) => {
      if (!actif) return;
      setUser(data.session?.user ?? null);
      setChargement(false);
    });
    const { data } = c.auth.onAuthStateChange((_evenement, session) => setUser(session?.user ?? null));
    return () => {
      actif = false;
      data.subscription.unsubscribe();
    };
  }, [c]);

  const exiger = (): AuthClient => {
    if (!c) throw new Error(INDISPONIBLE);
    return c;
  };

  const valeur: AuthValeur = {
    user,
    chargement,
    disponible: c !== null,
    async seConnecter(email, mdp) {
      const { error } = await exiger().auth.signInWithPassword({ email, password: mdp });
      if (error) throw new Error(traduireErreurAuth(error.message));
    },
    async creerCompte(email, mdp) {
      // Redirection explicite : sans elle, le lien du courriel peut renvoyer vers une autre app du projet partagé.
      const { data, error } = await exiger().auth.signUp({ email, password: mdp, options: { emailRedirectTo: `${window.location.origin}/` } });
      if (error) throw new Error(traduireErreurAuth(error.message));
      return { confirmationRequise: !data.session };
    },
    async seDeconnecter() {
      const { error } = await exiger().auth.signOut();
      if (error) throw new Error(traduireErreurAuth(error.message));
    },
  };

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useAuth(): AuthValeur {
  const v = useContext(Contexte);
  if (!v) throw new Error('useAuth doit être utilisé dans un AuthProvider.');
  return v;
}
