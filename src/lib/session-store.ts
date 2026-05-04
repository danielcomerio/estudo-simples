'use client';

/**
 * Persistência da sessão de estudo (objetivas) em localStorage.
 *
 * Permite "Pausar/Continuar": ao recarregar o app no meio de uma
 * sessão, oferecemos retomar de onde parou. Igual ao /simulado já
 * faz, mas pra estudar livre.
 *
 * Salva: poolIds (não as questões inteiras — re-resolve na hora),
 * idx, correct, wrong, skipped, embaralhar, tempoLimite, free,
 * startedAt, userId.
 *
 * Validação leve ao ler — adulteração retorna null.
 */

/** Sessões persistidas por modo (estudar / discursivas / cards). Permite
 *  pausar/retomar cada uma independentemente. */
export type SessionKind = 'estudar' | 'discursivas' | 'cards';
const STORAGE_KEYS: Record<SessionKind, string> = {
  estudar: 'estudo-simples:study-session:v1',
  discursivas: 'estudo-simples:disc-session:v1',
  cards: 'estudo-simples:cards-session:v1',
};

export type StoredSession = {
  userId: string;
  poolIds: string[];
  idx: number;
  embaralhar: boolean;
  tempoLimite: number;
  free?: boolean;
  correct: number;
  wrong: number;
  skipped: number;
  startedAt: number;
};

export function saveSession(s: StoredSession, kind: SessionKind = 'estudar'): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS[kind], JSON.stringify(s));
  } catch {
    // ignora — sessão é best-effort
  }
}

export function readSession(userId: string, kind: SessionKind = 'estudar'): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS[kind]);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.userId === userId &&
      Array.isArray(parsed.poolIds) &&
      typeof parsed.idx === 'number' &&
      typeof parsed.startedAt === 'number'
    ) {
      return parsed as StoredSession;
    }
  } catch {}
  return null;
}

export function clearSession(kind: SessionKind = 'estudar'): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEYS[kind]);
  } catch {}
}
