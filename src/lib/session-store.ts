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

const STORAGE_KEY = 'estudo-simples:study-session:v1';

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

export function saveSession(s: StoredSession): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignora — sessão é best-effort
  }
}

export function readSession(userId: string): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
