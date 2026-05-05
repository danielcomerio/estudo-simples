/**
 * Exporta as questões marcadas com a tag "platform" para
 * `public/platform-questions.json`. Esse arquivo é o seed que
 * visitantes (modo guest) e contas recém-criadas carregam ao entrar
 * pela primeira vez no app.
 *
 * - PRÉ-REQUISITO: nenhum migration novo. Usa só a infra existente
 *   (tabela `questions` + coluna `tags text[]`).
 * - SEGURO: anon key + auth do próprio user (que tem as questões).
 * - IDEMPOTENTE: sobrescreve o JSON inteiro. Sem efeitos colaterais
 *   no banco (somente leitura em `questions`).
 * - O JSON tem somente CONTEÚDO da questão (type, payload, dificuldade,
 *   etc.). NÃO inclui id, user_id, srs, stats, timestamps. Cada conta
 *   que carrega o seed gera id próprio e SRS zerado.
 *
 * USO:
 *   1. Marque com a tag `platform` (no /banco) as questões que devem
 *      virar parte da plataforma. Pode usar bulk: filtrar, selecionar
 *      tudo, e usar o menu de tags pra adicionar.
 *
 *   2. Configure variáveis (no shell ou via .env carregado externamente):
 *      export NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *      export NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
 *      export SUPABASE_EMAIL=seu@email.com
 *      export SUPABASE_PASSWORD=suasenha
 *
 *   3. Rode:
 *      npm run export:platform
 *      (ou: npx tsx scripts/export-platform.ts)
 *
 *   4. Commit do `public/platform-questions.json` atualizado e deploy.
 *
 * ROLLBACK: reescrever `public/platform-questions.json` com `[]` ou
 * com a versão anterior do git e re-deploy.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const PLATFORM_TAG = 'platform';

function getEnv(name: string, required = true): string {
  const v = process.env[name];
  if (!v && required) {
    console.error(`[export-platform] env "${name}" não definida`);
    process.exit(1);
  }
  return v ?? '';
}

async function main() {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const email = getEnv('SUPABASE_EMAIL');
  const password = getEnv('SUPABASE_PASSWORD');

  const sb = createClient(url, anonKey, {
    auth: { persistSession: false },
  });

  const { data: signIn, error: signInErr } = await sb.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !signIn?.user) {
    console.error('[export-platform] falha no login:', signInErr?.message);
    process.exit(1);
  }
  console.log(`[export-platform] logado como ${signIn.user.email}`);

  // Pagina manualmente — PostgREST corta em 1000.
  const all: Record<string, unknown>[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb
      .from('questions')
      .select('*')
      .is('deleted_at', null)
      .contains('tags', [PLATFORM_TAG])
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error('[export-platform] falha no SELECT:', error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    all.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Strip campos user-specific. Mantém só o conteúdo da questão.
  const cleaned = all.map((q) => {
    const {
      id: _id,
      user_id: _uid,
      srs: _srs,
      stats: _stats,
      created_at: _ca,
      updated_at: _ua,
      deleted_at: _da,
      _dirty: _d,
      dedup_hash: _dh,
      // remove tag 'platform' do array — visitantes não precisam dela
      tags,
      ...rest
    } = q as Record<string, unknown>;
    const cleanTags = Array.isArray(tags)
      ? (tags as string[]).filter((t) => t !== PLATFORM_TAG)
      : [];
    return {
      ...rest,
      tags: cleanTags.length ? cleanTags : undefined,
    };
  });

  const outPath = path.join(process.cwd(), 'public', 'platform-questions.json');
  fs.writeFileSync(outPath, JSON.stringify(cleaned, null, 2) + '\n', 'utf8');
  console.log(
    `[export-platform] escreveu ${cleaned.length} questão(ões) em ${outPath}`
  );

  await sb.auth.signOut();
}

main().catch((e) => {
  console.error('[export-platform] erro:', e);
  process.exit(1);
});
