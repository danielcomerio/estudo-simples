'use client';

/**
 * Persistência de simulados em localStorage.
 *
 * Decisões:
 *  - localStorage (não IndexedDB) — simples, suficiente pra dezenas de
 *    simulados. Migrar pra IndexedDB se chegar perto de 5MB.
 *  - Não vai pro Supabase nesta etapa. Cross-device requer nova
 *    migration (futura).
 *  - Versionado via STORAGE_KEY com sufixo `:v1`. Subir pra v2 implica
 *    migrar ou descartar.
 *  - Validação ao ler — localStorage adulterado retorna lista vazia
 *    em vez de propagar lixo. Mesmo padrão de settings.ts.
 */

import { useEffect, useState } from 'react';
import type { Simulado } from './types';

const STORAGE_KEY = 'estudo-simples:simulados:v1';

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function isValidSimulado(x: unknown): x is Simulado {
  if (!x || typeof x !== 'object') return false;
  const s = x as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.user_id === 'string' &&
    typeof s.config === 'object' &&
    Array.isArray(s.question_ids) &&
    Array.isArray(s.resultados) &&
    typeof s.status === 'string' &&
    typeof s.started_at === 'number'
  );
}

export function loadAllSimulados(): Simulado[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(isValidSimulado);
    return valid;
  } catch {
    return [];
  }
}

function persist(list: Simulado[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // QuotaExceeded ou disponibilidade — engole. Próxima escrita re-tenta.
  }
}

export function saveSimulado(sim: Simulado): void {
  const list = loadAllSimulados();
  const idx = list.findIndex((s) => s.id === sim.id);
  if (idx === -1) list.push(sim);
  else list[idx] = sim;
  persist(list);
  notify();
}

export function deleteSimulado(id: string): void {
  const list = loadAllSimulados().filter((s) => s.id !== id);
  persist(list);
  notify();
}

/**
 * Retorna o simulado em andamento mais recente (deve haver no máximo 1
 * em andamento por usuário; UI bloqueia criar outro). Null se não há.
 */
export function getSimuladoEmAndamento(userId: string): Simulado | null {
  const list = loadAllSimulados();
  const ativos = list
    .filter((s) => s.user_id === userId && s.status === 'em_andamento')
    .sort((a, b) => b.started_at - a.started_at);
  return ativos[0] ?? null;
}

export function getSimuladoById(id: string): Simulado | null {
  return loadAllSimulados().find((s) => s.id === id) ?? null;
}

/** Hook reativo: re-renderiza quando algum simulado é salvo/deletado. */
export function useSimuladosForUser(userId: string | null): Simulado[] {
  const [, setTick] = useState(0);

  useEffect(() => {
    const sync = () => setTick((t) => (t + 1) & 0xfffffff);
    listeners.add(sync);
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) sync();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  if (!userId) return [];
  return loadAllSimulados()
    .filter((s) => s.user_id === userId)
    .sort((a, b) => b.started_at - a.started_at);
}

export function clearSimuladosCache(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  notify();
}
