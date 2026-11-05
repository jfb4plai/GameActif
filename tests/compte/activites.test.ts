import { describe, it, expect } from 'vitest';
import {
  ErreurStockage,
  magasinMemoire,
  magasinSupabase,
  type ActivitesStore,
  type ClientActivites,
} from '../../src/compte/activites.js';
import { brouillonVide } from '../../src/atelier/brouillon.js';
import type { Brouillon } from '../../src/atelier/types.js';

const brouillon = (over: Partial<Brouillon> = {}): Brouillon => ({
  ...brouillonVide(),
  niveau: 'P4',
  matiere: 'mathematiques',
  cibles: ['M.P4.1.1.i1.a1'],
  titre: 'Les positions',
  contexte: '18 élèves.',
  paires: 'devant | derrière\nà droite | à gauche',
  ...over,
});

interface Ligne {
  id: string;
  user_id: string;
  titre: string;
  niveau: string;
  matiere: string;
  brouillon: unknown;
  format_version: number;
  updated_at: string;
}

/** Base factice qui imite la partie de l'API Supabase utilisée, avec injection de pannes. */
function fauxClient(opts: { panne?: 'reseau-leve' | 'reseau-erreur' | 'acces-42501' | 'acces-jwt' | 'inconnue' | null } = {}) {
  const table: Ligne[] = [];
  const appels = { insert: [] as Record<string, unknown>[], update: [] as Record<string, unknown>[] };
  let n = 0;
  const panne = () => {
    switch (opts.panne) {
      case 'reseau-leve':
        throw new TypeError('Failed to fetch');
      case 'reseau-erreur':
        return { data: null, error: { message: 'TypeError: Failed to fetch' } };
      case 'acces-42501':
        return { data: null, error: { message: 'new row violates row-level security policy', code: '42501' } };
      case 'acces-jwt':
        return { data: null, error: { message: 'JWT expired', code: 'PGRST301' } };
      case 'inconnue':
        return { data: null, error: { message: 'quelque chose d’inattendu', code: 'XX000' } };
      default:
        return null;
    }
  };
  const client = {
    from: () => ({
      select: () => ({
        order: async () => panne() ?? { data: [...table].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)), error: null },
      }),
      insert: (ligne: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            const p = panne();
            if (p) return p;
            appels.insert.push(ligne);
            const nouvelle = { id: `id${++n}`, format_version: 1, ...ligne, updated_at: new Date(1_700_000_000_000 + ++n * 1000).toISOString() } as Ligne;
            table.push(nouvelle);
            return { data: nouvelle, error: null };
          },
        }),
      }),
      update: (ligne: Record<string, unknown>) => ({
        eq: (_c: string, id: string) => ({
          select: () => ({
            single: async () => {
              const p = panne();
              if (p) return p;
              appels.update.push(ligne);
              const existante = table.find((l) => l.id === id);
              if (!existante) return { data: null, error: { message: 'Aucune ligne', code: 'PGRST116' } };
              Object.assign(existante, ligne, { updated_at: new Date(1_700_000_000_000 + ++n * 1000).toISOString() });
              return { data: existante, error: null };
            },
          }),
        }),
      }),
      delete: () => ({
        eq: async (_c: string, id: string) => {
          const p = panne();
          if (p) return p;
          const i = table.findIndex((l) => l.id === id);
          if (i >= 0) table.splice(i, 1);
          return { data: null, error: null };
        },
      }),
    }),
  };
  return { client: client as unknown as ClientActivites, table, appels };
}

const implementations: [string, () => ActivitesStore][] = [
  ['magasin en mémoire', () => magasinMemoire()],
  ['magasin Supabase (base factice)', () => magasinSupabase(fauxClient().client, 'u1')],
];

for (const [nom, fabrique] of implementations) {
  describe(nom, () => {
    it('enregistrer sans identifiant crée une activité', async () => {
      const s = fabrique();
      const a = await s.enregistrer(brouillon());
      expect(a.id).toBeTruthy();
      expect(await s.lister()).toHaveLength(1);
    });

    it('enregistrer avec l’identifiant met à jour la même activité sans dupliquer', async () => {
      const s = fabrique();
      const a = await s.enregistrer(brouillon());
      const b = await s.enregistrer(brouillon({ titre: 'Renommée' }), a.id);
      expect(b.id).toBe(a.id);
      const liste = await s.lister();
      expect(liste).toHaveLength(1);
      expect(liste[0].titre).toBe('Renommée');
    });

    it('liste les activités les plus récemment modifiées en premier', async () => {
      const s = fabrique();
      const a = await s.enregistrer(brouillon({ titre: 'A' }));
      await s.enregistrer(brouillon({ titre: 'B' }));
      await s.enregistrer(brouillon({ titre: 'A modifiée' }), a.id);
      expect((await s.lister()).map((x) => x.titre)).toEqual(['A modifiée', 'B']);
    });

    it('supprimer retire l’activité', async () => {
      const s = fabrique();
      const a = await s.enregistrer(brouillon());
      await s.supprimer(a.id);
      expect(await s.lister()).toEqual([]);
    });

    it('le titre, le niveau et la matière viennent du brouillon', async () => {
      const s = fabrique();
      const a = await s.enregistrer(brouillon({ titre: '  Mon titre  ', niveau: 'P5', matiere: 'mathematiques' }));
      expect([a.titre, a.niveau, a.matiere]).toEqual(['Mon titre', 'P5', 'mathematiques']);
    });

    it('un titre vide devient « Activité sans titre »', async () => {
      const s = fabrique();
      expect((await s.enregistrer(brouillon({ titre: '   ' }))).titre).toBe('Activité sans titre');
    });

    it('n’enregistre jamais une clé étrangère au brouillon (identité, e-mail)', async () => {
      const s = fabrique();
      const piege = { ...brouillon(), email: 'prof@ecole.be', userId: 'u1' } as Brouillon;
      const a = await s.enregistrer(piege);
      expect(Object.keys(a.brouillon).sort()).toEqual(Object.keys(brouillon()).sort());
      expect(JSON.stringify(a)).not.toContain('prof@ecole.be');
    });

    it('le brouillon relu est identique au brouillon enregistré', async () => {
      const s = fabrique();
      const b = brouillon({ etapes: 'un\ndeux\ntrois' });
      const a = await s.enregistrer(b);
      expect((await s.lister())[0].brouillon).toEqual(b);
      expect(a.brouillon).toEqual(b);
    });
  });
}

describe('magasin Supabase, identité et formes', () => {
  it('l’identité vient de la session : user_id fixé à l’insertion, jamais à la mise à jour', async () => {
    const { client, appels } = fauxClient();
    const s = magasinSupabase(client, 'u-session');
    const a = await s.enregistrer(brouillon());
    await s.enregistrer(brouillon({ titre: 'Autre' }), a.id);
    expect(appels.insert[0].user_id).toBe('u-session');
    expect('user_id' in appels.update[0]).toBe(false);
  });

  it('écarte de la liste un brouillon de forme invalide sans faire échouer toute la liste', async () => {
    const { client, table } = fauxClient();
    const s = magasinSupabase(client, 'u1');
    await s.enregistrer(brouillon({ titre: 'Bonne' }));
    table.push({ id: 'abime', user_id: 'u1', titre: 'Abîmée', niveau: 'P4', matiere: 'mathematiques', brouillon: { n: 'importe quoi' }, format_version: 1, updated_at: new Date().toISOString() });
    const liste = await s.lister();
    expect(liste.map((a) => a.titre)).toEqual(['Bonne']);
  });
});

describe('magasin Supabase, anciennes lignes (Review Focus 1)', () => {
  it('enregistre comparaisons et qcm', async () => {
    const { client, appels } = fauxClient();
    await magasinSupabase(client, 'u1').enregistrer(brouillon({ comparaisons: '12 | 8', qcm: 'Q ? | a | b' }));
    const b = appels.insert[0].brouillon as Brouillon;
    expect(b.comparaisons).toBe('12 | 8');
    expect(b.qcm).toBe('Q ? | a | b');
  });

  it('relit une ligne enregistrée avant ces champs avec des champs vides', async () => {
    const { client, table } = fauxClient();
    const { comparaisons: _c, qcm: _q, ...ancien } = brouillon({ titre: 'Ancienne' });
    table.push({ id: 'vieille', user_id: 'u1', titre: 'Ancienne', niveau: 'P4', matiere: 'mathematiques', brouillon: ancien, format_version: 1, updated_at: new Date().toISOString() });
    const liste = await magasinSupabase(client, 'u1').lister();
    expect(liste).toHaveLength(1);
    expect(liste[0].brouillon.comparaisons).toBe('');
    expect(liste[0].brouillon.qcm).toBe('');
  });
});

describe('magasin Supabase, pannes (Review Focus 4)', () => {
  const cas: [string, 'reseau-leve' | 'reseau-erreur' | 'acces-42501' | 'acces-jwt' | 'inconnue', 'reseau' | 'acces' | 'inconnue'][] = [
    ['appel qui lève (réseau coupé)', 'reseau-leve', 'reseau'],
    ['erreur renvoyée « Failed to fetch »', 'reseau-erreur', 'reseau'],
    ['droits refusés (42501)', 'acces-42501', 'acces'],
    ['session expirée (PGRST301)', 'acces-jwt', 'acces'],
    ['erreur inattendue', 'inconnue', 'inconnue'],
  ];
  for (const [nom, panne, code] of cas) {
    it(`${nom} : code « ${code} » pour enregistrer, lister et supprimer`, async () => {
      const { client } = fauxClient({ panne });
      const s = magasinSupabase(client, 'u1');
      for (const action of [() => s.enregistrer(brouillon()), () => s.lister(), () => s.supprimer('x')]) {
        const erreur = await action().then(
          () => null,
          (e: unknown) => e,
        );
        expect(erreur).toBeInstanceOf(ErreurStockage);
        expect((erreur as ErreurStockage).code).toBe(code);
      }
    });
  }

  it('une panne n’ajoute rien à la base', async () => {
    const f = fauxClient({ panne: 'reseau-leve' });
    const s = magasinSupabase(f.client, 'u1');
    await s.enregistrer(brouillon()).catch(() => undefined);
    expect(f.table).toHaveLength(0);
  });

  it('le message d’une ErreurStockage est en français et ne contient aucun détail technique', async () => {
    const { client } = fauxClient({ panne: 'reseau-erreur' });
    const erreur = await magasinSupabase(client, 'u1').lister().catch((e: Error) => e);
    expect((erreur as Error).message).toBe('L’enregistrement n’a pas abouti. Votre saisie est conservée : réessayez.');
    expect((erreur as Error).message).not.toMatch(/Fetch|TypeError|42501/);
  });

  it('une erreur de droits donne le message de reconnexion', async () => {
    const { client } = fauxClient({ panne: 'acces-jwt' });
    const erreur = await magasinSupabase(client, 'u1').lister().catch((e: Error) => e);
    expect((erreur as Error).message).toBe('Votre session a expiré. Reconnectez-vous.');
  });
});
