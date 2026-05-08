#!/usr/bin/env node
/**
 * Backup completo do Supabase (dados de todas as tabelas) via API REST.
 * Não requer Docker, pg_dump ou CLI do Supabase. Usa o SUPABASE_SERVICE_ROLE_KEY
 * (que bypassa RLS) pra ler todas as linhas de todas as tabelas no schema public.
 *
 * Uso:
 *   npm run backup
 *
 * Saída: backup-YYYY-MM-DD-HHMMSS.json com:
 *   {
 *     metadata: { created_at, supabase_url, table_count, total_rows },
 *     tables: { tableName: [...rows] }
 *   }
 *
 * LIMITAÇÕES:
 *  - Não captura schema/triggers/RLS/funcs (apenas dados).
 *  - Pra restore: aplicar todas migrations em DB limpo + rodar
 *    scripts/restore-supabase.mjs (a fazer quando precisar).
 *  - Tabelas auth.* / storage.* não são incluídas (managed pelo Supabase).
 *  - Tamanho: depende do banco. ~10MB pra 10k questões.
 *
 * Pro pivot: backup das tabelas de dados é suficiente — schema vive
 * nas migrations versionadas em git.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Auto-carrega .env.local (mesma pattern do check-migrations)
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
  return true;
}

loadEnvFile(path.resolve(process.cwd(), '.env.local')) ||
  loadEnvFile(path.resolve(process.cwd(), '.env'));

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error(
    '❌ Faltam env vars: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'
  );
  console.error('   Coloque em .env.local na raiz do projeto.');
  process.exit(1);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// Lista todas as tabelas do schema public via SQL system.
// Usa um RPC manual ou a query API do PostgREST (sem RPC).
// PostgREST aceita REST queries mas não SQL livre, então listamos
// as tabelas conhecidas (mais robusto que tentar introspecção).
//
// IMPORTANTE: manter sincronizado com migrations. Se aparecer "tabela X
// não existe" no log, é normal — significa que a migration não foi
// aplicada nesse DB.
const KNOWN_TABLES = [
  // 0001 — questions (a mais crítica)
  'questions',
  // 0002 — hierarquia
  'concursos',
  'disciplinas',
  'concurso_disciplinas',
  'topicos',
  'edital_itens',
  // 0005 — billing
  'profiles',
  'stripe_events',
  // 0006 — analytics + newsletter
  'analytics_events',
  'newsletter_signups',
  // 0011 — question_concursos
  'question_concursos',
  // 0012 — shared_decks
  'shared_decks',
  // 0013 — live decks
  'live_decks',
  'live_deck_questions',
  'live_deck_grants',
  // 0015 — push devices
  'push_devices',
  // 0018 — telegram
  'telegram_bindings',
  // 0019 — daily questoes
  'daily_question_sets',
  'daily_question_attempts',
  'daily_preferences',
  // 0020 — ratings
  'question_ratings',
  // 0021 — favoritos
  'deck_favorites',
  // 0022 — discord
  'discord_webhooks',
  // 0023 — comments
  'question_comments',
  // 0024 — audit
  'audit_log',
  // 0025 — applied_migrations
  'applied_migrations',
  // 0026 — ai cache
  'ai_response_cache',
  // 0027 — ai usage
  'ai_usage',
  // 0028 — editais
  'editais',
  'editais_preferences',
  // 0029 — ai personas
  'ai_personas',
  // 0030 — concurso events
  'concurso_events',
  // 0031 — ics tokens
  'ics_tokens',
];

const PAGE_SIZE = 1000;

async function dumpTable(name) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from(name)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      // Tabela pode não existir nesse DB (migration não aplicada) — não
      // é fatal, apenas reporta e segue.
      if (
        error.code === '42P01' ||
        /does not exist/i.test(error.message)
      ) {
        return { skipped: true, reason: 'table not found (migration?)' };
      }
      throw new Error(`${name}: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { rows };
}

async function main() {
  const start = Date.now();
  console.log(`🔄 Backup do Supabase em ${URL}`);
  console.log(`   ${KNOWN_TABLES.length} tabelas a processar\n`);

  const result = {
    metadata: {
      created_at: new Date().toISOString(),
      supabase_url: URL,
      table_count: 0,
      total_rows: 0,
      skipped_tables: [],
    },
    tables: {},
  };

  for (const table of KNOWN_TABLES) {
    process.stdout.write(`  ${table.padEnd(28)} `);
    try {
      const out = await dumpTable(table);
      if ('skipped' in out) {
        process.stdout.write(`⏭  ${out.reason}\n`);
        result.metadata.skipped_tables.push(table);
      } else {
        process.stdout.write(`✓ ${out.rows.length} linhas\n`);
        result.tables[table] = out.rows;
        result.metadata.table_count++;
        result.metadata.total_rows += out.rows.length;
      }
    } catch (e) {
      process.stdout.write(`✗ ${e.message}\n`);
    }
  }

  // Filename: backup-YYYY-MM-DD-HHMMSS.json
  const now = new Date();
  const stamp =
    now.getFullYear() +
    '-' +
    String(now.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(now.getDate()).padStart(2, '0') +
    '-' +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  const filename = `backup-${stamp}.json`;
  const filepath = path.resolve(process.cwd(), filename);

  fs.writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf-8');

  const sizeMb = (fs.statSync(filepath).size / 1024 / 1024).toFixed(2);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log('');
  console.log(`✅ Backup completo em ${elapsed}s`);
  console.log(`   Arquivo: ${filename} (${sizeMb} MB)`);
  console.log(`   Tabelas: ${result.metadata.table_count}`);
  console.log(`   Linhas:  ${result.metadata.total_rows.toLocaleString('pt-BR')}`);
  if (result.metadata.skipped_tables.length > 0) {
    console.log(
      `   Skipped: ${result.metadata.skipped_tables.length} (migrations pendentes?)`
    );
  }
  console.log('');
  console.log(
    '⚠️  IMPORTANTE: mova esse arquivo PRA FORA do projeto (Drive, pen drive).'
  );
  console.log('   Ele contém dados sensíveis e NÃO deve ir pro git.');
  console.log('   .gitignore já cobre backup-*.json — verificar.');
}

main().catch((e) => {
  console.error('❌ Falha:', e);
  process.exit(1);
});
