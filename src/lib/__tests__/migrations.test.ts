import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Smoke tests pra organização de migrations:
 *  - Toda migration tem par _down.
 *  - Numeração sequencial (sem pular).
 *  - Sem migrations duplicadas.
 *
 * Rodado em CI pra detectar erros simples antes de PR.
 */

const MIGRATIONS_DIR = resolve(__dirname, '../../../supabase/migrations');

function listMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
}

describe('migrations organization', () => {
  it('toda migration *.sql tem par *_down.sql', () => {
    const files = listMigrations();
    const ups = files.filter((f) => !f.includes('_down.sql'));
    const downs = new Set(
      files.filter((f) => f.includes('_down.sql'))
    );
    const missing: string[] = [];
    for (const up of ups) {
      const expectedDown = up.replace(/\.sql$/, '_down.sql');
      if (!downs.has(expectedDown)) missing.push(up);
    }
    expect(
      missing,
      `Migrations sem _down: ${missing.join(', ')}`
    ).toEqual([]);
  });

  it('numeração sequencial sem pular', () => {
    const files = listMigrations();
    const ups = files
      .filter((f) => !f.includes('_down.sql'))
      .map((f) => parseInt(f.slice(0, 4), 10))
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);
    for (let i = 0; i < ups.length - 1; i++) {
      expect(
        ups[i + 1] - ups[i],
        `Pulo entre 0${ups[i]} e 0${ups[i + 1]}`
      ).toBe(1);
    }
  });

  it('numeração começa em 0001', () => {
    const files = listMigrations();
    const numbers = files
      .filter((f) => !f.includes('_down.sql'))
      .map((f) => parseInt(f.slice(0, 4), 10))
      .filter((n) => !isNaN(n));
    expect(Math.min(...numbers)).toBe(1);
  });

  it('sem prefix duplicado (0001 só uma vez sem contar _down)', () => {
    const files = listMigrations();
    const ups = files.filter((f) => !f.includes('_down.sql'));
    const prefixes = ups.map((f) => f.slice(0, 4));
    const unique = new Set(prefixes);
    expect(unique.size).toBe(prefixes.length);
  });
});
