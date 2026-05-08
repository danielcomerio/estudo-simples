/**
 * Helper pra montar URLs de sessão de estudo. Centraliza padrão
 * `/estudar?modo=X&qtd=Y&auto=1` etc.
 */

import type { StudyMode, SessionConfig } from './types';

export type SessionUrlOpts = {
  modo: StudyMode;
  qtd: number;
  auto?: boolean;
  free?: boolean;
  tempo?: number;
  daily?: string;
  base?: string; // default '/estudar'
};

export function sessionUrl(opts: SessionUrlOpts): string {
  const params = new URLSearchParams();
  params.set('modo', opts.modo);
  params.set('qtd', String(Math.max(1, Math.min(200, opts.qtd))));
  if (opts.auto !== false) params.set('auto', '1');
  if (opts.free) params.set('free', '1');
  if (opts.tempo && opts.tempo > 0) params.set('tempo', String(opts.tempo));
  if (opts.daily) params.set('daily', opts.daily);
  return `${opts.base ?? '/estudar'}?${params.toString()}`;
}

/** Atalhos pré-fabricados pros casos mais comuns. */
export const PRESET_URLS = {
  srsRapido: () => sessionUrl({ modo: 'srs', qtd: 10 }),
  srsLongo: () => sessionUrl({ modo: 'srs', qtd: 30 }),
  novas10: () => sessionUrl({ modo: 'novas', qtd: 10 }),
  inimigas10: () => sessionUrl({ modo: 'inimigas', qtd: 10 }),
  prePorva: () => sessionUrl({ modo: 'final-prova', qtd: 30 }),
  treinoRapido: () =>
    sessionUrl({ modo: 'aleatorio', qtd: 3, tempo: 30 }),
};

/** Constrói URL a partir de SessionConfig + override opcional. */
export function urlFromConfig(
  cfg: Pick<SessionConfig, 'modo' | 'qtd' | 'free' | 'tempo'>
): string {
  return sessionUrl({
    modo: cfg.modo,
    qtd: cfg.qtd,
    free: cfg.free,
    tempo: cfg.tempo,
  });
}
