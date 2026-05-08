'use client';

import { useEffect, useState } from 'react';

/**
 * Hook genérico pra state persistido em localStorage.
 *
 * SSR-safe: inicia com `initial`, hidrata do storage no useEffect.
 * Sync entre tabs via storage event.
 *
 * Use:
 *   const [show, setShow] = useLocalStorageState('my-flag', false);
 *   const [data, setData] = useLocalStorageState('my-data', { x: 1 });
 */
export function useLocalStorageState<T>(
  key: string,
  initial: T
): [T, (next: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(initial);

  // Hidratação no mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        setState(parsed);
      }
    } catch {
      /* ignore — initial fica */
    }
  }, [key]);

  // Sync entre tabs
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      try {
        if (e.newValue === null) setState(initial);
        else setState(JSON.parse(e.newValue));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, initial]);

  const setAndPersist = (next: T | ((prev: T) => T)) => {
    setState((cur) => {
      const value = typeof next === 'function' ? (next as (prev: T) => T)(cur) : next;
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* ignore — quota cheia ou disabled */
      }
      return value;
    });
  };

  return [state, setAndPersist];
}
