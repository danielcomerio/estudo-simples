'use client';

import { createClient } from './supabase/client';
import {
  clearPending,
  getState,
  mergeFromServer,
  purgeDeletedLocal,
  setLastPullAt,
  setSyncStatus,
} from './store';
import type { Question } from './types';

let inflight: Promise<void> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/** Mapeia uma row do Supabase para o formato local. */
function rowToQuestion(row: Record<string, unknown>): Question {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    type: row.type as 'objetiva' | 'discursiva',
    disciplina_id: (row.disciplina_id as string | null) ?? null,
    tema: (row.tema as string | null) ?? null,
    banca_estilo: (row.banca_estilo as string | null) ?? null,
    dificuldade: (row.dificuldade as number | null) ?? null,
    payload: (row.payload as Question['payload']) ?? ({} as never),
    srs: row.srs as Question['srs'],
    stats: row.stats as Question['stats'],
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    deleted_at: (row.deleted_at as string | null) ?? null,
  };
}

function questionToRow(q: Question) {
  return {
    id: q.id,
    user_id: q.user_id,
    type: q.type,
    disciplina_id: q.disciplina_id,
    tema: q.tema,
    banca_estilo: q.banca_estilo,
    dificuldade: q.dificuldade,
    payload: q.payload,
    srs: q.srs,
    stats: q.stats,
    deleted_at: q.deleted_at,
  };
}

export async function pushPending(): Promise<{ pushed: number; errors: string[] }> {
  const s = getState();
  const ids = Object.keys(s.pendingSync);
  if (!ids.length) return { pushed: 0, errors: [] };
  if (!s.userId) return { pushed: 0, errors: ['Sem usuário autenticado'] };

  const supabase = createClient();
  const errors: string[] = [];
  let pushed = 0;

  // Envia em chunks de até 100 para não estourar payload
  const toSync = s.questions.filter((q) => s.pendingSync[q.id]);
  const chunks: Question[][] = [];
  for (let i = 0; i < toSync.length; i += 100) chunks.push(toSync.slice(i, i + 100));

  for (const chunk of chunks) {
    const rows = chunk.map(questionToRow);
    const { error } = await supabase
      .from('questions')
      .upsert(rows, { onConflict: 'id' });
    if (error) {
      errors.push(error.message);
      continue;
    }
    pushed += chunk.length;
    clearPending(chunk.map((q) => q.id));
  }

  if (!errors.length) {
    // depois de empurrar deleções, podemos remover localmente as soft-deleted
    purgeDeletedLocal();
  }

  return { pushed, errors };
}

export async function pullSince(): Promise<{ pulled: number; error: string | null }> {
  const s = getState();
  if (!s.userId) return { pulled: 0, error: 'Sem usuário autenticado' };
  const supabase = createClient();

  let query = supabase
    .from('questions')
    .select('*')
    .eq('user_id', s.userId)
    .order('updated_at', { ascending: true })
    .limit(2000);

  if (s.lastPullAt) {
    query = query.gt('updated_at', s.lastPullAt);
  }

  const { data, error } = await query;
  if (error) return { pulled: 0, error: error.message };
  if (!data) return { pulled: 0, error: null };

  const questions = data.map(rowToQuestion);
  if (questions.length) {
    mergeFromServer(questions);
    const last = questions[questions.length - 1].updated_at;
    setLastPullAt(last);
  } else if (!s.lastPullAt) {
    // primeiro pull mesmo sem dados — fixa um marco
    setLastPullAt(new Date().toISOString());
  }
  // remove ainda os já-deletados
  purgeDeletedLocal();
  return { pulled: questions.length, error: null };
}

export async function syncNow(): Promise<void> {
  if (inflight) return inflight;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setSyncStatus('offline');
    return;
  }
  inflight = (async () => {
    setSyncStatus('syncing');
    try {
      const push = await pushPending();
      if (push.errors.length) {
        setSyncStatus('error', push.errors[0]);
        return;
      }
      const pull = await pullSince();
      if (pull.error) {
        setSyncStatus('error', pull.error);
        return;
      }
      setSyncStatus('idle');
    } catch (e) {
      setSyncStatus('error', e instanceof Error ? e.message : 'Falha de sincronização');
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

let scheduleHandle: ReturnType<typeof setTimeout> | null = null;
/** Agenda uma sincronização debouncada (ideal para chamar após cada mutação). */
export function scheduleSync(ms = 1500) {
  if (scheduleHandle) clearTimeout(scheduleHandle);
  scheduleHandle = setTimeout(() => {
    scheduleHandle = null;
    void syncNow();
  }, ms);
}

export function startBackgroundSync() {
  if (typeof window === 'undefined') return;
  if (pollTimer) clearInterval(pollTimer);

  // Sincronia inicial
  void syncNow();

  // Polling a cada 60s
  pollTimer = setInterval(() => void syncNow(), 60_000);

  // Eventos para forçar re-sync
  window.addEventListener('online', () => void syncNow());
  window.addEventListener('focus', () => void syncNow());
}

export function stopBackgroundSync() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
