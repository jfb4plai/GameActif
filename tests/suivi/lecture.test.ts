import { describe, it, expect } from 'vitest';
import { magasinSuiviMemoire, magasinSuiviSupabase, type ClientLecture, type Constructeur } from '../../src/suivi/lecture.js';
import { ErreurStockage } from '../../src/compte/activites.js';

type Resultat = { data: unknown; error: { message: string; code?: string } | null };
interface Appel {
  table: string;
  op: 'select' | 'insert' | 'delete';
  colonnes: string;
  filtres: Record<string, string>;
  ordre: string | null;
  plage: [number, number] | null;
  ligne: Record<string, unknown> | null;
}
interface Rpc {
  nom: string;
  args: Record<string, unknown>;
}

function faux(repondre: (a: Appel) => Resultat, rpcRepondre: (r: Rpc) => Resultat = () => ({ data: null, error: null })) {
  const appels: Appel[] = [];
  const rpcs: Rpc[] = [];
  const client: ClientLecture = {
    from(table) {
      const a: Appel = { table, op: 'select', colonnes: '', filtres: {}, ordre: null, plage: null, ligne: null };
      const b: Constructeur = {
        select(colonnes = '') {
          a.colonnes = colonnes;
          return b;
        },
        insert(ligne) {
          a.op = 'insert';
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
        order(colonne) {
          a.ordre = colonne;
          return b;
        },
        range(de, a2) {
          a.plage = [de, a2];
          return b;
        },
        single() {
          return b;
        },
        then(ok, ko) {
          appels.push({ ...a });
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

const ligneSession = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  student_code: 'E07',
  mechanic: 'trier',
  profile: 'standard',
  cibles: ['M.P4.1.1.i1.a1'],
  total_elements: 1,
  ended_at: '2026-11-12T10:00:00Z',
  labels: { devant: 'devant' },
  results: [{ elementId: 'e1', mechanic: 'trier', firstTry: true, tries: 1, hintUsed: false, revealed: false, wrongChoices: [], correct: 'devant' }],
  ...extra,
});

describe('magasinSuiviSupabase', () => {
  it('relit une séance en SessionEnregistree, origine « ecran »', async () => {
    const { client } = faux(() => ({ data: [ligneSession('s1')], error: null }));
    const magasin = magasinSuiviSupabase(client, 'u1');
    const r = await magasin.sessions('c1');
    expect(r).toEqual([
      {
        sessionId: 's1',
        studentCode: 'E07',
        mechanic: 'trier',
        profile: 'standard',
        cibles: ['M.P4.1.1.i1.a1'],
        totalElements: 1,
        endedAt: '2026-11-12T10:00:00Z',
        labels: { devant: 'devant' },
        results: [{ elementId: 'e1', mechanic: 'trier', firstTry: true, tries: 1, hintUsed: false, revealed: false, wrongChoices: [], correct: 'devant' }],
        origine: 'ecran',
      },
    ]);
  });

  it('ignore une ligne dont la forme est inattendue sans lever', async () => {
    const { client } = faux(() => ({ data: [ligneSession('s1'), ligneSession('s2', { results: 'pas un tableau' }), ligneSession('s3', { mechanic: 'foo' })], error: null }));
    const r = await magasinSuiviSupabase(client, 'u1').sessions('c1');
    expect(r.map((s) => s.sessionId)).toEqual(['s1']);
  });

  it('lit toutes les pages : 1000 lignes puis 5', async () => {
    const { client, appels } = faux((a) => {
      const [de] = a.plage ?? [0];
      return { data: de === 0 ? Array.from({ length: 1000 }, (_, i) => ligneSession(`s${i}`)) : Array.from({ length: 5 }, (_, i) => ligneSession(`t${i}`)), error: null };
    });
    const r = await magasinSuiviSupabase(client, 'u1').sessions('c1');
    expect(r).toHaveLength(1005);
    expect(appels.map((a) => a.plage)).toEqual([[0, 999], [1000, 1999]]);
  });

  it('ne demande que les séances de la classe', async () => {
    const { client, appels } = faux(() => ({ data: [], error: null }));
    await magasinSuiviSupabase(client, 'u1').sessions('c42');
    expect(appels[0]).toMatchObject({ table: 'game_sessions', filtres: { class_id: 'c42' } });
  });

  it('enregistre une observation avec ces seuls champs et la relit', async () => {
    const { client, appels } = faux(() => ({ data: { id: 'o1', student_code: 'E04', texte: 'E04 a corrigé seul', visible_invites: false, created_at: '2026-11-12T10:00:00Z' }, error: null }));
    const o = await magasinSuiviSupabase(client, 'u1').enregistrerObservation('c1', { studentCode: 'E04', texte: 'E04 a corrigé seul', visibleInvites: false });
    expect(appels[0].ligne).toEqual({ class_id: 'c1', student_code: 'E04', texte: 'E04 a corrigé seul', visible_invites: false });
    expect(o).toEqual({ id: 'o1', studentCode: 'E04', texte: 'E04 a corrigé seul', visibleInvites: false, creeLe: '2026-11-12T10:00:00Z' });
  });

  it('enregistre un résultat saisi avec ces seuls champs', async () => {
    const { client, appels } = faux(() => ({ data: null, error: null }));
    await magasinSuiviSupabase(client, 'u1').saisirManuel('c1', { studentCode: 'E04', cible: 'M.P4.1.1.i1.a1', resultat: 'reussi' });
    expect(appels[0]).toMatchObject({ table: 'game_manual_results', op: 'insert', ligne: { class_id: 'c1', student_code: 'E04', cible: 'M.P4.1.1.i1.a1', resultat: 'reussi' } });
    expect(Object.keys(appels[0].ligne ?? {}).sort()).toEqual(['cible', 'class_id', 'resultat', 'student_code']);
  });

  it('crée une classe par la fonction de la base puis la relit avec sa date de suppression', async () => {
    const { client, rpcs } = faux(
      () => ({ data: [{ id: 'c1', user_id: 'u1', label: 'P4 B', nb_codes: 24, class_code: 'ABCD2345', purge_on: '2027-08-30' }], error: null }),
      () => ({ data: [{ id: 'c1', class_code: 'ABCD2345' }], error: null }),
    );
    const c = await magasinSuiviSupabase(client, 'u1').creerClasse('P4 B', 24);
    expect(rpcs).toEqual([{ nom: 'game_create_class', args: { p_label: 'P4 B', p_nb_codes: 24 } }]);
    expect(c).toEqual({ id: 'c1', label: 'P4 B', nbCodes: 24, classCode: 'ABCD2345', purgeLe: '2027-08-30', proprietaire: true });
  });

  it('une classe d’un autre propriétaire est marquée comme telle (invité)', async () => {
    const { client } = faux(() => ({ data: [{ id: 'c9', user_id: 'autre', label: 'P4 A', nb_codes: 10, class_code: 'ABCD2345', purge_on: '2027-08-30' }], error: null }));
    const cs = await magasinSuiviSupabase(client, 'u1').classes();
    expect(cs[0].proprietaire).toBe(false);
  });

  it('invite par code et révoque', async () => {
    const { client, rpcs } = faux(() => ({ data: [], error: null }), (r) => ({ data: r.nom === 'game_create_guest_invitation' ? 'X'.repeat(32) : null, error: null }));
    const m = magasinSuiviSupabase(client, 'u1');
    expect(await m.inviter('c1')).toBe('X'.repeat(32));
    await m.revoquer('g1');
    expect(rpcs).toEqual([
      { nom: 'game_create_guest_invitation', args: { p_class_id: 'c1' } },
      { nom: 'game_revoke_guest', args: { p_guest_id: 'g1' } },
    ]);
  });

  it('rejoindre renvoie la réponse de la base et refuse une valeur inattendue', async () => {
    const ok = faux(() => ({ data: [], error: null }), () => ({ data: 'ok', error: null }));
    expect(await magasinSuiviSupabase(ok.client, 'u1').rejoindre('X'.repeat(32))).toBe('ok');
    const bizarre = faux(() => ({ data: [], error: null }), () => ({ data: 42, error: null }));
    await expect(magasinSuiviSupabase(bizarre.client, 'u1').rejoindre('X'.repeat(32))).rejects.toBeInstanceOf(ErreurStockage);
  });

  it('une erreur réseau devient une ErreurStockage de code « reseau », en français', async () => {
    const { client } = faux(() => {
      throw new TypeError('Failed to fetch');
    });
    const erreur = await magasinSuiviSupabase(client, 'u1').sessions('c1').catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurStockage);
    expect(erreur.code).toBe('reseau');
    expect(erreur.message).not.toMatch(/fetch/i);
  });

  it('supprime une classe par son identifiant', async () => {
    const { client, appels } = faux(() => ({ data: null, error: null }));
    await magasinSuiviSupabase(client, 'u1').supprimerClasse('c1');
    expect(appels[0]).toMatchObject({ table: 'game_classes', op: 'delete', filtres: { id: 'c1' } });
  });
});

describe('magasinSuiviMemoire', () => {
  it('crée, relit et supprime une classe avec ses saisies', async () => {
    const m = magasinSuiviMemoire();
    const c = await m.creerClasse('P4 B', 24);
    expect(c).toMatchObject({ label: 'P4 B', nbCodes: 24, proprietaire: true });
    expect(c.classCode).toMatch(/^[A-Z2-9]{8}$/);
    await m.saisirManuel(c.id, { studentCode: 'E01', cible: 'M.P4.1.1.i1.a1', resultat: 'partiel' });
    const o = await m.enregistrerObservation(c.id, { studentCode: null, texte: 'RAS', visibleInvites: true });
    expect(await m.manuels(c.id)).toHaveLength(1);
    expect(await m.observations(c.id)).toEqual([o]);
    await m.supprimerClasse(c.id);
    expect(await m.classes()).toEqual([]);
    expect(await m.manuels(c.id)).toEqual([]);
  });

  it('accepte des séances de départ pour les tests d’écran', async () => {
    const m = magasinSuiviMemoire({ classes: [{ id: 'c1', label: 'P4 B', nbCodes: 24, classCode: 'ABCD2345', purgeLe: '2027-08-30', proprietaire: true }] });
    expect(await m.classes()).toHaveLength(1);
    expect(await m.sessions('c1')).toEqual([]);
  });
});
