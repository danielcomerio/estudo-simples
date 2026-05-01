/**
 * Backfill idempotente: cria linhas em `public.disciplinas` para cada
 * `disciplina_id` (string) único encontrado em `public.questions`.
 *
 * - PRÉ-REQUISITO: migration 0002 já aplicada no Supabase.
 * - SEGURO: usa apenas a anon key + autenticação por email/senha do
 *   próprio usuário. Nunca usa SERVICE_ROLE_KEY (não há razão pra isso
 *   neste app — RLS é suficiente).
 * - IDEMPOTENTE: pode rodar quantas vezes quiser; faz diff contra o que
 *   já existe e só insere o faltante.
 * - SOMENTE LEITURA EM `questions`. Só faz INSERT em `disciplinas`. Não
 *   altera questões existentes.
 *
 * USO:
 *   1. Configure no shell (ou em .env carregado externamente):
 *      export NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *      export NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
 *      export SUPABASE_EMAIL=seu@email.com
 *      export SUPABASE_PASSWORD=suasenha
 *
 *   2. Rode:
 *      npm run backfill:disciplinas
 *      (ou: npx tsx scripts/backfill-disciplinas.ts)
 *
 *   3. Use --dry-run para apenas mostrar o que seria criado (sem
 *      INSERT). Recomendado na primeira execução:
 *      npm run backfill:disciplinas -- --dry-run
 *
 * ROLLBACK: rodar `delete from public.disciplinas where created_at >= ...`
 * com a janela de tempo do backfill, ou `truncate disciplinas cascade`
 * (vai apagar concurso_disciplinas/topicos/edital_itens junto). RLS
 * garante que isso só afeta o user logado.
 */

import { createClient } from '@supabase/supabase-js';
import {
  diffDisciplinasFaltantes,
  extractUniqueDisciplinaNomes,
  type QuestionDiscPicker,
} from '../src/lib/backfill';

type Logger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

const log: Logger = {
  info: (m) => console.log(`[backfill] ${m}`),
  warn: (m) => console.warn(`[backfill] ${m}`),
  error: (m) => console.error(`[backfill] ${m}`),
};

function fail(msg: string): never {
  log.error(msg);
  process.exit(1);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  // 1. Validação de env vars (fail-loud)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.SUPABASE_EMAIL;
  const password = process.env.SUPABASE_PASSWORD;

  if (!url || !anon || !email || !password) {
    fail(
      'env vars obrigatórias ausentes. Defina: ' +
        'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, ' +
        'SUPABASE_EMAIL, SUPABASE_PASSWORD'
    );
  }

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    fail(
      'SUPABASE_SERVICE_ROLE_KEY presente no ambiente. Este script ' +
        'nunca deve ser rodado com service role; use apenas anon + ' +
        'login. Remova a env var antes de rodar.'
    );
  }

  log.info(`alvo: ${url}`);
  log.info(`modo: ${dryRun ? 'DRY-RUN (nada será gravado)' : 'EXECUÇÃO'}`);

  // 2. Login (anon key + email/senha)
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword(
    { email, password }
  );
  if (authErr || !auth?.user) {
    fail(`auth falhou: ${authErr?.message ?? 'sem detalhes'}`);
  }
  const userId = auth.user.id;
  log.info(`autenticado como ${userId}`);

  // 3. Lê questions ativas (RLS limita ao próprio user)
  const { data: qRows, error: qErr } = await supabase
    .from('questions')
    .select('disciplina_id, deleted_at')
    .is('deleted_at', null);

  if (qErr) fail(`select questions falhou: ${qErr.message}`);

  const alvo = extractUniqueDisciplinaNomes(
    (qRows ?? []) as QuestionDiscPicker[]
  );
  log.info(
    `${qRows?.length ?? 0} questões ativas; ${alvo.length} disciplinas únicas`
  );

  if (!alvo.length) {
    log.info('nenhuma disciplina pra backfillar; saindo');
    process.exit(0);
  }

  // 4. Lê disciplinas existentes (idempotência)
  const { data: dRows, error: dErr } = await supabase
    .from('disciplinas')
    .select('nome')
    .is('deleted_at', null);

  if (dErr) fail(`select disciplinas falhou: ${dErr.message}`);

  const existentes = (dRows ?? []).map((r: { nome: string }) => r.nome);
  log.info(`${existentes.length} disciplinas já existentes`);

  const faltantes = diffDisciplinasFaltantes(alvo, existentes);
  log.info(`${faltantes.length} disciplinas a criar:`);
  for (const n of faltantes) log.info(`  • ${n}`);

  if (!faltantes.length) {
    log.info('tudo já está backfillado; saindo');
    process.exit(0);
  }

  if (dryRun) {
    log.info('DRY-RUN: nada gravado. Re-rode sem --dry-run para criar.');
    process.exit(0);
  }

  // 5. Insert (RLS valida user_id == auth.uid())
  const toInsert = faltantes.map((nome) => ({ user_id: userId, nome }));

  const { data: created, error: insErr } = await supabase
    .from('disciplinas')
    .insert(toInsert)
    .select('id, nome');

  if (insErr) {
    // 23505 = unique_violation. Pode acontecer se houver insert paralelo.
    // Tratamos como aviso, não fatal.
    if (insErr.code === '23505') {
      log.warn(
        `algumas disciplinas concorreram com inserts paralelos (${insErr.message}); execução parcial — re-rode pra confirmar idempotência`
      );
    } else {
      fail(`insert falhou: ${insErr.message} (code=${insErr.code})`);
    }
  }

  log.info(`OK — ${created?.length ?? 0} disciplinas criadas`);
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  fail(`erro inesperado: ${msg}`);
});
