#!/usr/bin/env node
/**
 * Verifica quais migrations existem no disco e quais estão aplicadas
 * no DB (via tabela applied_migrations introduzida em 0025).
 *
 * Saída:
 *   ✓ aplicadas
 *   ✗ pendentes (existem no disco mas não no DB)
 *   ?  no DB mas sem arquivo (esquisito — investigar)
 *
 * Setup:
 *   export NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co
 *   export SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *   npm run check:migrations
 *
 * Service role pra bypass RLS — só admin roda esse script.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error('❌ Faltam env vars: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const root = path.resolve(process.cwd(), 'supabase/migrations');

// Lista IDs do disco (ignora _down e arquivos não-numéricos no início)
const fileIds = new Set();
for (const f of fs.readdirSync(root)) {
  if (!f.endsWith('.sql') || f.includes('_down.sql')) continue;
  const m = f.match(/^(\d{4})_/);
  if (m) fileIds.add(m[1]);
}

const sb = createClient(URL, KEY, {
  auth: { persistSession: false },
});

const { data, error } = await sb
  .from('applied_migrations')
  .select('id, applied_at')
  .order('id');

if (error) {
  if (error.code === '42P01' || /does not exist/i.test(error.message)) {
    console.error(
      '❌ Tabela applied_migrations não existe. Aplique 0025_applied_migrations_tracking.sql primeiro.'
    );
  } else {
    console.error('❌ Falha ao buscar:', error.message);
  }
  process.exit(2);
}

const dbIds = new Set((data ?? []).map((r) => r.id));
const allIds = new Set([...fileIds, ...dbIds]);
const sorted = Array.from(allIds).sort();

console.log('\nID    | Status     | Arquivo  | DB');
console.log('------+------------+----------+----');
let pending = 0;
let orphan = 0;
for (const id of sorted) {
  const onDisk = fileIds.has(id);
  const onDb = dbIds.has(id);
  let status;
  if (onDisk && onDb) status = '✓ aplicada';
  else if (onDisk && !onDb) {
    status = '✗ pendente ';
    pending++;
  } else if (!onDisk && onDb) {
    status = '? órfã    ';
    orphan++;
  } else {
    status = '— ?       ';
  }
  console.log(
    `${id}  | ${status} | ${onDisk ? 'sim     ' : 'não     '} | ${onDb ? 'sim' : 'não'}`
  );
}

console.log('');
console.log(
  `Total: ${sorted.length} migrations · ${pending} pendentes · ${orphan} órfãs`
);
process.exit(pending > 0 ? 1 : 0);
