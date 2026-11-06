import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { lire } from './supabaseSimule';

const CHEMIN = 'supabase/admin/planifier-purge.sql';

describe('script de planification de la suppression au 30 août (non exécuté par les tests)', () => {
  it('existe', () => {
    expect(existsSync(new URL(`../../${CHEMIN}`, import.meta.url))).toBe(true);
  });

  it('planifie game_purge_expired chaque jour, sous un nom préfixé game_, sans doublon possible', () => {
    const sql = lire(CHEMIN);
    expect(sql).toMatch(/cron\.schedule\(\s*'game_purge'\s*,\s*'15 3 \* \* \*'/);
    expect(sql).toContain('public.game_purge_expired()');
    // Rejouer le script ne crée pas un second job : l'ancien est retiré d'abord.
    expect(sql).toMatch(/cron\.unschedule\(\s*'game_purge'\s*\)/);
    expect(sql.indexOf('cron.unschedule')).toBeLessThan(sql.indexOf('cron.schedule('));
  });

  it('dit qu’il ne s’applique qu’après la migration 20261107 et avec l’accord de l’administrateur', () => {
    const sql = lire(CHEMIN);
    expect(sql).toMatch(/20261107/);
    expect(sql).toMatch(/accord/i);
  });

  it('ne contient aucun secret, aucune clé, aucun tiret cadratin', () => {
    const sql = lire(CHEMIN);
    expect(sql).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(sql).not.toMatch(/service_role_key|apikey|password/i);
    expect(sql).not.toMatch(/—/);
  });

  it('ne planifie rien d’autre que la purge', () => {
    const sql = lire(CHEMIN);
    expect(sql.match(/cron\.schedule\(/g)).toHaveLength(1);
    expect(sql).not.toMatch(/net\.http_post/);
  });
});
