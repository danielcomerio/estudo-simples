'use client';

import { useEffect } from 'react';
import { useStore, selectActiveQuestions } from '@/lib/store';

/**
 * PWA Badging API — mostra contagem de revisões pendentes no ícone do
 * app instalado (taskbar/dock no Windows, badge no app drawer Android).
 *
 * Suporte:
 *  - Chrome/Edge desktop ✓
 *  - Edge Android ✓
 *  - Chrome Android (Lollipop+) ✓ via TWA
 *  - Safari/iOS ✗ (silently no-op)
 *
 * Fonte: navigator.setAppBadge(count) / clearAppBadge().
 *
 * Atualiza quando questions mudam — debounce 500ms pra evitar
 * thrashing durante import em massa.
 */

const DAY_MS = 86_400_000;

type NavWithBadging = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function BadgingHost() {
  const questions = useStore(selectActiveQuestions);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const nav = navigator as NavWithBadging;
    if (typeof nav.setAppBadge !== 'function') return;

    const t = setTimeout(() => {
      const now = Date.now();
      const cutoff = now + DAY_MS; // hoje + vencidas
      const due = questions.filter(
        (q) =>
          q.srs?.dueDate !== undefined &&
          q.srs.dueDate > 0 &&
          q.srs.dueDate <= cutoff
      ).length;

      if (due > 0) {
        nav.setAppBadge?.(due).catch(() => {
          // Browser pode rejeitar se app não foi instalado como PWA — ok.
        });
      } else {
        nav.clearAppBadge?.().catch(() => {
          /* idem */
        });
      }
    }, 500);

    return () => clearTimeout(t);
  }, [questions]);

  return null;
}
