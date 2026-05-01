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

const VALID_ALGORITHMS: SRSAlgorithm[] = ['sm2', 'fsrs'];

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
 * Hook reativo. Re-renderiza quando setAlgorithm é chamado em qualquer
 * parte do app.
 */
export function useAlgorithm(): SRSAlgorithm {
  const [algo, setAlgo] = useState<SRSAlgorithm>(() => getAlgorithm());

  useEffect(() => {
    const sync = () => setAlgo(getAlgorithm());
    listeners.add(sync);
    // Sync no mount (SSR pode ter retornado 'sm2' default; client lê localStorage real)
    sync();
    // Reage também a mudanças em outras tabs do mesmo browser
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
