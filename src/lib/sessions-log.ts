'use client';

/**
 * Log de sessões concluídas — uma linha por sessão completa, salva
 * em localStorage. Usado em /stats pra mostrar progresso ao longo das
 * sessões (não confundir com session-store, que é o estado da sessão
 * em andamento).
 *
 * Armazena os últimos 100 — passa disso, descarta os mais antigos.
 * Limpeza periódica não é necessária; cada save trunca o array.
 *
 * Não sincroniza com Supabase — é puramente local. Se o user troca de
 * device, o log começa do zero. Aceitável: histórico de sessões é
 * informacional, não crítico.
 */

const KEY = 'estudo-simples:sessions-log:v1';
const MAX = 100;

export type SessionLogEntry = {
  id: string;
  kind: 'estudar' | 'discursivas' | 'cards' | 'simulado';
  startedAt: number;
  endedAt: number;
  total: number;
  correct: number;
  wrong: number;
  skipped?: number;
  durationMs: number;
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function appendSession(entry: Omit<SessionLogEntry, 'id'>): void {
  if (typeof window === 'undefined') return;
  try {
    const cur = readSessions();
    const next: SessionLogEntry[] = [{ id: uid(), ...entry }, ...cur].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignora — quota ou indisponível
  }
}

export function readSessions(): SessionLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is SessionLogEntry =>
        s &&
        typeof s.id === 'string' &&
        typeof s.kind === 'string' &&
        typeof s.startedAt === 'number' &&
        typeof s.endedAt === 'number'
    );
  } catch {
    return [];
  }
}

export function clearSessionsLog(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
