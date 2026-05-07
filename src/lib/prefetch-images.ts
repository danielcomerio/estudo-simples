'use client';

/**
 * Prefetcher de imagens — adiciona `<link rel="preload" as="image">`
 * pras próximas N questões da queue, pra render instantâneo no advance.
 *
 * Sem isso, browser começa o fetch só quando renderiza o <img>, gerando
 * delay visível em conexões lentas. Com prefetch, o browser pode usar
 * idle time da questão atual.
 *
 * Idempotente: skipa se já tem link com mesmo href.
 */

import type { Question } from './types';

const MAX_PREFETCH = 3;
const TAG_ATTR = 'data-prefetch-questions';

export function prefetchUpcoming(queue: readonly Question[], currentIdx: number): void {
  if (typeof document === 'undefined') return;

  // Limpa anteriores
  document
    .querySelectorAll(`link[${TAG_ATTR}="1"]`)
    .forEach((el) => el.remove());

  const upcoming = queue.slice(currentIdx + 1, currentIdx + 1 + MAX_PREFETCH);
  const urls = new Set<string>();
  for (const q of upcoming) {
    const imgs = (q.payload as Record<string, unknown>).imagens;
    if (Array.isArray(imgs)) {
      for (const u of imgs) {
        if (typeof u === 'string') urls.add(u);
      }
    }
  }

  for (const url of urls) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    link.setAttribute(TAG_ATTR, '1');
    // Cross-origin: assume Supabase Storage permite (bucket público).
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }
}
