'use client';

/**
 * Persiste preferências de sessão entre sessões. Lembra modo,
 * quantidade, flags (interleaving, free, activeRecall, retryWrong)
 * — não inclui campos derivados de banco (disciplinas filtradas).
 *
 * Cada runner (estudar/discursivas/cards) tem sua chave própria.
 */

const KEY_PREFIX = 'estudo-simples:session-prefs:v1:';

export type SessionPrefs<T> = T;

export function loadPrefs<T>(kind: 'estudar' | 'discursivas' | 'cards'): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY_PREFIX + kind);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function savePrefs<T>(
  kind: 'estudar' | 'discursivas' | 'cards',
  prefs: T
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY_PREFIX + kind, JSON.stringify(prefs));
  } catch {
    // ignora
  }
}
