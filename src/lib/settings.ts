'use client';

/**
 * Persistência de preferências do usuário em localStorage.
 *
 * Hoje só guarda o algoritmo SRS escolhido (SM-2 default; FSRS opt-in).
 * Pequeno e auto-contido — quando crescer pra >2 settings, refatorar
 * pra um objeto ou pra tabela `user_settings` no DB.
 *
 * NOTA DE SEGURANÇA: localStorage é per-user-per-browser; não é
 * sincronizado entre dispositivos. Aceitável pro MVP — a flag não é
 * sensível e pode ser re-setada em outro dispositivo se quiser.
 * Quando movermos pra DB, fica per-user-server-wide.
 */

import { useEffect, useState } from 'react';
import type { SRSAlgorithm } from './srs-fsrs';

const STORAGE_KEY_ALGORITHM = 'estudo-simples:settings:algorithm';
const STORAGE_KEY_ACTIVE_CONCURSO = 'estudo-simples:settings:activeConcurso';

const VALID_ALGORITHMS: SRSAlgorithm[] = ['sm2', 'fsrs'];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

/**
 * Lê algoritmo do localStorage. Default 'sm2'. Valida o valor lido —
 * se localStorage foi adulterado com string arbitrária, retorna o
 * default em vez de aceitar lixo.
 */
export function getAlgorithm(): SRSAlgorithm {
  if (typeof window === 'undefined') return 'sm2';
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ALGORITHM);
    if (raw && (VALID_ALGORITHMS as string[]).includes(raw)) {
      return raw as SRSAlgorithm;
    }
  } catch {
    // localStorage indisponível (private mode etc.) — segue com default
  }
  return 'sm2';
}

export function setAlgorithm(algorithm: SRSAlgorithm): void {
  if (!(VALID_ALGORITHMS as string[]).includes(algorithm)) {
    throw new Error(`Algoritmo inválido: ${algorithm}`);
  }
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_ALGORITHM, algorithm);
  } catch {
    // ignora — UI não-crítica falha em silencio mas re-tenta na próxima
  }
  notify();
}

/**
 * Concurso ativo: filtra /banco, /estudar e /stats pelas disciplinas
 * vinculadas ao concurso. null = sem filtro (vê tudo).
 *
 * Validado contra UUID_PATTERN — se localStorage foi adulterado pra
 * algo arbitrário, retorna null em vez de propagar lixo.
 */
export function getActiveConcursoId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_CONCURSO);
    if (raw && UUID_PATTERN.test(raw)) return raw;
  } catch {
    // localStorage indisponível
  }
  return null;
}

export function setActiveConcursoId(id: string | null): void {
  if (id !== null && !UUID_PATTERN.test(id)) {
    throw new Error(`Concurso id inválido: ${id}`);
  }
  if (typeof window === 'undefined') return;
  try {
    if (id === null) {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_CONCURSO);
    } else {
      localStorage.setItem(STORAGE_KEY_ACTIVE_CONCURSO, id);
    }
  } catch {
    // ignora — UI não-crítica falha silenciosa
  }
  notify();
}

export function useActiveConcursoId(): string | null {
  // SSR-safe: começa null. useEffect ajusta no mount.
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setId(getActiveConcursoId());
    listeners.add(sync);
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_ACTIVE_CONCURSO) sync();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return id;
}

/**
 * Hook reativo. Re-renderiza quando setAlgorithm é chamado em qualquer
 * parte do app.
 */
export function useAlgorithm(): SRSAlgorithm {
  // Init SSR-safe: sempre 'sm2' no primeiro render. useEffect ajusta pro
  // valor real do localStorage no mount. Sem isso, server renderiza 'sm2'
  // mas client renderiza valor real → React warning de hydration mismatch.
  const [algo, setAlgo] = useState<SRSAlgorithm>('sm2');

  useEffect(() => {
    const sync = () => setAlgo(getAlgorithm());
    listeners.add(sync);
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_ALGORITHM) sync();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return algo;
}
