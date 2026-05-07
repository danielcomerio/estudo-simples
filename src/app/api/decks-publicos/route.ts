/**
 * GET /api/decks-publicos — lista marketplace de decks públicos.
 * Filtros opcionais: ?q=termo (busca em title/description).
 *
 * Auth obrigatória (evita scraping anon).
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
    .from('shared_decks')
    .select(
      'token, owner_display, title, description, category, question_count, created_at, access_count'
    )
    .eq('is_public', true)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  if (q) {
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: 'fetch_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ decks: data ?? [] });
}
