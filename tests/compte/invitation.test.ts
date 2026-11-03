import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  MESSAGE_INVITATION_INVALIDE,
  codeConserve,
  codePlausible,
  conserverCode,
  lireCodeDansAdresse,
  oublierCode,
  utiliserInvitation,
  type StockageLocal,
} from '../../src/compte/invitation.js';

afterEach(() => vi.restoreAllMocks());

const CODE = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345';

function memoire(): StockageLocal & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

describe('lireCodeDansAdresse', () => {
  it('extrait le code et rend une adresse sans le paramètre, en gardant les autres et le fragment', () => {
    const r = lireCodeDansAdresse(new URL(`https://gameactif.jfb4plai.com/?invitation=${CODE}&autre=1#haut`));
    expect(r.code).toBe(CODE);
    expect(r.urlNettoyee).toBe('/?autre=1#haut');
  });

  it('rend « / » quand le code était le seul paramètre', () => {
    expect(lireCodeDansAdresse(new URL(`https://x.be/?invitation=${CODE}`)).urlNettoyee).toBe('/');
  });

  it('sans paramètre, le code est nul et l’adresse est inchangée', () => {
    const r = lireCodeDansAdresse(new URL('https://x.be/chemin?a=1#f'));
    expect(r.code).toBeNull();
    expect(r.urlNettoyee).toBe('/chemin?a=1#f');
  });

  it('un code mal formé est rendu tel quel mais jamais reconnu comme plausible', () => {
    const r = lireCodeDansAdresse(new URL('https://x.be/?invitation=court'));
    expect(r.code).toBe('court');
    expect(codePlausible('court')).toBe(false);
    expect(r.urlNettoyee).toBe('/');
  });
});

describe('codePlausible', () => {
  it('accepte 32 caractères parmi A-Z a-z 0-9 _ -', () => {
    expect(codePlausible(CODE)).toBe(true);
    expect(codePlausible('A'.repeat(16) + '_-'.repeat(8))).toBe(true);
  });

  it('refuse trop court, trop long, espaces et caractères hors liste', () => {
    for (const mauvais of ['', CODE.slice(1), CODE + 'A', CODE.slice(0, 31) + ' ', CODE.slice(0, 31) + '/', CODE.slice(0, 31) + '+', ' ' + CODE.slice(1)]) {
      expect(codePlausible(mauvais)).toBe(false);
    }
  });
});

describe('conservation locale du code', () => {
  it('conserve, relit et oublie le code', () => {
    const s = memoire();
    conserverCode(s, CODE);
    expect(codeConserve(s)).toBe(CODE);
    oublierCode(s);
    expect(codeConserve(s)).toBeNull();
  });

  it('ne conserve pas un code mal formé', () => {
    const s = memoire();
    conserverCode(s, 'court');
    expect(s.data.size).toBe(0);
  });

  it('un contenu conservé mal formé n’est pas rendu', () => {
    const s = memoire();
    s.data.set('gameactif.invitation', '<script>');
    expect(codeConserve(s)).toBeNull();
  });

  it('un stockage absent, bloqué ou qui lève ne provoque aucune exception', () => {
    expect(() => conserverCode(null, CODE)).not.toThrow();
    expect(codeConserve(null)).toBeNull();
    expect(() => oublierCode(null)).not.toThrow();
    const casse: StockageLocal = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(() => conserverCode(casse, CODE)).not.toThrow();
    expect(codeConserve(casse)).toBeNull();
    expect(() => oublierCode(casse)).not.toThrow();
  });
});

describe('utiliserInvitation', () => {
  it('rend ok et deja selon la réponse du serveur, en appelant la bonne fonction avec le code', async () => {
    const rpc = vi.fn(async () => ({ data: 'ok', error: null }));
    expect(await utiliserInvitation(rpc, CODE)).toBe('ok');
    expect(rpc).toHaveBeenCalledWith('game_redeem_invitation', { code: CODE });
    expect(await utiliserInvitation(async () => ({ data: 'deja', error: null }), CODE)).toBe('deja');
  });

  it('toute autre réponse, même inattendue, est « invalide » (Review Focus 1)', async () => {
    for (const data of ['invalide', 'autre chose', '', null, undefined, 42, true, { ok: true }, ['ok']]) {
      expect(await utiliserInvitation(async () => ({ data, error: null }), CODE)).toBe('invalide');
    }
  });

  it('un code mal formé est refusé sans appeler le serveur', async () => {
    const rpc = vi.fn(async () => ({ data: 'ok', error: null }));
    expect(await utiliserInvitation(rpc, 'court')).toBe('invalide');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('un appel qui lève ou qui renvoie une erreur donne « reseau »', async () => {
    expect(
      await utiliserInvitation(async () => {
        throw new TypeError('Failed to fetch');
      }, CODE),
    ).toBe('reseau');
    expect(await utiliserInvitation(async () => ({ data: null, error: { message: 'boom' } }), CODE)).toBe('reseau');
  });

  it('n’écrit jamais le code dans la console, quelle que soit l’issue', async () => {
    const espions = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    await utiliserInvitation(async () => ({ data: 'ok', error: null }), CODE);
    await utiliserInvitation(async () => ({ data: 'invalide', error: null }), CODE);
    await utiliserInvitation(async () => ({ data: null, error: { message: 'boom' } }), CODE);
    await utiliserInvitation(async () => {
      throw new Error('boom');
    }, CODE);
    const appels = espions.flatMap((e) => e.mock.calls.flat().map(String));
    expect(appels.some((a) => a.includes(CODE))).toBe(false);
  });

  it('le message d’invitation invalide est celui du plan', () => {
    expect(MESSAGE_INVITATION_INVALIDE).toBe('Ce lien d’invitation n’est plus valable. Demandez-en un nouveau.');
  });
});
