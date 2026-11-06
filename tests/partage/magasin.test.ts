import { describe, it, expect } from 'vitest';
import { ErreurPartage, magasinPartageMemoire, magasinPartageSupabase, type ClientPartageEcriture, type RequetePartage } from '../../src/partage/magasin.js';
import { ErreurStockage } from '../../src/compte/activites.js';
import { brouillonVide } from '../../src/atelier/brouillon.js';

type Resultat = { data: unknown; error: { message: string; code?: string } | null };
interface Appel {
  table: string;
  op: 'select' | 'insert' | 'update' | 'delete';
  colonnes: string;
  filtres: Record<string, string>;
  ligne: Record<string, unknown> | null;
}
interface Rpc {
  nom: string;
  args: Record<string, unknown>;
}

function faux(repondre: (a: Appel) => Resultat, rpcRepondre: (r: Rpc) => Resultat = () => ({ data: null, error: null })) {
  const appels: Appel[] = [];
  const rpcs: Rpc[] = [];
  const client: ClientPartageEcriture = {
    from(table) {
      const a: Appel = { table, op: 'select', colonnes: '', filtres: {}, ligne: null };
      const b: RequetePartage = {
        select(colonnes = '') {
          a.colonnes = colonnes;
          return b;
        },
        insert(ligne) {
          a.op = 'insert';
          a.ligne = ligne;
          return b;
        },
        update(ligne) {
          a.op = 'update';
          a.ligne = ligne;
          return b;
        },
        delete() {
          a.op = 'delete';
          return b;
        },
        eq(colonne, valeur) {
          a.filtres[colonne] = valeur;
          return b;
        },
        order() {
          return b;
        },
        then(ok, ko) {
          appels.push({ ...a, filtres: { ...a.filtres } });
          return Promise.resolve(repondre(a)).then(ok, ko);
        },
      };
      return b;
    },
    rpc(nom, args) {
      rpcs.push({ nom, args });
      return Promise.resolve(rpcRepondre({ nom, args }));
    },
  };
  return { client, appels, rpcs };
}

const brouillon = () => ({ ...brouillonVide(), titre: 'Les positions', contexte: 'Classe de Léa' });

describe('magasinPartageSupabase', () => {
  it('publie par la fonction de la base et renvoie le code', async () => {
    const { client, rpcs } = faux(() => ({ data: null, error: null }), () => ({ data: 'K7M2XQ9A', error: null }));
    const b = brouillon();
    expect(await magasinPartageSupabase(client).publier('c1', b, 'groupes', 'soutien')).toBe('K7M2XQ9A');
    expect(rpcs).toEqual([{ nom: 'game_publish_activity', args: { p_class_id: 'c1', p_code: null, p_brouillon: b, p_mode: 'groupes', p_profil: 'soutien' } }]);
  });

  it('republie avec le code existant', async () => {
    const { client, rpcs } = faux(() => ({ data: null, error: null }), () => ({ data: 'K7M2XQ9A', error: null }));
    await magasinPartageSupabase(client).publier('c1', brouillon(), 'meme', 'standard', 'K7M2XQ9A');
    expect(rpcs[0].args.p_code).toBe('K7M2XQ9A');
  });

  it('une réponse de publication qui n’est pas un code est une erreur', async () => {
    const { client } = faux(() => ({ data: null, error: null }), () => ({ data: 42, error: null }));
    await expect(magasinPartageSupabase(client).publier('c1', brouillon(), 'meme', 'standard')).rejects.toBeInstanceOf(ErreurStockage);
  });

  it('le plafond de 20 activités devient un message clair', async () => {
    const { client } = faux(() => ({ data: null, error: null }), () => ({ data: null, error: { message: 'Vingt activités partagées au plus par classe.' } }));
    const e = await magasinPartageSupabase(client).publier('c1', brouillon(), 'meme', 'standard').catch((x) => x);
    expect(e).toBeInstanceOf(ErreurPartage);
    expect(e.message).toMatch(/retirez-en une/);
  });

  it('retire par la fonction de la base', async () => {
    const { client, rpcs } = faux(() => ({ data: null, error: null }));
    await magasinPartageSupabase(client).retirer('K7M2XQ9A');
    expect(rpcs).toEqual([{ nom: 'game_unpublish_activity', args: { p_code: 'K7M2XQ9A' } }]);
  });

  it('liste les publications d’une classe et ignore une ligne mal formée', async () => {
    const { client, appels } = faux(() => ({
      data: [
        { code: 'K7M2XQ9A', titre: 'Les positions', mode: 'meme', profil_defaut: 'standard', updated_at: '2026-11-10T10:00:00Z' },
        { code: 'K7M2XQ9B', titre: 12, mode: 'meme', profil_defaut: 'standard', updated_at: '2026-11-10T10:00:00Z' },
      ],
      error: null,
    }));
    const l = await magasinPartageSupabase(client).publications('c1');
    expect(l).toEqual([{ code: 'K7M2XQ9A', titre: 'Les positions', mode: 'meme', profilDefaut: 'standard', majLe: '2026-11-10T10:00:00Z' }]);
    expect(appels[0]).toMatchObject({ table: 'game_shared_activities', filtres: { class_id: 'c1' } });
  });

  it('relit les profils par code et ignore une ligne mal formée', async () => {
    const { client } = faux(() => ({ data: [{ student_code: 'E07', profile: 'soutien' }, { student_code: 'Léa', profile: 'defi' }, { student_code: 'E08', profile: 'x' }], error: null }));
    expect(await magasinPartageSupabase(client).profils('c1')).toEqual({ E07: 'soutien' });
  });

  it('définit un profil : met à jour la ligne existante', async () => {
    const { client, appels } = faux((a) => ({ data: a.op === 'update' ? [{ student_code: 'E07' }] : null, error: null }));
    await magasinPartageSupabase(client).definirProfil('c1', 'E07', 'defi');
    expect(appels.map((a) => a.op)).toEqual(['update']);
    expect(appels[0]).toMatchObject({ table: 'game_class_profiles', ligne: { profile: 'defi' }, filtres: { class_id: 'c1', student_code: 'E07' } });
  });

  it('définit un profil : insère quand aucune ligne n’existe', async () => {
    const { client, appels } = faux(() => ({ data: [], error: null }));
    await magasinPartageSupabase(client).definirProfil('c1', 'E07', 'defi');
    expect(appels.map((a) => a.op)).toEqual(['update', 'insert']);
    expect(appels[1].ligne).toEqual({ class_id: 'c1', student_code: 'E07', profile: 'defi' });
  });

  it('retire un profil par classe et code', async () => {
    const { client, appels } = faux(() => ({ data: null, error: null }));
    await magasinPartageSupabase(client).retirerProfil('c1', 'E07');
    expect(appels[0]).toMatchObject({ table: 'game_class_profiles', op: 'delete', filtres: { class_id: 'c1', student_code: 'E07' } });
  });

  it('une erreur réseau devient une ErreurStockage de code « reseau »', async () => {
    const { client } = faux(() => {
      throw new TypeError('Failed to fetch');
    });
    const e = await magasinPartageSupabase(client).publications('c1').catch((x) => x);
    expect(e).toBeInstanceOf(ErreurStockage);
    expect(e.code).toBe('reseau');
  });
});

describe('magasinPartageMemoire', () => {
  it('publie, republie, liste et retire', async () => {
    const m = magasinPartageMemoire();
    const code = await m.publier('c1', brouillon(), 'meme', 'standard');
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    expect(await m.publier('c1', { ...brouillon(), titre: 'Autre titre' }, 'groupes', 'defi', code)).toBe(code);
    const l = await m.publications('c1');
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ code, titre: 'Autre titre', mode: 'groupes', profilDefaut: 'defi' });
    await m.retirer(code);
    expect(await m.publications('c1')).toEqual([]);
  });

  it('plafonne à 20 activités par classe', async () => {
    const m = magasinPartageMemoire();
    for (let i = 0; i < 20; i++) await m.publier('c1', brouillon(), 'meme', 'standard');
    await expect(m.publier('c1', brouillon(), 'meme', 'standard')).rejects.toBeInstanceOf(ErreurPartage);
    await m.publier('c2', brouillon(), 'meme', 'standard');
  });

  it('gère les profils par code', async () => {
    const m = magasinPartageMemoire();
    await m.definirProfil('c1', 'E07', 'soutien');
    await m.definirProfil('c1', 'E07', 'defi');
    expect(await m.profils('c1')).toEqual({ E07: 'defi' });
    await m.retirerProfil('c1', 'E07');
    expect(await m.profils('c1')).toEqual({});
  });
});
