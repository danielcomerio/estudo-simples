/**
 * Supabase admin client — server-only, usa SERVICE ROLE KEY.
 *
 * SERVICE_ROLE_KEY bypassa RLS. É usado APENAS em endpoints server
 * confiáveis: webhooks de provedores externos (Stripe), tasks de
 * background, scripts admin.
 *
 * Regras:
 *  - Esse arquivo NUNCA é importado de client components ou de páginas
 *    SSR que vão renderizar com dados pra usuários comuns.
 *  - SUPABASE_SERVICE_ROLE_KEY NUNCA tem prefixo NEXT_PUBLIC_.
 *  - Cada endpoint que usa esse client deve validar autenticidade do
 *    request antes (ex: signature do Stripe webhook).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Genérico (sem Database typing) pra evitar `never` em from() — service
// role bypassa RLS e é usado pra mexer em qualquer tabela do schema.
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase admin não configurado (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).'
    );
  }
  cached = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return cached;
}
