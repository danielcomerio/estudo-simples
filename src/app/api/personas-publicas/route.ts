/**
 * GET /api/personas-publicas — lista personas marcadas como is_public.
 *
 * Sem PII (não retorna user_id do owner). Auth obrigatória pra evitar
 * scrape anônimo.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';

  let query = supabase
    .from('ai_personas')
    .select('id, name, description, emoji, system_prompt, use_count, created_at')
    .eq('is_public', true)
    .order('use_count', { ascending: false })
    .limit(50);

  if (q) {
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: 'fetch_failed', message: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ items: data ?? [] });
}
