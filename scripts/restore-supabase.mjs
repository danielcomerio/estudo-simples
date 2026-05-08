#!/usr/bin/env node
/**
 * Restore de backup JSON gerado por `npm run backup`.
 *
 * Uso:
 *   npm run restore -- backup-2026-05-07-231305.json
 *
 * Insere os dados em ORDEM DE DEPENDÊNCIA (FK-aware):
 *   profiles → concursos → disciplinas → concurso_disciplinas → topicos
 *   → questions → question_concursos → shared_decks → live_decks → ...
 *
 * Usa upsert com onConflict pra ser idempotente — re-rodar não duplica.
 *
 * PRÉ-REQUISITOS:
 *  - Schema já criado (rodar schema-snapshot ou todas migrations antes).
 *  - auth.users dos owners das linhas DEVE existir (FK exige).
 *    Se restore num project NOVO sem usuários, restore vai falhar nas
 *    tabelas com user_id. Solução: re-criar contas via Supabase Auth
 *    com mesmos UUIDs (avançado) ou fazer restore só pro owner atual.
 *  - Service role key em .env.local.
 *
 * Limitações:
 *  - Sequences/IDs auto-incrementados (bigserial em analytics_events,
 *    audit_log) podem ficar fora de sync. Pra resetar:
 *    SELECT setval('table_id_seq', (SELECT MAX(id) FROM table));
 *  - Storage objects (imagens) NÃO restaurados — ficam no bucket
 *    Supabase Storage (não no DB).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

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
  process.exit(1);
}

const backupFile = process.argv[2];
if (!backupFile) {
  console.error('❌ Uso: npm run restore -- backup-YYYY-MM-DD-HHMMSS.json');
  process.exit(1);
}
if (!fs.existsSync(backupFile)) {
  console.error(`❌ Arquivo não encontrado: ${backupFile}`);
  process.exit(1);
}

console.log(`📂 Lendo ${backupFile}...`);
const raw = fs.readFileSync(backupFile, 'utf-8');
let backup;
try {
  backup = JSON.parse(raw);
} catch (e) {
  console.error('❌ JSON inválido:', e.message);
  process.exit(1);
}

if (!backup.tables || typeof backup.tables !== 'object') {
  console.error('❌ Backup malformado (sem campo .tables)');
  process.exit(1);
}

console.log(`   Backup criado em: ${backup.metadata?.created_at ?? '?'}`);
console.log(`   Tabelas: ${Object.keys(backup.tables).length}`);
console.log(`   Total linhas: ${(backup.metadata?.total_rows ?? 0).toLocaleString('pt-BR')}\n`);

// Confirmação extra (não dá UX bonita em CLI mas ok)
console.log('⚠️  ATENÇÃO: vai inserir/atualizar dados no Supabase em', URL);
console.log('   Use upsert — re-rodar não duplica.\n');

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// ORDEM DE DEPENDÊNCIA (FK-aware)
// Tabelas que dependem de outras vêm DEPOIS das suas dependências.
// auth.users é externa (gerenciada pelo Supabase Auth), não está aqui.
const RESTORE_ORDER = [
  // Independentes ou só dependentes de auth.users
  'profiles',
  'concursos',
  'disciplinas',
  'edital_itens',
  'topicos',
  'analytics_events',
  'newsletter_signups',
  'stripe_events',
  'editais',
  'editais_preferences',
  'discord_webhooks',
  'telegram_bindings',
  'push_devices',
  'audit_log',
  'ai_usage',
  'ai_response_cache',
  'ics_tokens',
  'daily_question_sets',
  'daily_preferences',

  // 2º nível — dependem dos acima
  'concurso_disciplinas', // → concursos + disciplinas
  'questions', // → disciplinas (uuid)
  'ai_personas', // → concursos (opcional)
  'concurso_events', // → concursos
  'daily_question_attempts', // → daily_question_sets

  // 3º nível — dependem das acima
  'question_concursos', // → questions + concursos
  'question_ratings', // → questions
  'question_comments', // → questions
  'shared_decks', // → questions (snapshot embebido)
  'live_decks', // → questions

  // 4º nível
  'live_deck_questions', // → live_decks + questions
  'live_deck_grants', // → live_decks
  'deck_favorites', // → shared_decks

  // Última (controle)
  'applied_migrations',
];

// Conflict columns por tabela (pra upsert correto)
const CONFLICT_COLS = {
  profiles: 'user_id',
  concursos: 'id',
  disciplinas: 'id',
  concurso_disciplinas: 'concurso_id,disciplina_id',
  topicos: 'id',
  edital_itens: 'id',
  questions: 'id',
  question_concursos: 'question_id,concurso_id',
  question_ratings: 'user_id,question_id',
  question_comments: 'id',
  shared_decks: 'id',
  live_decks: 'id',
  live_deck_questions: 'live_deck_id,question_id',
  live_deck_grants: 'id',
  push_devices: 'user_id,token',
  telegram_bindings: 'user_id',
  daily_question_sets: 'id',
  daily_question_attempts: 'user_id,set_id',
  daily_preferences: 'user_id',
  deck_favorites: 'user_id,deck_id',
  discord_webhooks: 'user_id',
  audit_log: 'id',
  applied_migrations: 'id',
  ai_response_cache: 'cache_key',
  ai_usage: 'id',
  editais: 'source,source_id',
  editais_preferences: 'user_id',
  ai_personas: 'id',
  concurso_events: 'id',
  ics_tokens: 'user_id',
  analytics_events: 'id',
  newsletter_signups: 'id',
  stripe_events: 'id',
};

const CHUNK_SIZE = 500;

async function restoreTable(name, rows) {
  if (!rows || rows.length === 0) return { inserted: 0, skipped: true };

  const onConflict = CONFLICT_COLS[name];
  if (!onConflict) {
    return { inserted: 0, error: `sem onConflict definido pra ${name}` };
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await sb.from(name).upsert(chunk, { onConflict });
    if (error) {
      return {
        inserted,
        error: `chunk ${Math.floor(i / CHUNK_SIZE) + 1}: ${error.message}`,
      };
    }
    inserted += chunk.length;
  }
  return { inserted };
}

async function main() {
  const start = Date.now();
  let total = 0;
  let errors = 0;

  for (const table of RESTORE_ORDER) {
    const rows = backup.tables[table];
    if (rows === undefined) {
      // Tabela não está no backup (não foi exportada)
      continue;
    }
    process.stdout.write(`  ${table.padEnd(28)} (${String(rows.length).padStart(5)} linhas) `);
    try {
      const out = await restoreTable(table, rows);
      if (out.skipped) {
        process.stdout.write('— vazio\n');
      } else if (out.error) {
        process.stdout.write(`✗ ${out.error}\n`);
        errors++;
      } else {
        process.stdout.write(`✓ ${out.inserted}\n`);
        total += out.inserted;
      }
    } catch (e) {
      process.stdout.write(`✗ ${e.message}\n`);
      errors++;
    }
  }

  // Tabelas que estão no backup mas não no RESTORE_ORDER (esquisito)
  const orphans = Object.keys(backup.tables).filter(
    (t) => !RESTORE_ORDER.includes(t)
  );
  if (orphans.length > 0) {
    console.log(`\n⚠️  Tabelas no backup mas SEM restore order definido:`);
    for (const o of orphans) {
      console.log(`   - ${o} (${backup.tables[o].length} linhas)`);
    }
    console.log('   Adicione em RESTORE_ORDER + CONFLICT_COLS no script.');
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log('');
  console.log(`✅ Restore completo em ${elapsed}s`);
  console.log(`   Total inserido/atualizado: ${total.toLocaleString('pt-BR')}`);
  if (errors > 0) {
    console.log(`   ⚠️  Erros: ${errors}`);
    process.exit(1);
  }
  console.log('');
  console.log('Próximos passos manuais (se necessário):');
  console.log('  1. Storage bucket (questions-images): criar via Dashboard');
  console.log('     se for project novo. Ver supabase/storage_setup.sql.');
  console.log('  2. Resetar sequences se notar IDs duplicados em INSERTs');
  console.log('     futuros (raro, só se restore aconteceu sobre dados pre-existentes).');
}

main().catch((e) => {
  console.error('❌ Falha fatal:', e);
  process.exit(1);
});
