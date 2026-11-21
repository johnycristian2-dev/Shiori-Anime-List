import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null quando o projeto não foi configurado (o site funciona normalmente, só sem conta). */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          // PKCE devolve ?code= na URL (não usa o #hash, que é do HashRouter e do login do AniList)
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export const CLOUD_ENABLED = !!supabase;

/** URL de volta após login: a raiz do site (o mesmo endereço liberado no Supabase). */
export const redirectUrl = () => `${window.location.origin}/`;
