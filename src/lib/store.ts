'use client';

import { useRef, useSyncExternalStore } from 'react';
import LZString from 'lz-string';
import type { Question } from './types';
import { uid } from './utils';
import { available as idbAvailable, idbDelete, idbGet, idbSet } from './idb';

const STORAGE_KEY = 'estudo-simples:v2';
const STORAGE_KEY_USER = 'estudo-simples:v2:user';
const IDB_KEY_STATE = 'state';
/** Marca o início da string comprimida, distinguindo de JSON cru
 *  (compatibilidade pra ler estados salvos antes da compressão). */
const COMPRESSED_PREFIX = 'LZ:';

export type StoreState = {
  /** Questões locais (todas, inclusive as soft-deleted ainda não confirmadas). */
  questions: Question[];
  /** Conjunto de ids com mutação local não enviada ao servidor. */
  pendingSync: Record<string, true>;
  /** Último pull bem-sucedido (ISO). */
  lastPullAt: string | null;
  /** Status de sincronização. */
  syncStatus: 'idle' | 'syncing' | 'error' | 'offline';
  syncError: string | null;
  /** Carregamento inicial concluído? */
  hydrated: boolean;
  /** Id do usuário autenticado atualmente (cache). */
  userId: string | null;
};

const initial: StoreState = {
  questions: [],
  pendingSync: {},
  lastPullAt: null,
  syncStatus: 'idle',
  syncError: null,
  hydrated: false,
  userId: null,
};

let state: StoreState = initial;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

/** Variável de debounce — múltiplas mutações em sequência viram 1
 *  persist. Compressão de ~5MB de JSON leva centenas de ms; sem
 *  debounce, rate em sequência (ex: studar 10 questões rápido)
 *  trava a UI. Threshold curto (200ms) preserva durabilidade — uma
 *  mutação no max 200ms antes de persistir. */
let persistTimeout: ReturnType<typeof setTimeout> | null = null;

function persistNow() {
  if (typeof window === 'undefined') return;
  const { hydrated: _h, syncStatus: _s, syncError: _e, ...persistable } = state;
  // Preferência: IndexedDB (quota gigante, suporta objects nativos via
  // structured cloning — sem custo de JSON.stringify + compressão).
  // Fallback: localStorage comprimido pra browsers sem IDB ou se IDB
  // falhar.
  if (idbAvailable()) {
    void idbSet(IDB_KEY_STATE, persistable).catch((e) => {
      console.warn('IDB persist falhou, fallback localStorage:', e);
      persistToLocalStorage(persistable);
    });
    return;
  }
  persistToLocalStorage(persistable);
}

function persistToLocalStorage(persistable: object) {
  try {
    const json = JSON.stringify(persistable);
    const compressed = COMPRESSED_PREFIX + LZString.compressToUTF16(json);
    localStorage.setItem(STORAGE_KEY, compressed);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.error('localStorage cheio — IDB também falhou? estado pode não persistir');
    }
  }
}

function persist() {
  if (typeof window === 'undefined') return;
  if (persistTimeout) clearTimeout(persistTimeout);
  persistTimeout = setTimeout(() => {
    persistTimeout = null;
    persistNow();
  }, 200);
}

// Garante persist no fechamento da aba (evento beforeunload) caso
// haja mutação pendente. UI tem tempo de salvar antes do navegador
// matar a página.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (persistTimeout) {
      clearTimeout(persistTimeout);
      persistTimeout = null;
      persistNow();
    }
  });
}

/** Lê e descomprime do localStorage. Compatível com formato legado
 *  (JSON cru) e novo (LZ-comprimido). */
function readFromLocalStorage(): Partial<StoreState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    let json: string;
    if (raw.startsWith(COMPRESSED_PREFIX)) {
      const decompressed = LZString.decompressFromUTF16(
        raw.slice(COMPRESSED_PREFIX.length)
      );
      if (!decompressed) return null;
      json = decompressed;
    } else {
      json = raw;
    }
    const parsed = JSON.parse(json);
    if (parsed && Array.isArray(parsed.questions)) return parsed;
    return null;
  } catch {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) localStorage.setItem(STORAGE_KEY + ':backup-' + Date.now(), raw);
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    return null;
  }
}

/**
 * Lê estado persistido com prioridade: IDB (objeto nativo) → localStorage
 * (LZ-comprimido). Migração silenciosa: se achar no localStorage, salva
 * em IDB e limpa o localStorage.
 */
async function readPersisted(): Promise<Partial<StoreState> | null> {
  if (idbAvailable()) {
    try {
      const idbState = await idbGet<Partial<StoreState>>(IDB_KEY_STATE);
      if (idbState && Array.isArray(idbState.questions)) {
        return idbState;
      }
    } catch (e) {
      console.warn('IDB read falhou:', e);
    }
  }
  // Fallback: localStorage (pode ser primeira hidrate pós-migração IDB)
  const ls = readFromLocalStorage();
  if (ls && idbAvailable()) {
    // Migra silenciosamente pro IDB e remove do localStorage
    try {
      await idbSet(IDB_KEY_STATE, ls);
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
  return ls;
}

export function getState(): StoreState {
  return state;
}

export function setState(updater: (s: StoreState) => StoreState, opts?: { skipPersist?: boolean }) {
  state = updater(state);
  if (!opts?.skipPersist) persist();
  notify();
}

/**
 * Migra dados criados como visitante pra uma conta recém-criada.
 *
 * Lê o estado persistido (que ainda tem userId='guest' nas questions),
 * re-tagger user_id pra newUserId em cada questão, marca todas como
 * pendingSync (pra próxima sync subir tudo), e atualiza
 * STORAGE_KEY_USER. Hydrate subsequente vai ler como se fosse do user
 * real.
 *
 * Idempotente: se o estado já está com newUserId, não duplica.
 */
export async function migrateGuestToUser(newUserId: string): Promise<{
  migrated: number;
}> {
  if (typeof window === 'undefined') return { migrated: 0 };
  if (!newUserId || newUserId === 'guest') return { migrated: 0 };

  const persisted = (await readPersisted()) ?? {};
  const oldQuestions = persisted.questions ?? [];
  if (oldQuestions.length === 0) {
    // Nada a migrar; só atualiza marker
    try {
      localStorage.setItem(STORAGE_KEY_USER, newUserId);
    } catch {}
    return { migrated: 0 };
  }

  const newQuestions = oldQuestions.map((q) => ({
    ...q,
    user_id: newUserId,
  }));
  // Marca tudo como pendente — push subsequente envia ao servidor.
  const newPending: Record<string, true> = {};
  for (const q of newQuestions) newPending[q.id] = true;

  const newPersisted: Partial<StoreState> = {
    ...persisted,
    questions: newQuestions,
    pendingSync: newPending,
    // Reseta lastPullAt — a primeira sync vai puxar do servidor (que
    // tá vazio pro user novo) e somar com nosso local via merge.
    lastPullAt: null,
  };

  // Persiste imediatamente
  if (idbAvailable()) {
    try {
      await idbSet(IDB_KEY_STATE, newPersisted);
    } catch {}
  } else {
    try {
      const json = JSON.stringify(newPersisted);
      const compressed = COMPRESSED_PREFIX + LZString.compressToUTF16(json);
      localStorage.setItem(STORAGE_KEY, compressed);
    } catch {}
  }

  try {
    localStorage.setItem(STORAGE_KEY_USER, newUserId);
  } catch {}

  return { migrated: newQuestions.length };
}

export async function hydrate(userId: string | null): Promise<void> {
  if (typeof window === 'undefined') return;

  // Se trocou de usuário, limpa o cache (LS + IDB).
  let cachedUser: string | null = null;
  try {
    cachedUser = localStorage.getItem(STORAGE_KEY_USER);
  } catch {}
  if (userId && cachedUser && cachedUser !== userId) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    if (idbAvailable()) {
      try {
        await idbDelete(IDB_KEY_STATE);
      } catch {}
    }
  }
  if (userId) {
    try {
      localStorage.setItem(STORAGE_KEY_USER, userId);
    } catch {}
  }

  const loaded = (await readPersisted()) ?? {};

  state = {
    ...initial,
    ...loaded,
    userId,
    hydrated: true,
  };
  notify();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/**
 * Hook reativo. Cacheia o resultado do selector enquanto a referência de
 * `state` não mudar — sem isso, selectors que retornam novos arrays
 * (como `questions.filter(...)`) causam loop infinito em
 * useSyncExternalStore (Object.is detecta "mudou" toda render).
 */
export function useStore<T>(selector: (s: StoreState) => T): T {
  const cacheRef = useRef<{ src: StoreState | null; value: T }>({
    src: null,
    value: undefined as unknown as T,
  });

  const getSnapshot = (src: StoreState): T => {
    const cache = cacheRef.current;
    if (cache.src === src) return cache.value;
    const value = selector(src);
    cacheRef.current = { src, value };
    return value;
  };

  return useSyncExternalStore(
    subscribe,
    () => getSnapshot(state),
    () => getSnapshot(initial)
  );
}

/* ============== Mutações ============== */

function markDirty(id: string) {
  state.pendingSync[id] = true;
}

export function addQuestionLocal(
  partial: Omit<Question, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
  userId: string
): Question {
  const now = new Date().toISOString();
  const q: Question = {
    id: uid(),
    user_id: userId,
    created_at: now,
    updated_at: now,
    ...partial,
    _dirty: true,
  };
  setState((s) => ({
    ...s,
    questions: [...s.questions, q],
    pendingSync: { ...s.pendingSync, [q.id]: true },
  }));
  return q;
}

export function addQuestionsBulk(
  items: Array<Omit<Question, 'id' | 'user_id' | 'created_at' | 'updated_at'>>,
  userId: string
): Question[] {
  const now = new Date().toISOString();
  const created: Question[] = items.map((p) => ({
    id: uid(),
    user_id: userId,
    created_at: now,
    updated_at: now,
    ...p,
    _dirty: true,
  }));
  setState((s) => {
    const pending = { ...s.pendingSync };
    for (const q of created) pending[q.id] = true;
    return {
      ...s,
      questions: [...s.questions, ...created],
      pendingSync: pending,
    };
  });
  return created;
}

export function updateQuestionLocal(
  id: string,
  patch: Partial<Question> | ((q: Question) => Partial<Question>)
) {
  setState((s) => {
    const idx = s.questions.findIndex((q) => q.id === id);
    if (idx === -1) return s;
    const cur = s.questions[idx];
    const fields = typeof patch === 'function' ? patch(cur) : patch;
    const next: Question = {
      ...cur,
      ...fields,
      updated_at: new Date().toISOString(),
      _dirty: true,
    };
    const list = s.questions.slice();
    list[idx] = next;
    return {
      ...s,
      questions: list,
      pendingSync: { ...s.pendingSync, [id]: true },
    };
  });
}

export function deleteQuestionLocal(id: string) {
  setState((s) => {
    const idx = s.questions.findIndex((q) => q.id === id);
    if (idx === -1) return s;
    const cur = s.questions[idx];
    const next: Question = {
      ...cur,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _dirty: true,
    };
    const list = s.questions.slice();
    list[idx] = next;
    return {
      ...s,
      questions: list,
      pendingSync: { ...s.pendingSync, [id]: true },
    };
  });
}

export function deleteQuestionsBulk(ids: string[]) {
  setState((s) => {
    const set = new Set(ids);
    const now = new Date().toISOString();
    const pending = { ...s.pendingSync };
    const list = s.questions.map((q) => {
      if (!set.has(q.id)) return q;
      pending[q.id] = true;
      return { ...q, deleted_at: now, updated_at: now, _dirty: true };
    });
    return { ...s, questions: list, pendingSync: pending };
  });
}

/**
 * Remove questões definitivamente do estado local (hard-delete) e do
 * pendingSync. Diferente de `deleteQuestionLocal` (soft-delete + marca
 * pending pra propagar a deleção pro servidor): aqui as questões são
 * removidas como se nunca tivessem existido localmente.
 *
 * Uso atual: sync detectou 23505 (duplicate key) ao tentar pushar — o
 * conteúdo já existe no servidor com outro id. Não há nada pra
 * propagar; só descartar a cópia local.
 */
export function discardLocal(ids: string[]) {
  if (!ids.length) return;
  setState((s) => {
    const set = new Set(ids);
    const pending = { ...s.pendingSync };
    for (const id of ids) delete pending[id];
    return {
      ...s,
      questions: s.questions.filter((q) => !set.has(q.id)),
      pendingSync: pending,
    };
  });
}

export function clearPending(ids: string[]) {
  setState((s) => {
    const pending = { ...s.pendingSync };
    for (const id of ids) delete pending[id];
    const list = s.questions.map((q) =>
      ids.includes(q.id) ? { ...q, _dirty: false } : q
    );
    return { ...s, questions: list, pendingSync: pending };
  });
}

export function mergeFromServer(rows: Question[]) {
  setState((s) => {
    const byId = new Map(s.questions.map((q) => [q.id, q] as const));
    for (const r of rows) {
      const local = byId.get(r.id);
      // Se local tem mutação não sincronizada, ignora servidor para esse id.
      if (local && s.pendingSync[r.id]) continue;
      byId.set(r.id, { ...r, _dirty: false });
    }
    return { ...s, questions: Array.from(byId.values()) };
  });
}

export function purgeDeletedLocal() {
  setState((s) => ({
    ...s,
    questions: s.questions.filter(
      (q) => !q.deleted_at || s.pendingSync[q.id]
    ),
  }));
}

export function setSyncStatus(
  status: StoreState['syncStatus'],
  error: string | null = null
) {
  setState(
    (s) => ({ ...s, syncStatus: status, syncError: error }),
    { skipPersist: true }
  );
}

export function setLastPullAt(iso: string) {
  setState((s) => ({ ...s, lastPullAt: iso }));
}

export function resetStore() {
  state = { ...initial, hydrated: true };
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY_USER);
  } catch {}
  if (idbAvailable()) {
    void idbDelete(IDB_KEY_STATE).catch(() => {});
  }
  notify();
}

/* ============== Selectors ============== */

export const selectActiveQuestions = (s: StoreState) =>
  s.questions.filter((q) => !q.deleted_at);

export const selectDisciplinas = (s: StoreState): string[] => {
  const set = new Set<string>();
  for (const q of s.questions) {
    if (!q.deleted_at && q.disciplina_id) set.add(q.disciplina_id);
  }
  return Array.from(set).sort();
};
