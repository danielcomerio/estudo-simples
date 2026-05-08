'use client';

/**
 * Persona ativa GLOBAL — aplicada em todos os endpoints de IA do app
 * (Explain, Generate, Discursiva, Cloze, OCR, Coach). Persistida em
 * localStorage. SSR-safe (retorna null no servidor).
 *
 * AICoach segue tendo selector próprio que usa esse mesmo storage.
 *
 * Storage:
 *   `estudo-simples:persona-active` = persona id (uuid) | "" (none)
 */

const KEY = 'estudo-simples:persona-active';

export type ActivePersona = {
  id: string;
  name: string;
  emoji: string | null;
  system_prompt: string;
  concurso_id: string | null;
  preferred_provider?: string | null;
};

let cache: ActivePersona[] | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60_000;

export function getActivePersonaId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(KEY);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}

export function setActivePersonaId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!id) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}

async function fetchPersonas(): Promise<ActivePersona[]> {
  if (cache && Date.now() - cacheLoadedAt < CACHE_TTL_MS) return cache;
  try {
    const r = await fetch('/api/personas');
    if (!r.ok) return [];
    const j = (await r.json()) as { items?: ActivePersona[] };
    cache = j.items ?? [];
    cacheLoadedAt = Date.now();
    return cache;
  } catch {
    return [];
  }
}

/** Pega o system_prompt da persona ativa (ou null se nenhuma). */
export async function getActivePersonaPrompt(): Promise<string | null> {
  const id = getActivePersonaId();
  if (!id) return null;
  const list = await fetchPersonas();
  const p = list.find((x) => x.id === id);
  return p?.system_prompt ?? null;
}

export async function getActivePersona(): Promise<ActivePersona | null> {
  const id = getActivePersonaId();
  if (!id) return null;
  const list = await fetchPersonas();
  return list.find((x) => x.id === id) ?? null;
}

/** Limpa cache — chamar após criar/editar persona. */
export function invalidatePersonaCache(): void {
  cache = null;
  cacheLoadedAt = 0;
}

/**
 * Helper: prefixa system prompt no prompt do user. Idempotente —
 * se persona null/empty, devolve prompt original.
 */
export function withPersona(
  prompt: string,
  systemPrompt: string | null
): string {
  if (!systemPrompt || !systemPrompt.trim()) return prompt;
  return `${systemPrompt.trim()}\n\n---\n\n${prompt}`;
}
