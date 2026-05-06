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
const STORAGE_KEY_CVD = 'estudo-simples:settings:cvd';
const STORAGE_KEY_FONT = 'estudo-simples:settings:fontSize';
const STORAGE_KEY_HC = 'estudo-simples:settings:highContrast';
const STORAGE_KEY_WEEKLY_GOAL = 'estudo-simples:settings:weeklyGoal';
const STORAGE_KEY_MONTHLY_GOAL = 'estudo-simples:settings:monthlyGoal';

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
export type Theme = 'auto' | 'light' | 'dark' | 'amoled';
const VALID_THEMES: Theme[] = ['auto', 'light', 'dark', 'amoled'];

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

/**
 * Color Vision Deficiency (daltonismo). Substitui a paleta verde/vermelho
 * por azul/laranja em modos deutan/protan/tritan.
 *
 *  - 'off': paleta padrão
 *  - 'deutan': deuteranopia (mais comum, ~6% homens) — verde indistinguível
 *  - 'protan': protanopia (~1% homens) — vermelho indistinguível
 *  - 'tritan': tritanopia (raro) — azul/amarelo
 */
export type CvdMode = 'off' | 'deutan' | 'protan' | 'tritan';
const VALID_CVD: CvdMode[] = ['off', 'deutan', 'protan', 'tritan'];

export function getCvdMode(): CvdMode {
  if (typeof window === 'undefined') return 'off';
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CVD);
    if (raw && (VALID_CVD as string[]).includes(raw)) return raw as CvdMode;
  } catch {}
  return 'off';
}

export function setCvdMode(mode: CvdMode): void {
  if (!(VALID_CVD as string[]).includes(mode)) return;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_CVD, mode);
  } catch {}
  applyCvdMode(mode);
  notify();
}

export function applyCvdMode(mode: CvdMode): void {
  if (typeof document === 'undefined') return;
  const body = document.body;
  body.classList.remove('cvd-deutan', 'cvd-protan', 'cvd-tritan');
  if (mode !== 'off') {
    body.classList.add(`cvd-${mode}`);
  }
}

export function useCvdMode(): CvdMode {
  const [mode, setM] = useState<CvdMode>('off');
  useEffect(() => {
    const sync = () => {
      const m = getCvdMode();
      setM(m);
      applyCvdMode(m);
    };
    listeners.add(sync);
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_CVD) sync();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return mode;
}

/**
 * Tamanho de fonte global. 'normal' = 16px (default); 'large' = 18px;
 * 'xlarge' = 20px. Aplicado via class no body que sobrescreve font-size
 * raiz; rems escalam com isso.
 */
export type FontSize = 'normal' | 'large' | 'xlarge';
const VALID_FONT: FontSize[] = ['normal', 'large', 'xlarge'];

export function getFontSize(): FontSize {
  if (typeof window === 'undefined') return 'normal';
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FONT);
    if (raw && (VALID_FONT as string[]).includes(raw)) return raw as FontSize;
  } catch {}
  return 'normal';
}

export function setFontSize(size: FontSize): void {
  if (!(VALID_FONT as string[]).includes(size)) return;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_FONT, size);
  } catch {}
  applyFontSize(size);
  notify();
}

export function applyFontSize(size: FontSize): void {
  if (typeof document === 'undefined') return;
  const body = document.body;
  body.classList.remove('font-large', 'font-xlarge');
  if (size === 'large') body.classList.add('font-large');
  else if (size === 'xlarge') body.classList.add('font-xlarge');
}

export function useFontSize(): FontSize {
  const [size, setS] = useState<FontSize>('normal');
  useEffect(() => {
    const sync = () => {
      const s = getFontSize();
      setS(s);
      applyFontSize(s);
    };
    listeners.add(sync);
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_FONT) sync();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return size;
}

/**
 * High contrast mode (acessibilidade). Aumenta contraste de bordas,
 * texto e cores em todo o app. Útil pra users com baixa visão.
 * Aplicado via class no body que sobrescreve --border, --text, etc.
 */
export function isHighContrast(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY_HC) === '1';
  } catch {
    return false;
  }
}

export function setHighContrast(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_HC, on ? '1' : '0');
  } catch {}
  applyHighContrast(on);
  notify();
}

export function applyHighContrast(on: boolean): void {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('high-contrast', on);
}

export function useHighContrast(): boolean {
  const [on, setO] = useState(false);
  useEffect(() => {
    const sync = () => {
      const v = isHighContrast();
      setO(v);
      applyHighContrast(v);
    };
    listeners.add(sync);
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_HC) sync();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return on;
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
 * Meta semanal/mensal (revisões cumulativas). 0 = desabilitado.
 * Se positivo, Dashboard mostra progresso. Useful pra users que
 * preferem flexibilidade ("posso pegar firme uns dias e descansar
 * em outros, contanto que bata X/semana").
 */
const WEEKLY_GOAL_DEFAULT = 0;
const MONTHLY_GOAL_DEFAULT = 0;

export function getWeeklyGoal(): number {
  if (typeof window === 'undefined') return WEEKLY_GOAL_DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WEEKLY_GOAL);
    if (raw) {
      const n = Number(raw);
      if (Number.isInteger(n) && n >= 0 && n <= 10000) return n;
    }
  } catch {}
  return WEEKLY_GOAL_DEFAULT;
}

export function setWeeklyGoal(n: number): void {
  if (typeof window === 'undefined') return;
  const clamped = Math.max(0, Math.min(10000, Math.floor(n)));
  try {
    localStorage.setItem(STORAGE_KEY_WEEKLY_GOAL, String(clamped));
  } catch {}
  notify();
}

export function getMonthlyGoal(): number {
  if (typeof window === 'undefined') return MONTHLY_GOAL_DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MONTHLY_GOAL);
    if (raw) {
      const n = Number(raw);
      if (Number.isInteger(n) && n >= 0 && n <= 50000) return n;
    }
  } catch {}
  return MONTHLY_GOAL_DEFAULT;
}

export function setMonthlyGoal(n: number): void {
  if (typeof window === 'undefined') return;
  const clamped = Math.max(0, Math.min(50000, Math.floor(n)));
  try {
    localStorage.setItem(STORAGE_KEY_MONTHLY_GOAL, String(clamped));
  } catch {}
  notify();
}

export function useWeeklyGoal(): number {
  const [goal, setG] = useState<number>(WEEKLY_GOAL_DEFAULT);
  useEffect(() => {
    const sync = () => setG(getWeeklyGoal());
    listeners.add(sync);
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_WEEKLY_GOAL) sync();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return goal;
}

export function useMonthlyGoal(): number {
  const [goal, setG] = useState<number>(MONTHLY_GOAL_DEFAULT);
  useEffect(() => {
    const sync = () => setG(getMonthlyGoal());
    listeners.add(sync);
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_MONTHLY_GOAL) sync();
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
