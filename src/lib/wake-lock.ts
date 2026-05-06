/**
 * Wake Lock API wrapper. Mantém tela acesa durante sessão de estudo —
 * sem isso, mobile apaga em 30-60s e quebra o fluxo de leitura.
 *
 * Suporte: Chrome/Edge/Samsung Internet em Android (90+), Safari iOS 16.4+,
 * Firefox NÃO suporta. Em browsers sem suporte, no-op silencioso.
 *
 * Wake lock é automaticamente liberado quando:
 *  - tab perde foco (visibilitychange) — voltamos a re-adquirir on focus
 *  - chamamos release()
 *  - navegação SPA (release manual em cleanup)
 *
 * Uso típico:
 *   useEffect(() => {
 *     const lock = acquireWakeLock();
 *     return () => { lock.release(); };
 *   }, []);
 */

type WakeLockSentinelLike = {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinelLike>;
  };
};

export type WakeLockHandle = {
  release: () => void;
};

export function acquireWakeLock(): WakeLockHandle {
  let sentinel: WakeLockSentinelLike | null = null;
  let released = false;

  const onVisibility = async () => {
    if (released) return;
    if (typeof document === 'undefined') return;
    if (document.visibilityState !== 'visible') return;
    // Tab voltou a ficar visível — re-adquire (foi liberado automaticamente
    // quando saiu de foco)
    await acquire();
  };

  const acquire = async () => {
    if (released) return;
    if (typeof navigator === 'undefined') return;
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) return;
    try {
      const s = await nav.wakeLock.request('screen');
      sentinel = s;
      s.addEventListener('release', () => {
        sentinel = null;
      });
    } catch {
      // NotAllowedError: page não tem foco, ou modo bateria fraca; ignorar
      sentinel = null;
    }
  };

  // Kick off
  void acquire();

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
  }

  return {
    release: () => {
      released = true;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      if (sentinel && !sentinel.released) {
        void sentinel.release().catch(() => {});
      }
      sentinel = null;
    },
  };
}
