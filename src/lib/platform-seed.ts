'use client';

import { addQuestionsBulk } from './store';
import type { Question } from './types';

/**
 * Seed da plataforma: questões base que o owner do app marca com a
 * tag "platform" e exporta via `npm run export:platform` pra
 * `public/platform-questions.json`.
 *
 * Visitantes e contas novas carregam esse seed na primeira visita
 * (banco vazio) — cada um ganha clones com novo id, user_id próprio
 * e SRS/stats zerados. Nenhum estado é compartilhado.
 *
 * Após carregar, marca um flag em localStorage por user pra não
 * recarregar em toda boot. `clearSeedFlag` permite forçar um
 * reload manual depois (útil quando a plataforma é atualizada).
 */

const SEED_URL = '/platform-questions.json';
// v2 bump: a v1 marcava flag mesmo quando o seed vinha vazio, prendendo
// quem entrou antes do master publicar. v2 só marca quando carregou de
// verdade (>0 itens). Quem tinha v1 setado é ignorado e refaz o check.
const FLAG_PREFIX = 'estudo-simples:seed-applied:v2:';

const flagKey = (uid: string) => FLAG_PREFIX + uid;

export function isSeedApplied(userId: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(flagKey(userId)) === '1';
  } catch {
    return false;
  }
}

function markApplied(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(flagKey(userId), '1');
  } catch {
    // ignora
  }
}

export function clearSeedFlag(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(flagKey(userId));
  } catch {
    // ignora
  }
}

type SeedItem = Partial<Question> & { type: Question['type'] };

/**
 * Tenta carregar o seed. Retorna a quantidade clonada. Só marca o flag
 * quando carrega >0 questões — caso o master ainda não tenha publicado
 * (seed vazio ou 404), tenta de novo na próxima visita.
 */
export async function loadPlatformSeed(userId: string): Promise<number> {
  if (isSeedApplied(userId)) return 0;
  try {
    // no-store evita o navegador servir um JSON cacheado quando o
    // master atualiza o seed em produção. Vercel manda Cache-Control
    // próprio, mas isso garante.
    const res = await fetch(SEED_URL, { cache: 'no-store' });
    if (!res.ok) {
      // Sem markApplied — 404 é transitório (deploy em andamento, etc.)
      return 0;
    }
    const raw = (await res.json()) as unknown;
    if (!Array.isArray(raw) || raw.length === 0) {
      // Seed ainda vazio — não marca, retentaremos na próxima visita.
      return 0;
    }
    const now = Date.now();
    const items = (raw as SeedItem[]).map((q) => {
      // Drop identificadores e estado per-user; addQuestionsBulk gera
      // id e user_id no caller.
      const {
        id: _id,
        user_id: _uid,
        created_at: _ca,
        updated_at: _ua,
        deleted_at: _da,
        srs: _srs,
        stats: _stats,
        _dirty: _d,
        ...rest
      } = q;
      return {
        ...rest,
        deleted_at: null,
        srs: {
          easeFactor: 2.5,
          interval: 0,
          repetitions: 0,
          dueDate: now,
          lastReviewed: null,
        },
        stats: { attempts: 0, correct: 0, wrong: 0, history: [] },
      } as Omit<Question, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
    });
    addQuestionsBulk(items, userId);
    markApplied(userId);
    return items.length;
  } catch (e) {
    console.error('[platform-seed] erro:', e);
    return 0;
  }
}
