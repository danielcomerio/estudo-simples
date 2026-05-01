'use client';

import { toast } from '@/components/Toast';
import { createClient } from './supabase/client';
import {
  clearPending,
  discardLocal,
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
    // Campos da migration 0002 — server pode não retornar (rows antigas
    // pré-0002 ou cliente lendo de schema sem essas colunas) → trata
    // como null/[] pra não vazar undefined no estado.
    topico_id: (row.topico_id as string | null) ?? null,
    concurso_id: (row.concurso_id as string | null) ?? null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
  };
}

function questionToRow(q: Question) {
  // Inclui campos da 0002 sempre (server tem default '[]' pra tags e
  // permite null em topico_id/concurso_id; FKs compostos garantem
  // user_id consistente). Sem esses campos no upsert, push apagaria
  // mudanças locais de hierarquia.
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
    topico_id: q.topico_id ?? null,
    concurso_id: q.concurso_id ?? null,
    tags: q.tags ?? [],
  };
}

export type PushResult = {
  pushed: number;
  /** Questões locais descartadas pq DB já tem com mesmo dedup_hash (id diferente). */
  discarded: number;
  errors: string[];
};

export async function pushPending(): Promise<PushResult> {
  const s = getState();
  const ids = Object.keys(s.pendingSync);
  if (!ids.length) return { pushed: 0, discarded: 0, errors: [] };
  if (!s.userId) return { pushed: 0, discarded: 0, errors: ['Sem usuário autenticado'] };

  const supabase = createClient();
  const errors: string[] = [];
  let pushed = 0;
  const toDiscard: string[] = [];

  const toSync = s.questions.filter((q) => s.pendingSync[q.id]);
  const chunks: Question[][] = [];
  for (let i = 0; i < toSync.length; i += 100) chunks.push(toSync.slice(i, i + 100));

  for (const chunk of chunks) {
    const rows = chunk.map(questionToRow);
    const { error } = await supabase
      .from('questions')
      .upsert(rows, { onConflict: 'id' });

    if (!error) {
      pushed += chunk.length;
      clearPending(chunk.map((q) => q.id));
      continue;
    }

    // 23505 = unique_violation. No nosso schema, o índice único é
    // `(user_id, dedup_hash) where deleted_at is null`. Significa: alguma
    // row do chunk colide (entre si ou com o servidor) por dedup_hash.
    // Postgres falha o chunk inteiro atomicamente. Retentar item-por-item
    // identifica QUAIS são duplicatas — descartá-las localmente desbloqueia
    // o sync das outras. Sem isso, 1 questão duplicada trava 100 (caso
    // real do user, 100 discursivas presas).
    if (error.code !== '23505') {
      errors.push(error.message);
      continue;
    }

    for (const q of chunk) {
      const row = questionToRow(q);
      const { error: indErr } = await supabase
        .from('questions')
        .upsert([row], { onConflict: 'id' });
      if (!indErr) {
        pushed++;
        clearPending([q.id]);
      } else if (indErr.code === '23505') {
        // Duplicata por dedup_hash: o conteúdo já está no servidor com
        // outro id. Descartar local é seguro porque pull em seguida vai
        // trazer a versão canônica do servidor.
        toDiscard.push(q.id);
      } else {
        errors.push(indErr.message);
      }
    }
  }

  if (toDiscard.length > 0) discardLocal(toDiscard);

  if (!errors.length) {
    purgeDeletedLocal();
  }

  return { pushed, discarded: toDiscard.length, errors };
}

/**
 * Pagina manualmente para contornar o limite default de 1000 linhas
 * por response do PostgREST (Supabase). Repulla rows com updated_at
 * exatamente igual ao cursor (gte) — mergeFromServer dedupa por id,
 * então o custo é desprezível e cobre transações em lote em que várias
 * linhas compartilham o mesmo timestamp (now() é igual no escopo da
 * transação).
 */
export async function pullSince(): Promise<{ pulled: number; error: string | null }> {
  const s = getState();
  if (!s.userId) return { pulled: 0, error: 'Sem usuário autenticado' };
  const supabase = createClient();

  const PAGE_SIZE = 1000;
  const MAX_PAGES = 100; // teto de segurança: 100k linhas

  let offset = 0;
  let total = 0;
  let lastSeenTs: string | null = null;

  for (let i = 0; i < MAX_PAGES; i++) {
    let query = supabase
      .from('questions')
      .select('*')
      .eq('user_id', s.userId)
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (s.lastPullAt) {
      query = query.gte('updated_at', s.lastPullAt);
    }

    const { data, error } = await query;
    if (error) return { pulled: total, error: error.message };
    if (!data || data.length === 0) break;

    const questions = data.map(rowToQuestion);
    mergeFromServer(questions);
    total += questions.length;
    lastSeenTs = questions[questions.length - 1].updated_at;

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (lastSeenTs) {
    setLastPullAt(lastSeenTs);
  } else if (!s.lastPullAt) {
    // primeiro pull mesmo sem dados — fixa um marco
    setLastPullAt(new Date().toISOString());
  }

  purgeDeletedLocal();
  return { pulled: total, error: null };
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
      // Descarte por duplicata é informativo, não erro: a versão canônica
      // já está no servidor e vai voltar no pull. User merece saber pra
      // entender se uma questão "sumiu" do banco local.
      if (push.discarded > 0) {
        toast(
          `${push.discarded} questão(ões) duplicada(s) detectada(s) e descartada(s) localmente — o conteúdo já existia no servidor.`,
          'warn'
        );
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
