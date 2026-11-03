import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Client public (clé anon seulement) : la clé service_role ne quitte jamais le serveur. */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const cle = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !cle) throw new Error('Configuration Supabase manquante (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)');
  client = createClient(url, cle);
  return client;
}
