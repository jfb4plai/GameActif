// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActivityScreen } from '../../src/ui/ActivityScreen';
import { CalmProvider } from '../../src/ui/CalmContext';
import type { ClientSuivi } from '../../src/suivi/envoi.js';
import type { StockageLocal } from '../../src/compte/invitation.js';
import type { ProfileId } from '../../src/engine/types.js';
import { qcmActivity } from '../fixtures.js';

afterEach(() => cleanup());

const activite = () => ({ ...qcmActivity(), cibles: ['M.P4.1.1.i1.a1'] });

function stockage(): StockageLocal {
  const d = new Map<string, string>([['gameactif.classe.v1', JSON.stringify({ code: 'ABCD2345', nbCodes: 24 })]]);
  return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => void d.set(k, v), removeItem: (k) => void d.delete(k) };
}

type Payload = { profile: string; above: boolean; cibles: string[] };
function client() {
  const envois: { code: string; payload: Payload }[] = [];
  const c: ClientSuivi = {
    async rpc(nom, args) {
      if (nom === 'game_record_session') envois.push({ code: String(args.p_student_code), payload: args.p_payload as Payload });
      return { data: nom === 'game_record_session' ? 'ok' : 24, error: null };
    },
  };
  return { c, envois };
}

function monter(eleve: { profilDepart: ProfileId; resoudreProfil?: (code: string) => Promise<ProfileId | null> }) {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  const { c, envois } = client();
  render(
    <CalmProvider>
      <ActivityScreen activity={activite()} suivi={c} stockage={stockage()} eleve={eleve} />
    </CalmProvider>,
  );
  return { envois };
}

/** Termine le tour en cours : une mauvaise réponse d'abord, puis les bonnes. */
async function finirTour() {
  let premier = true;
  for (let i = 0; i < 14 && !screen.queryByText(/Tour terminé/); i++) {
    if (premier) {
      premier = false;
      const fausse = screen.queryAllByRole('button', { name: /fausse/ })[0];
      if (fausse) await userEvent.click(fausse);
    }
    const bonne = screen.queryByRole('button', { name: /^Bonne réponse \d$/ });
    if (bonne) await userEvent.click(bonne);
  }
  await screen.findByText(/Tour terminé/);
}
const jouerQcm = () => userEvent.click(screen.getByRole('button', { name: 'Jouer : QCM libre' }));
const choisirCode = (code: string) => fireEvent.change(screen.getByLabelText('Qui joue ?'), { target: { value: code } });

describe('ActivityScreen, vue élève', () => {
  it('masque tout l’outillage de l’enseignant et garde « Qui joue ? » et les jeux sur écran', () => {
    monter({ profilDepart: 'standard' });
    expect(screen.queryByLabelText('Profil')).toBeNull();
    expect(screen.queryByLabelText('Nombre d’élèves')).toBeNull();
    expect(screen.queryByText('Autres jeux, avec votre IA')).toBeNull();
    expect(screen.queryByRole('heading', { name: /En classe, sans écran/ })).toBeNull();
    expect(screen.getByLabelText('Qui joue ?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Jouer : QCM libre' })).toBeTruthy();
  });

  it('joue au profil de départ, annonce un nom neutre et n’affiche jamais « Soutien »', async () => {
    const { envois } = monter({ profilDepart: 'soutien' });
    choisirCode('E02');
    await jouerQcm();
    await finirTour();
    expect(envois).toHaveLength(1);
    expect(envois[0].payload).toMatchObject({ profile: 'soutien', above: false });
    expect(document.body.textContent).not.toMatch(/Soutien/);
    expect(document.body.textContent).toMatch(/Pas à pas/);
  });

  it('propose de rejouer un niveau au-dessus : le tour suivant est joué au niveau suivant, marqué « above », sous le même code', async () => {
    const { envois } = monter({ profilDepart: 'soutien' });
    choisirCode('E02');
    await jouerQcm();
    await finirTour();
    await userEvent.click(screen.getByRole('button', { name: 'Rejouer un niveau au-dessus' }));
    expect(document.body.textContent).toMatch(/Équilibre/);
    await finirTour();
    await waitFor(() => expect(envois).toHaveLength(2));
    expect(envois[1].code).toBe('E02');
    expect(envois[1].payload).toMatchObject({ profile: 'standard', above: true });
  });

  it('au niveau le plus haut, aucun bouton de dépassement', async () => {
    monter({ profilDepart: 'defi' });
    choisirCode('E02');
    await jouerQcm();
    await finirTour();
    expect(screen.queryByRole('button', { name: 'Rejouer un niveau au-dessus' })).toBeNull();
  });

  it('le code revient à « Jouer sans enregistrer » après le tour, et le tour suivant sans code repart du niveau de départ', async () => {
    const { envois } = monter({ profilDepart: 'soutien' });
    choisirCode('E02');
    await jouerQcm();
    await finirTour();
    await userEvent.click(screen.getByRole('button', { name: 'Rejouer un niveau au-dessus' }));
    await finirTour();
    await waitFor(() => expect(envois).toHaveLength(2));
    expect((screen.getByLabelText('Qui joue ?') as HTMLSelectElement).value).toBe('');
    await userEvent.click(screen.getByRole('button', { name: 'Fermer le jeu' }));
    await jouerQcm();
    expect(document.body.textContent).toMatch(/Pas à pas/);
    await finirTour();
    expect(envois).toHaveLength(2);
  });

  it('mode « par code » : le profil du code choisi décide du niveau joué', async () => {
    const resoudreProfil = vi.fn(async () => 'defi' as ProfileId);
    const { envois } = monter({ profilDepart: 'soutien', resoudreProfil });
    choisirCode('E02');
    await waitFor(() => expect(resoudreProfil).toHaveBeenCalledWith('E02'));
    await jouerQcm();
    await finirTour();
    expect(envois[0].payload).toMatchObject({ profile: 'defi', above: false });
    expect(screen.queryByRole('button', { name: 'Rejouer un niveau au-dessus' })).toBeNull();
  });

  it('mode « par code » : une réponse nulle ou une erreur laisse le niveau de départ et le dit', async () => {
    for (const resoudre of [async () => null, async () => Promise.reject(new Error('réseau'))]) {
      cleanup();
      const { envois } = monter({ profilDepart: 'soutien', resoudreProfil: resoudre });
      choisirCode('E02');
      expect(await screen.findByText(/Niveau par défaut/)).toBeTruthy();
      await jouerQcm();
      await finirTour();
      expect(envois[0].payload.profile).toBe('soutien');
    }
  });

  it('sans la propriété eleve, rien ne change : le profil et les fiches sont là', () => {
    window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    render(
      <CalmProvider>
        <ActivityScreen activity={activite()} />
      </CalmProvider>,
    );
    expect(screen.getByLabelText('Profil')).toBeTruthy();
    expect(screen.getByText('Autres jeux, avec votre IA')).toBeTruthy();
  });
});
