#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'src');
const all = new Set();

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name).replace(/\\/g, '/');
    if (e.isDirectory()) walk(f);
    else if (/\.(ts|tsx)$/.test(f) && !f.includes('__tests__')) all.add(f);
  }
}
walk(root);

const allFiles = Array.from(all);
const allContent = allFiles.map((f) => fs.readFileSync(f, 'utf-8')).join('\n');

const ENTRY = new Set([
  'page', 'layout', 'route', 'middleware', 'icon', 'apple-icon',
  'manifest', 'sitemap', 'robots', 'opengraph-image', 'twitter-image',
  'loading', 'not-found', 'error', 'global-error', 'default', 'template',
]);

const unused = [];
for (const f of all) {
  const base = path.basename(f).replace(/\.(ts|tsx)$/, '');
  if (ENTRY.has(base)) continue;
  // Conta menções (import por nome de arquivo)
  const re = new RegExp(`[\\\\/'"]${base}['"]`, 'g');
  const matches = allContent.match(re) || [];
  if (matches.length === 0) unused.push(f);
}

if (unused.length === 0) {
  console.log('Nenhum arquivo aparente sem referência.');
} else {
  console.log(`${unused.length} arquivos suspeitos de não-uso:`);
  for (const f of unused) console.log('  -', f.replace(root + '/', ''));
}
