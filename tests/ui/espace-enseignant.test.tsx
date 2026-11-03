// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../../src/compte/auth';
import { EspaceEnseignant, type EtatAcces } from '../../src/ui/EspaceEnseignant';
import type { StockageLocal } from '../../src/compte/invitation';
import { MESSAGE_INVITATION_INVALIDE } from '../../src/compte/invitation';
import { fauxAuth } from '../compte/fauxAuth';

afterEach(() => cleanup());

const CODE = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345';
const CLE = 'gameactif.invitation';

function memoire(): StockageLocal & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

type Reponse = { data: unknown; error: unknown };
function fauxRpc(reponses: { estEnseignant?: boolean | 'erreur'; redeem?: string | 'erreur-reseau' } = {}) {
  return vi.fn(async (nom: string): Promise<Reponse> => {
    if (nom === 'game_is_teacher') {
      return reponses.estEnseignant === 'erreur' ? { data: null, error: { message: 'boom' } } : { data: reponses.estEnseignant ?? false, error: null };
    }
    if (nom === 'game_redeem_invitation') {
      if (reponses.redeem === 'erreur-reseau') return { data: null, error: { message: 'boom' } };
      return { data: reponses.redeem ?? 'ok', error: null };
    }
    return { data: null, error: { message: 'inconnu' } };
  });
}

interface Options {
  auth?: Parameters<typeof fauxAuth>[0];
  rpc?: ReturnType<typeof fauxRpc>;
  url?: string;
  stockage?: StockageLocal | null;
  sansClient?: boolean;
}

function monter(o: Options = {}) {
  const f = fauxAuth(o.auth);
  const rpc = o.rpc ?? fauxRpc();
  const stockage = o.stockage === undefined ? memoire() : o.stockage;
  const remplacerAdresse = vi.fn();
  const etats: EtatAcces[] = [];
  render(
    <AuthProvider client={o.sansClient ? undefined : f.client}>
      <EspaceEnseignant
        rpc={rpc}
        stockage={stockage}
        adresse={() => new URL(o.url ?? 'https://gameactif.jfb4plai.com/')}
        remplacerAdresse={remplacerAdresse}
        onAcces={(e) => etats.push(e)}
      />
    </AuthProvider>,
  );
  return { f, rpc, stockage, remplacerAdresse, etats };
}

const champEmail = () => screen.getByLabelText('Adresse e-mail') as HTMLInputElement;
const champMdp = () => screen.getByLabelText('Mot de passe') as HTMLInputElement;
async function saisir(email = 'prof@ecole.be', mdp = 'un-mot-de-passe-long') {
  await userEvent.type(champEmail(), email);
  await userEvent.type(champMdp(), mdp);
}
const dernier = (etats: EtatAcces[]) => etats[etats.length - 1];

describe('EspaceEnseignant, configuration et formulaires', () => {
  it('sans configuration, dit que la connexion n’est pas disponible', async () => {
    const { etats } = monter({ sansClient: true });
    await waitFor(() => expect(screen.getByText('La connexion n’est pas disponible pour le moment.')).toBeTruthy());
    expect(dernier(etats)).toBe('indisponible');
  });

  it('le formulaire de connexion guide chaque champ : label, exemple réel, aide reliée', async () => {
    monter();
    await waitFor(() => expect(champEmail()).toBeTruthy());
    expect(champEmail().placeholder).toBe('Exemple : prenom.nom@ecole.be');
    const aideEmail = document.getElementById(champEmail().getAttribute('aria-describedby') as string) as HTMLElement;
    expect(aideEmail.textContent).toContain('jamais demandée aux élèves');
    expect(champMdp().type).toBe('password');
    expect(champMdp().placeholder.length).toBeGreaterThan(5);
    const aideMdp = document.getElementById(champMdp().getAttribute('aria-describedby') as string) as HTMLElement;
    expect(aideMdp.textContent).toContain('nulle part ailleurs');
  });

  it('sans invitation, pas de création de compte : explique comment en obtenir un', async () => {
    monter();
    await waitFor(() => expect(champEmail()).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Créer mon compte' })).toBeNull();
    expect(screen.getByText('Pour créer un compte, ouvrez le lien d’invitation que vous avez reçu.')).toBeTruthy();
  });
});

describe('EspaceEnseignant, lien d’invitation', () => {
  it('avec un code dans l’adresse : formulaire de création, adresse nettoyée, code conservé', async () => {
    const { remplacerAdresse, stockage } = monter({ url: `https://gameactif.jfb4plai.com/?invitation=${CODE}&x=1` });
    await waitFor(() => expect(screen.getByText('Vous avez reçu une invitation à GameActif.')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Créer mon compte' })).toBeTruthy();
    expect(remplacerAdresse).toHaveBeenCalledWith('/?x=1');
    expect((stockage as ReturnType<typeof memoire>).data.get(CLE)).toBe(CODE);
  });

  it('« J’ai déjà un compte » bascule vers la connexion', async () => {
    monter({ url: `https://gameactif.jfb4plai.com/?invitation=${CODE}` });
    await waitFor(() => screen.getByRole('button', { name: 'J’ai déjà un compte' }));
    await userEvent.click(screen.getByRole('button', { name: 'J’ai déjà un compte' }));
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeTruthy();
  });

  it('un code mal formé dans l’adresse affiche le message d’invitation invalide et ne crée rien', async () => {
    const { stockage } = monter({ url: 'https://gameactif.jfb4plai.com/?invitation=court' });
    await waitFor(() => expect(screen.getByText(MESSAGE_INVITATION_INVALIDE)).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Créer mon compte' })).toBeNull();
    expect((stockage as ReturnType<typeof memoire>).data.size).toBe(0);
  });

  it('créer un compte demande la confirmation par courriel et garde le code', async () => {
    const { f, stockage, etats } = monter({ url: `https://gameactif.jfb4plai.com/?invitation=${CODE}` });
    await waitFor(() => screen.getByRole('button', { name: 'Créer mon compte' }));
    await saisir('nouveau@ecole.be', 'mot-de-passe-solide');
    await userEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }));
    await waitFor(() =>
      expect(screen.getByText('Un courriel de confirmation vient de vous être envoyé. Cliquez sur le lien qu’il contient, puis revenez vous connecter.')).toBeTruthy(),
    );
    expect(f.brut.auth.signUp).toHaveBeenCalledTimes(1);
    expect((stockage as ReturnType<typeof memoire>).data.get(CLE)).toBe(CODE);
    expect(dernier(etats)).toBe('anonyme');
  });
});

describe('EspaceEnseignant, accès après connexion', () => {
  it('un compte sans invitation est connecté mais n’a pas accès (Review Focus 2) : aucun code utilisé', async () => {
    const rpc = fauxRpc({ estEnseignant: false });
    const { etats } = monter({ rpc });
    await waitFor(() => champEmail());
    await saisir();
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    await waitFor(() => expect(screen.getByText('Ce compte n’a pas encore accès à GameActif. Ouvrez le lien d’invitation que vous avez reçu.')).toBeTruthy());
    expect(rpc).not.toHaveBeenCalledWith('game_redeem_invitation', expect.anything());
    expect(rpc).toHaveBeenCalledWith('game_is_teacher', expect.anything());
    expect(dernier(etats)).toBe('sans-acces');
  });

  it('un enseignant déjà inscrit qui se connecte sans lien obtient l’accès', async () => {
    const { etats } = monter({ rpc: fauxRpc({ estEnseignant: true }) });
    await waitFor(() => champEmail());
    await saisir();
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    await waitFor(() => expect(dernier(etats)).toBe('enseignant'));
    expect(screen.getByText(/Connecté : prof@ecole\.be/)).toBeTruthy();
  });

  it('avec un code conservé valide : le code est utilisé une fois, oublié, et l’accès s’ouvre', async () => {
    const stockage = memoire();
    stockage.data.set(CLE, CODE);
    const rpc = fauxRpc({ redeem: 'ok' });
    const { etats } = monter({ rpc, stockage });
    await waitFor(() => champEmail());
    await saisir();
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    await waitFor(() => expect(dernier(etats)).toBe('enseignant'));
    const appels = rpc.mock.calls.filter((c) => c[0] === 'game_redeem_invitation');
    expect(appels).toHaveLength(1);
    expect(stockage.data.has(CLE)).toBe(false);
  });

  it('retour de la confirmation par courriel : session déjà ouverte et code conservé, l’accès s’ouvre', async () => {
    const stockage = memoire();
    stockage.data.set(CLE, CODE);
    const { etats } = monter({ auth: { session: { id: 'u1', email: 'prof@ecole.be' } }, rpc: fauxRpc({ redeem: 'ok' }), stockage });
    await waitFor(() => expect(dernier(etats)).toBe('enseignant'));
    expect(stockage.data.has(CLE)).toBe(false);
  });

  it('code invalide : message du plan, code oublié, pas d’accès (Review Focus 1)', async () => {
    const stockage = memoire();
    stockage.data.set(CLE, CODE);
    const { etats } = monter({ auth: { session: { id: 'u1', email: 'a@b.be' } }, rpc: fauxRpc({ redeem: 'invalide', estEnseignant: false }), stockage });
    await waitFor(() => expect(screen.getByText(MESSAGE_INVITATION_INVALIDE)).toBeTruthy());
    expect(stockage.data.has(CLE)).toBe(false);
    expect(dernier(etats)).toBe('sans-acces');
  });

  it('erreur réseau : message de réessai, code conservé, « Réessayer » relance', async () => {
    const stockage = memoire();
    stockage.data.set(CLE, CODE);
    const rpc = fauxRpc({ redeem: 'erreur-reseau' });
    const { etats } = monter({ auth: { session: { id: 'u1', email: 'a@b.be' } }, rpc, stockage });
    await waitFor(() => expect(screen.getByText('La vérification de votre accès n’a pas abouti. Réessayez.')).toBeTruthy());
    expect(stockage.data.get(CLE)).toBe(CODE);
    expect(dernier(etats)).toBe('sans-acces');
    rpc.mockImplementation(async (nom: string) => (nom === 'game_redeem_invitation' ? { data: 'ok', error: null } : { data: true, error: null }));
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(dernier(etats)).toBe('enseignant'));
    expect(stockage.data.has(CLE)).toBe(false);
  });

  it('une erreur de vérification d’accès sans code est signalée sans donner l’accès', async () => {
    const { etats } = monter({ auth: { session: { id: 'u1', email: 'a@b.be' } }, rpc: fauxRpc({ estEnseignant: 'erreur' }) });
    await waitFor(() => expect(screen.getByText('La vérification de votre accès n’a pas abouti. Réessayez.')).toBeTruthy());
    expect(dernier(etats)).toBe('sans-acces');
  });
});

describe('EspaceEnseignant, erreurs et sécurité', () => {
  it('affiche en français une erreur d’authentification', async () => {
    monter({ auth: { erreurConnexion: 'Invalid login credentials' } });
    await waitFor(() => champEmail());
    await saisir();
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    await waitFor(() => expect(screen.getByText('Adresse ou mot de passe incorrect.')).toBeTruthy());
  });

  it('se déconnecter rend l’état anonyme', async () => {
    const { etats } = monter({ auth: { session: { id: 'u1', email: 'a@b.be' } }, rpc: fauxRpc({ estEnseignant: true }) });
    await waitFor(() => expect(dernier(etats)).toBe('enseignant'));
    await userEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    await waitFor(() => expect(dernier(etats)).toBe('anonyme'));
    expect(champEmail().value).toBe('');
  });

  it('le mot de passe ne reste ni dans la page ni dans le stockage après la connexion', async () => {
    const stockage = memoire();
    monter({ rpc: fauxRpc({ estEnseignant: true }), stockage });
    await waitFor(() => champEmail());
    await saisir('prof@ecole.be', 'motdepasse-secret-42');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    await waitFor(() => screen.getByText(/Connecté :/));
    expect(document.body.innerHTML).not.toContain('motdepasse-secret-42');
    expect([...stockage.data.values()].join('')).not.toContain('motdepasse-secret-42');
  });

  it('n’écrit ni le code ni le mot de passe dans la console', async () => {
    const espions = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const stockage = memoire();
    stockage.data.set(CLE, CODE);
    monter({ rpc: fauxRpc({ redeem: 'ok' }), stockage });
    await waitFor(() => champEmail());
    await saisir('prof@ecole.be', 'motdepasse-secret-42');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    await waitFor(() => screen.getByText(/Connecté :/));
    const tout = espions.flatMap((e) => e.mock.calls.flat().map(String)).join(' ');
    expect(tout).not.toContain(CODE);
    expect(tout).not.toContain('motdepasse-secret-42');
    vi.restoreAllMocks();
  });
});
