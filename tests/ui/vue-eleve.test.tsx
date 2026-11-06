// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VueEleve } from '../../src/ui/VueEleve';
import { CalmProvider } from '../../src/ui/CalmContext';
import { ecrireCache, type ClientPartage } from '../../src/partage/lecture.js';
import type { ClientSuivi } from '../../src/suivi/envoi.js';
import type { StockageLocal } from '../../src/compte/invitation.js';
import type { Groupe } from '../../src/partage/lien.js';

afterEach(() => cleanup());

const CODE = 'K7M2XQ9A';

const brouillon = () => ({
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
});
const reponse = (extra: Record<string, unknown> = {}) => ({ titre: 'Les positions', brouillon: brouillon(), mode: 'meme', profilDefaut: 'standard', classCode: 'ABCD2345', nbCodes: 24, ...extra });

function stockage(): StockageLocal & { donnees: Map<string, string> } {
  const donnees = new Map<string, string>();
  return { donnees, getItem: (k) => donnees.get(k) ?? null, setItem: (k, v) => void donnees.set(k, v), removeItem: (k) => void donnees.delete(k) };
}

type Appel = { nom: string; args: Record<string, unknown> };
function client(activite: () => Promise<{ data: unknown; error: { message: string } | null }>, profil: string | null = 'defi') {
  const appels: Appel[] = [];
  const c: ClientPartage & ClientSuivi = {
    async rpc(nom: string, args: Record<string, unknown>) {
      appels.push({ nom, args });
      if (nom === 'game_get_shared_activity') return activite();
      if (nom === 'game_profile_for') return { data: profil, error: null };
      if (nom === 'game_class_info') return { data: 24, error: null };
      return { data: 'ok', error: null };
    },
  };
  return { c, appels };
}

function monter(c: ClientPartage & ClientSuivi, s: StockageLocal, groupe: Groupe | null = null) {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  return render(
    <CalmProvider>
      <VueEleve code={CODE} groupe={groupe} client={c} stockage={s} />
    </CalmProvider>,
  );
}

describe('VueEleve, chargement', () => {
  it('ouvre l’activité, associe l’appareil à la classe et n’affiche jamais le contexte', async () => {
    const s = stockage();
    const { c, appels } = client(async () => ({ data: reponse(), error: null }));
    monter(c, s);
    expect(await screen.findByRole('heading', { name: 'Les positions' })).toBeTruthy();
    expect(screen.getByLabelText('Qui joue ?')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Activité partagée à la classe/);
    expect(JSON.parse(s.donnees.get('gameactif.classe.v1') ?? 'null')).toEqual({ code: 'ABCD2345', nbCodes: 24 });
    expect(appels[0]).toEqual({ nom: 'game_get_shared_activity', args: { p_code: CODE } });
  });

  it('un lien retiré affiche un message clair, sans page blanche', async () => {
    const { c } = client(async () => ({ data: null, error: null }));
    monter(c, stockage());
    expect(await screen.findByText('Cette activité n’est plus proposée.')).toBeTruthy();
  });

  it('un échec sans copie locale propose de réessayer, et le réessai ouvre l’activité', async () => {
    let n = 0;
    const { c } = client(async () => {
      n += 1;
      if (n === 1) throw new TypeError('Failed to fetch');
      return { data: reponse(), error: null };
    });
    monter(c, stockage());
    expect(await screen.findByText('L’activité n’a pas pu être chargée. Vérifiez la connexion et réessayez.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('heading', { name: 'Les positions' })).toBeTruthy();
  });

  it('hors connexion avec une copie locale : l’activité s’ouvre et le dit', async () => {
    const s = stockage();
    const { c: ok } = client(async () => ({ data: reponse(), error: null }));
    monter(ok, s);
    await screen.findByRole('heading', { name: 'Les positions' });
    cleanup();
    const { c } = client(async () => {
      throw new TypeError('Failed to fetch');
    });
    monter(c, s);
    expect(await screen.findByText(/Activité ouverte sans connexion/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Les positions' })).toBeTruthy();
  });

  it('une copie locale ouverte hors connexion ne casse pas quand le cache est écrit par le module', async () => {
    const s = stockage();
    ecrireCache(s, { code: CODE, titre: 'Les positions', brouillon: { ...brouillon() } as never, mode: 'meme', profilDefaut: 'standard', classCode: 'ABCD2345', nbCodes: 24 });
    const { c } = client(async () => {
      throw new TypeError('Failed to fetch');
    });
    monter(c, s);
    expect(await screen.findByRole('heading', { name: 'Les positions' })).toBeTruthy();
  });
});

describe('VueEleve, niveau de jeu selon le mode', () => {
  it('mode « même profil » : le profil par défaut de l’activité', async () => {
    const { c } = client(async () => ({ data: reponse({ mode: 'meme', profilDefaut: 'defi' }), error: null }));
    monter(c, stockage());
    expect(await screen.findByText('Niveau : Défi')).toBeTruthy();
  });

  it('mode « un lien par groupe » : le groupe du lien décide, sans groupe c’est le niveau du milieu', async () => {
    for (const [groupe, attendu] of [[1, 'Pas à pas'], [2, 'Équilibre'], [3, 'Défi'], [null, 'Équilibre']] as const) {
      cleanup();
      const { c } = client(async () => ({ data: reponse({ mode: 'groupes', profilDefaut: 'defi' }), error: null }));
      monter(c, stockage(), groupe);
      expect(await screen.findByText(`Niveau : ${attendu}`), String(groupe)).toBeTruthy();
    }
  });

  it('mode « par code » : choisir un code interroge la base et applique son profil', async () => {
    const { c, appels } = client(async () => ({ data: reponse({ mode: 'par-code', profilDefaut: 'soutien' }), error: null }), 'defi');
    monter(c, stockage());
    expect(await screen.findByText('Niveau : Pas à pas')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Qui joue ?'), { target: { value: 'E02' } });
    await waitFor(() => expect(screen.getByText('Niveau : Défi')).toBeTruthy());
    expect(appels.find((a) => a.nom === 'game_profile_for')?.args).toEqual({ p_class_code: 'ABCD2345', p_student_code: 'E02' });
  });

  it('n’affiche jamais le nom « Soutien » ni l’outillage de l’enseignant', async () => {
    const { c } = client(async () => ({ data: reponse({ mode: 'groupes' }), error: null }), 'soutien');
    monter(c, stockage(), 1);
    await screen.findByRole('heading', { name: 'Les positions' });
    expect(document.body.textContent).not.toMatch(/Soutien/);
    expect(screen.queryByLabelText('Profil')).toBeNull();
    expect(screen.queryByText('Autres jeux, avec votre IA')).toBeNull();
  });
});

void vi;
