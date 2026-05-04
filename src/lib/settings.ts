'use client';

/**
 * Persistência de preferências do usuário em localStorage e detecção
 * de modo visitante.
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
const STORAGE_KEY_THEME = 'estudo-simples:settings:theme';
const STORAGE_KEY_DAILY_GOAL = 'estudo-simples:settings:dailyGoal';

const DAILY_GOAL_DEFAULT = 30;
const DAILY_GOAL_MIN = 1;
const DAILY_GOAL_MAX = 1000;

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
 * Tema visual: 'auto' segue OS, 'light'/'dark' força.
 *
 * Aplica via atributo data-theme em <html>. Quando 'auto', remove o
 * atributo e cai no @media (prefers-color-scheme) do CSS.
 */
export type Theme = 'auto' | 'light' | 'dark';
const VALID_THEMES: Theme[] = ['auto', 'light', 'dark'];

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'auto';
  try {
    const raw = localStorage.getItem(STORAGE_KEY_THEME);
    if (raw && (VALID_THEMES as string[]).includes(raw)) return raw as Theme;
  } catch {}
  return 'auto';
}

export function setTheme(theme: Theme): void {
  if (!(VALID_THEMES as string[]).includes(theme)) {
    throw new Error(`Theme inválido: ${theme}`);
  }
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_THEME, theme);
  } catch {}
  applyTheme(theme);
  notify();
}

/** Aplica o tema escolhido no DOM. Chamado pelo hook + ao mudar via UI. */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  if (theme === 'auto') {
    html.removeAttribute('data-theme');
  } else {
    html.setAttribute('data-theme', theme);
  }
}

export function useTheme(): Theme {
  const [theme, setT] = useState<Theme>('auto');
  useEffect(() => {
    const sync = () => {
      const t = getTheme();
      setT(t);
      applyTheme(t);
    };
    listeners.add(sync);
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_THEME) sync();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return theme;
}

/**
 * Meta diária de revisões. Mostrada no Dashboard com barra de progresso.
 * Range válido: [1, 1000]. Default 30.
 */
export function getDailyGoal(): number {
  if (typeof window === 'undefined') return DAILY_GOAL_DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DAILY_GOAL);
    if (raw) {
      const n = Number(raw);
      if (Number.isInteger(n) && n >= DAILY_GOAL_MIN && n <= DAILY_GOAL_MAX) {
        return n;
      }
    }
  } catch {
    // ignora
  }
  return DAILY_GOAL_DEFAULT;
}

export function setDailyGoal(n: number): void {
  if (!Number.isInteger(n) || n < DAILY_GOAL_MIN || n > DAILY_GOAL_MAX) {
    throw new Error(`Meta diária inválida: ${n}`);
  }
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_DAILY_GOAL, String(n));
  } catch {
    // ignora
  }
  notify();
}

export function useDailyGoal(): number {
  const [goal, setG] = useState<number>(DAILY_GOAL_DEFAULT);
  useEffect(() => {
    const sync = () => setG(getDailyGoal());
    listeners.add(sync);
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_DAILY_GOAL) sync();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return goal;
}

/**
 * Detecta se o usuário está no modo visitante (cookie es-guest=1).
 * Cookie é setado por server action enterAsGuest e lido no client.
 * SSR-safe: retorna false durante SSR (sem document); useEffect ajusta
 * no mount.
 */
export function isGuestModeClient(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((c) => c.trim().startsWith('es-guest=1'));
}

export function useIsGuest(): boolean {
  const [guest, setGuest] = useState(false);
  useEffect(() => {
    setGuest(isGuestModeClient());
  }, []);
  return guest;
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
