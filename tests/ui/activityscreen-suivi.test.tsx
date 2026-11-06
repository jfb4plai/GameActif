// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActivityScreen } from '../../src/ui/ActivityScreen';
import { CalmProvider } from '../../src/ui/CalmContext';
import { MESSAGES_ENVOI, type ClientSuivi } from '../../src/suivi/envoi.js';
import type { StockageLocal } from '../../src/compte/invitation.js';
import { qcmActivity } from '../fixtures.js';

afterEach(() => cleanup());

const activite = () => ({ ...qcmActivity(), cibles: ['M.P4.1.1.i1.a1'] });

function stockage(classe: boolean): StockageLocal {
  const d = new Map<string, string>();
  if (classe) d.set('gameactif.classe.v1', JSON.stringify({ code: 'ABCD2345', nbCodes: 24 }));
  return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => void d.set(k, v), removeItem: (k) => void d.delete(k) };
}

type Appel = { nom: string; args: Record<string, unknown> };
function client(reponse: () => Promise<{ data: unknown; error: { message: string } | null }>) {
  const appels: Appel[] = [];
  const c: ClientSuivi = {
    rpc(nom, args) {
      appels.push({ nom, args });
      return reponse();
    },
  };
  return { c, appels };
}

function monter(suivi?: ClientSuivi, avecClasse = true) {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  render(
    <CalmProvider>
      <ActivityScreen activity={activite()} suivi={suivi} stockage={stockage(avecClasse)} />
    </CalmProvider>,
  );
}

/** Joue un tour de QCM jusqu'au bout ; la première question reçoit d'abord une mauvaise réponse. */
async function jouerUnTour() {
  await userEvent.click(screen.getByRole('button', { name: 'Jouer : QCM libre' }));
  let premier = true;
  for (let i = 0; i < 12 && !screen.queryByText(/Tour terminé/); i++) {
    if (premier) {
      premier = false;
      await userEvent.click(screen.getAllByRole('button', { name: /fausse/ })[0]);
    }
    const bonne = screen.queryByRole('button', { name: /^Bonne réponse \d$/ });
    if (bonne) await userEvent.click(bonne);
  }
  await screen.findByText(/Tour terminé/);
}

describe('ActivityScreen, suivi par code', () => {
  it('envoie une fois la séance sous le code choisi, avec les attendus de l’activité, puis revient à « Jouer sans enregistrer »', async () => {
    const { c, appels } = client(async () => ({ data: 'ok', error: null }));
    monter(c);
    await userEvent.selectOptions(screen.getByLabelText('Qui joue ?'), 'E02');
    await jouerUnTour();
    const envois = appels.filter((a) => a.nom === 'game_record_session');
    expect(envois).toHaveLength(1);
    expect(envois[0].args.p_class_code).toBe('ABCD2345');
    expect(envois[0].args.p_student_code).toBe('E02');
    const payload = envois[0].args.p_payload as { cibles: string[]; mechanic: string; results: { wrongChoices: string[] }[]; sessionId: string };
    expect(payload.cibles).toEqual(['M.P4.1.1.i1.a1']);
    expect(payload.mechanic).toBe('qcm');
    expect(payload.results[0].wrongChoices).toHaveLength(1);
    expect(payload.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect((screen.getByLabelText('Qui joue ?') as HTMLSelectElement).value).toBe('');
    expect(await screen.findByText(MESSAGES_ENVOI.ok)).toBeTruthy();
  });

  it('le résultat de l’envoi s’affiche sous le plateau, là où le tour se termine', async () => {
    const { c } = client(async () => ({ data: 'ok', error: null }));
    monter(c);
    await userEvent.selectOptions(screen.getByLabelText('Qui joue ?'), 'E02');
    await jouerUnTour();
    const message = await screen.findByText(MESSAGES_ENVOI.ok);
    expect(message.closest('.jeu-en-cours')).not.toBeNull();
    expect(screen.getAllByText(MESSAGES_ENVOI.ok)).toHaveLength(1);
  });

  it('n’envoie rien pour un tour joué sans enregistrer', async () => {
    const { c, appels } = client(async () => ({ data: 'ok', error: null }));
    monter(c);
    await jouerUnTour();
    expect(appels.filter((a) => a.nom === 'game_record_session')).toHaveLength(0);
  });

  it('un envoi qui échoue affiche le message et laisse le tour affiché', async () => {
    const { c } = client(async () => {
      throw new TypeError('Failed to fetch');
    });
    monter(c);
    await userEvent.selectOptions(screen.getByLabelText('Qui joue ?'), 'E05');
    await jouerUnTour();
    expect(await screen.findByText(MESSAGES_ENVOI.echec)).toBeTruthy();
    expect(screen.getByText(/Tour terminé/)).toBeTruthy();
  });

  it('sans la propriété suivi, aucun élément « Qui joue ? » et le jeu fonctionne comme avant', async () => {
    monter(undefined);
    expect(screen.queryByLabelText('Qui joue ?')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Associer cet appareil à une classe' })).toBeNull();
    await jouerUnTour();
  });

  it('sans classe associée, propose d’associer l’appareil et n’envoie rien', async () => {
    const { c, appels } = client(async () => ({ data: 'ok', error: null }));
    monter(c, false);
    expect(screen.getByRole('button', { name: 'Associer cet appareil à une classe' })).toBeTruthy();
    await jouerUnTour();
    expect(appels).toHaveLength(0);
  });

  it('associe l’appareil à une classe reconnue puis propose les codes', async () => {
    const { c, appels } = client(async () => ({ data: 12, error: null }));
    monter(c, false);
    await userEvent.click(screen.getByRole('button', { name: 'Associer cet appareil à une classe' }));
    await userEvent.type(screen.getByLabelText('Code de la classe'), 'ABCD2345');
    await userEvent.click(screen.getByRole('button', { name: 'Associer' }));
    const liste = (await screen.findByLabelText('Qui joue ?')) as HTMLSelectElement;
    expect(liste.options.length).toBe(13);
    expect(appels[0]).toEqual({ nom: 'game_class_info', args: { p_class_code: 'ABCD2345' } });
  });
});

void vi;
