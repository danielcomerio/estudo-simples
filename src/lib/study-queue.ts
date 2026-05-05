'use client';

/**
 * Fila temporária de IDs pra "Estudar filtradas/selecionadas".
 *
 * Quando o user clica "Estudar filtradas" no /banco, salvamos a lista
 * de IDs aqui e navegamos pra /estudar?queue=1. A página de estudar
 * lê a fila no mount, monta o pool com aquelas questões e limpa a fila.
 *
 * Por que não passar via URL? Listas grandes (100+ UUIDs) estouram
 * limite seguro de URL (~2KB). localStorage não tem essa restrição.
 *
 * TTL de 5min — se o usuário recarregar e demorar muito, a fila expira
 * pra não confundir uma sessão antiga com uma nova navegação.
 */

const KEY = 'estudo-simples:study-queue:v1';
const TTL_MS = 5 * 60 * 1000;

type Stored = {
  ids: string[];
  kind: 'objetiva' | 'cards';
  savedAt: number;
};

export function saveQueue(ids: string[], kind: 'objetiva' | 'cards' = 'objetiva'): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: Stored = { ids, kind, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // ignora — quota cheia
  }
}

export function readQueue(): Stored | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      Array.isArray(parsed.ids) &&
      typeof parsed.savedAt === 'number' &&
      Date.now() - parsed.savedAt < TTL_MS
    ) {
      return parsed as Stored;
    }
  } catch {}
  return null;
}

export function clearQueue(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
