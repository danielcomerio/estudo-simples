#!/usr/bin/env node
/**
 * Concatena todas as migrations *.sql (não _down) na ordem numérica
 * e gera um arquivo único `schema-snapshot-YYYY-MM-DD.sql` que pode
 * ser executado num DB limpo pra recriar TODA a estrutura.
 *
 * Uso:
 *   npm run snapshot:schema
 *
 * Combina com `backup-supabase.mjs` + `restore-supabase.mjs` pra
 * cenário de rollback total. Ver docs/ROLLBACK.md.
 *
 * Limitações:
 * - Storage bucket (questions-images) precisa ser criado manualmente
 *   via Dashboard Storage → New Bucket (não dá pra criar via SQL).
 * - auth.users (usuários) é gerenciado pelo Supabase Auth, não está
 *   nas migrations nem no snapshot.
 */

import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'supabase/migrations');

if (!fs.existsSync(MIGRATIONS_DIR)) {
  console.error(`❌ Pasta não encontrada: ${MIGRATIONS_DIR}`);
  process.exit(1);
}

// Lista *.sql que NÃO sejam _down + ordena pela numeração
const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql') && !f.includes('_down.sql'))
  .sort(); // ordem alfabética = ordem numérica (0001 < 0002 < ... < 0031)

if (files.length === 0) {
  console.error('❌ Nenhuma migration .sql encontrada');
  process.exit(1);
}

console.log(`📋 Concatenando ${files.length} migrations...`);

const lines = [
  '-- =====================================================================',
  `-- SCHEMA SNAPSHOT — gerado em ${new Date().toISOString()}`,
  `-- ${files.length} migrations consolidadas`,
  '-- =====================================================================',
  '--',
  '-- Este arquivo recria o schema COMPLETO do app numa DB Postgres limpa.',
  '-- Aplique no Supabase SQL Editor OU via psql:',
  '--   psql $DATABASE_URL < schema-snapshot-YYYY-MM-DD.sql',
  '--',
  '-- Pra restore COMPLETO (schema + dados): aplica isso primeiro, depois',
  '-- roda `npm run restore -- backup-XXX.json` pra carregar os dados.',
  '--',
  '-- Bucket storage (questions-images) e auth.users NÃO estão aqui — ',
  '-- são managed pelo Supabase, criar manualmente.',
  '-- =====================================================================',
  '',
];

let totalSize = 0;

for (const f of files) {
  const filepath = path.join(MIGRATIONS_DIR, f);
  const content = fs.readFileSync(filepath, 'utf-8');
  totalSize += content.length;

  lines.push(
    '',
    '-- ---------------------------------------------------------------------',
    `-- ${f}`,
    '-- ---------------------------------------------------------------------',
    '',
    content.trim(),
    ''
  );

  console.log(`  ✓ ${f} (${(content.length / 1024).toFixed(1)} KB)`);
}

// Timestamp completo (YYYY-MM-DD-HHMMSS) pra nunca sobrescrever um
// snapshot anterior — mesmo se rodar várias vezes no mesmo dia.
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
const outFile = `schema-snapshot-${stamp}.sql`;
const outPath = path.resolve(process.cwd(), outFile);

fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');

const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1);

console.log('');
console.log(`✅ Snapshot gerado em ${outFile} (${sizeKb} KB)`);
console.log('');
console.log('Uso típico (rollback total):');
console.log('  1. Supabase Dashboard → SQL Editor:');
console.log('       DROP SCHEMA public CASCADE;');
console.log('       CREATE SCHEMA public;');
console.log('  2. Cola o conteúdo de', outFile, '→ Run');
console.log('  3. npm run restore -- backup-XXX.json');
