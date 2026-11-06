import { describe, it, expect } from 'vitest';
import { chercherClasse, envoyerSession, MESSAGES_ENVOI, type ClientSuivi } from '../../src/suivi/envoi.js';
import type { SessionPayload } from '../../src/suivi/types.js';

const payload: SessionPayload = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  mechanic: 'trier',
  profile: 'standard',
  cibles: ['M.P4.1.1.i1.a1'],
  totalElements: 1,
  endedAt: '2026-11-12T10:00:00.000Z',
  labels: { devant: 'devant' },
  results: [{ elementId: 'e1', mechanic: 'trier', firstTry: true, tries: 1, hintUsed: false, revealed: false, wrongChoices: [], correct: 'devant' }],
};

type Appel = { nom: string; args: Record<string, unknown> };

function client(reponse: () => Promise<{ data: unknown; error: { message: string } | null }>): ClientSuivi & { appels: Appel[] } {
  const appels: Appel[] = [];
  return {
    appels,
    rpc(nom, args) {
      appels.push({ nom, args });
      return reponse();
    },
  };
}

describe('envoyerSession', () => {
  it('renvoie « ok » quand la base répond ok, et n’envoie que le code de classe, le code élève et la séance', async () => {
    const c = client(async () => ({ data: 'ok', error: null }));
    expect(await envoyerSession(c, 'ABCD2345', 'E07', payload)).toBe('ok');
    expect(c.appels).toEqual([{ nom: 'game_record_session', args: { p_class_code: 'ABCD2345', p_student_code: 'E07', p_payload: payload } }]);
  });

  it('renvoie « limite » et « invalide » tels quels', async () => {
    expect(await envoyerSession(client(async () => ({ data: 'limite', error: null })), 'ABCD2345', 'E07', payload)).toBe('limite');
    expect(await envoyerSession(client(async () => ({ data: 'invalide', error: null })), 'ABCD2345', 'E07', payload)).toBe('invalide');
  });

  it('renvoie « echec » sans lever quand le réseau tombe, quand la base répond une erreur ou une valeur inattendue', async () => {
    expect(
      await envoyerSession(
        client(async () => {
          throw new TypeError('Failed to fetch');
        }),
        'ABCD2345',
        'E07',
        payload,
      ),
    ).toBe('echec');
    expect(await envoyerSession(client(async () => ({ data: null, error: { message: 'boom' } })), 'ABCD2345', 'E07', payload)).toBe('echec');
    expect(await envoyerSession(client(async () => ({ data: 42, error: null })), 'ABCD2345', 'E07', payload)).toBe('echec');
  });

  it('a un message en français, sans détail technique, pour chaque résultat', () => {
    for (const r of ['ok', 'invalide', 'limite', 'echec'] as const) {
      expect(MESSAGES_ENVOI[r].length).toBeGreaterThan(10);
      expect(MESSAGES_ENVOI[r]).not.toMatch(/fetch|supabase|postgres|rpc|http/i);
    }
    expect(MESSAGES_ENVOI.echec).toContain('Le jeu reste jouable');
  });
});

describe('chercherClasse', () => {
  it('renvoie la classe quand la base donne un nombre de codes', async () => {
    const c = client(async () => ({ data: 24, error: null }));
    expect(await chercherClasse(c, 'ABCD2345')).toEqual({ code: 'ABCD2345', nbCodes: 24 });
    expect(c.appels).toEqual([{ nom: 'game_class_info', args: { p_class_code: 'ABCD2345' } }]);
  });

  it('renvoie null pour un code inconnu, une erreur, un réseau qui tombe ou un nombre hors limites', async () => {
    expect(await chercherClasse(client(async () => ({ data: null, error: null })), 'ABCD2345')).toBeNull();
    expect(await chercherClasse(client(async () => ({ data: null, error: { message: 'boom' } })), 'ABCD2345')).toBeNull();
    expect(
      await chercherClasse(
        client(async () => {
          throw new TypeError('Failed to fetch');
        }),
        'ABCD2345',
      ),
    ).toBeNull();
    expect(await chercherClasse(client(async () => ({ data: 99, error: null })), 'ABCD2345')).toBeNull();
  });

  it('ne contacte pas la base pour un code qui n’a pas la forme d’un code de classe', async () => {
    const c = client(async () => ({ data: 24, error: null }));
    expect(await chercherClasse(c, 'abc')).toBeNull();
    expect(c.appels).toEqual([]);
  });
});
