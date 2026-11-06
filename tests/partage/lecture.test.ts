import { describe, it, expect } from 'vitest';
import { chargerActivite, ecrireCache, lireCache, profilPourCode, type ClientPartage } from '../../src/partage/lecture.js';
import { brouillonVide } from '../../src/atelier/brouillon.js';
import type { StockageLocal } from '../../src/compte/invitation.js';

const CODE = 'K7M2XQ9A';
const brouillon = () => ({ ...brouillonVide(), niveau: 'P4', matiere: 'mathematiques', cibles: ['M.P4.1.1.i1.a1'], titre: 'Les positions', contexte: 'Activité partagée à la classe' });
const reponse = (extra: Record<string, unknown> = {}) => ({ titre: 'Les positions', brouillon: brouillon(), mode: 'meme', profilDefaut: 'standard', classCode: 'ABCD2345', nbCodes: 24, ...extra });

function stockage(): StockageLocal & { donnees: Map<string, string> } {
  const donnees = new Map<string, string>();
  return { donnees, getItem: (k) => donnees.get(k) ?? null, setItem: (k, v) => void donnees.set(k, v), removeItem: (k) => void donnees.delete(k) };
}

type Appel = { nom: string; args: Record<string, unknown> };
function client(repondre: () => Promise<{ data: unknown; error: { message: string } | null }>) {
  const appels: Appel[] = [];
  const c: ClientPartage = {
    rpc(nom, args) {
      appels.push({ nom, args });
      return repondre();
    },
  };
  return { c, appels };
}

describe('chargerActivite', () => {
  it('lit une activité valide et la garde en cache', async () => {
    const s = stockage();
    const { c, appels } = client(async () => ({ data: reponse(), error: null }));
    const r = await chargerActivite(c, s, CODE);
    expect(r.etat).toBe('ok');
    if (r.etat === 'ok') {
      expect(r.depuisCache).toBe(false);
      expect(r.activite).toMatchObject({ code: CODE, titre: 'Les positions', mode: 'meme', profilDefaut: 'standard', classCode: 'ABCD2345', nbCodes: 24 });
    }
    expect(appels).toEqual([{ nom: 'game_get_shared_activity', args: { p_code: CODE } }]);
    expect(lireCache(s, CODE)?.titre).toBe('Les positions');
  });

  it('une réponse nulle : activité retirée, et le cache de ce code est effacé', async () => {
    const s = stockage();
    const { c: ok } = client(async () => ({ data: reponse(), error: null }));
    await chargerActivite(ok, s, CODE);
    const { c } = client(async () => ({ data: null, error: null }));
    expect(await chargerActivite(c, s, CODE)).toEqual({ etat: 'retiree' });
    expect(lireCache(s, CODE)).toBeNull();
  });

  it('un réseau qui tombe avec un cache valide ouvre l’activité depuis le cache', async () => {
    const s = stockage();
    const { c: ok } = client(async () => ({ data: reponse(), error: null }));
    await chargerActivite(ok, s, CODE);
    const { c } = client(async () => {
      throw new TypeError('Failed to fetch');
    });
    const r = await chargerActivite(c, s, CODE);
    expect(r.etat).toBe('ok');
    if (r.etat === 'ok') expect(r.depuisCache).toBe(true);
  });

  it('un réseau qui tombe sans cache : échec, sans lever', async () => {
    const { c } = client(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await chargerActivite(c, stockage(), CODE)).toEqual({ etat: 'echec' });
  });

  it('une erreur de la base se traite comme un réseau qui tombe', async () => {
    const { c } = client(async () => ({ data: null, error: { message: 'boom' } }));
    expect(await chargerActivite(c, stockage(), CODE)).toEqual({ etat: 'echec' });
  });

  it('une réponse dont la forme est invalide n’ouvre rien et ne lève pas', async () => {
    for (const data of [{ ...reponse(), brouillon: { x: 1 } }, reponse({ mode: 'x' }), reponse({ profilDefaut: 'x' }), reponse({ classCode: 'abc' }), reponse({ nbCodes: 99 }), 42, 'texte']) {
      const { c } = client(async () => ({ data, error: null }));
      expect(await chargerActivite(c, stockage(), CODE), JSON.stringify(data).slice(0, 40)).toEqual({ etat: 'echec' });
    }
  });

  it('un cache corrompu est ignoré sans planter', async () => {
    const s = stockage();
    s.setItem(`gameactif.partage.v1.${CODE}`, '{pas du json');
    expect(lireCache(s, CODE)).toBeNull();
    const { c } = client(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await chargerActivite(c, s, CODE)).toEqual({ etat: 'echec' });
  });

  it('ne contacte pas la base pour un code qui n’a pas la forme d’un code d’activité', async () => {
    const { c, appels } = client(async () => ({ data: reponse(), error: null }));
    expect(await chargerActivite(c, stockage(), 'abc')).toEqual({ etat: 'retiree' });
    expect(appels).toEqual([]);
  });

  it('un stockage absent ou qui refuse ne casse rien', async () => {
    const { c } = client(async () => ({ data: reponse(), error: null }));
    expect((await chargerActivite(c, null, CODE)).etat).toBe('ok');
    const casse: StockageLocal = {
      getItem: () => {
        throw new Error('refusé');
      },
      setItem: () => {
        throw new Error('refusé');
      },
      removeItem: () => {
        throw new Error('refusé');
      },
    };
    expect((await chargerActivite(c, casse, CODE)).etat).toBe('ok');
    expect(() => ecrireCache(casse, { code: CODE, titre: 't', brouillon: brouillon(), mode: 'meme', profilDefaut: 'standard', classCode: 'ABCD2345', nbCodes: 24 })).not.toThrow();
  });
});

describe('profilPourCode', () => {
  it('renvoie le profil donné par la base', async () => {
    const { c, appels } = client(async () => ({ data: 'soutien', error: null }));
    expect(await profilPourCode(c, 'ABCD2345', 'E07')).toBe('soutien');
    expect(appels).toEqual([{ nom: 'game_profile_for', args: { p_class_code: 'ABCD2345', p_student_code: 'E07' } }]);
  });

  it('renvoie null pour une réponse inattendue, une erreur ou un réseau qui tombe', async () => {
    expect(await profilPourCode(client(async () => ({ data: 'x', error: null })).c, 'ABCD2345', 'E07')).toBeNull();
    expect(await profilPourCode(client(async () => ({ data: null, error: { message: 'boom' } })).c, 'ABCD2345', 'E07')).toBeNull();
    expect(
      await profilPourCode(
        client(async () => {
          throw new TypeError('Failed to fetch');
        }).c,
        'ABCD2345',
        'E07',
      ),
    ).toBeNull();
  });

  it('ne contacte pas la base pour des codes mal formés', async () => {
    const { c, appels } = client(async () => ({ data: 'soutien', error: null }));
    expect(await profilPourCode(c, 'abc', 'E07')).toBeNull();
    expect(await profilPourCode(c, 'ABCD2345', 'Léa')).toBeNull();
    expect(appels).toEqual([]);
  });
});
