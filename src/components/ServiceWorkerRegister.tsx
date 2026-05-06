'use client';

import { useEffect, useState } from 'react';
import { toast } from './Toast';

/**
 * Registra /sw.js no boot do app. Só em produção — em dev o Next
 * substitui assets em hot reload, e o SW velho serve versões obsoletas
 * confundindo tudo.
 *
 * Atualização: ao detectar nova versão (SW waiting), mostra toast
 * "Nova versão disponível" com botão pra recarregar. User decide
 * quando — interromper sessão de estudo no meio é ruim.
 */
export function ServiceWorkerRegister() {
  const [waitingSW, setWaitingSW] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });
        const flagWaiting = (sw: ServiceWorker | null) => {
          if (!sw) return;
          setWaitingSW(sw);
        };
        if (reg.waiting) flagWaiting(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && reg.waiting) {
              flagWaiting(reg.waiting);
            }
          });
        });
      } catch {
        // SW indisponível ou bloqueado — segue sem
      }
    };
    void register();
  }, []);

  useEffect(() => {
    if (!waitingSW) return;
    toast(
      'Nova versão disponível. Recarregue pra atualizar.',
      'success',
      30_000
    );
    const reloadOnControllerChange = () => {
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      reloadOnControllerChange,
      { once: true }
    );
    // Botão de "Recarregar agora" via tecla Ctrl+R do user funcionará
    // pq após mensagem o SW vai assumir controle. Pra automação,
    // poderíamos mostrar botão no toast — mas isso requer expansão
    // do Toast pra aceitar action. Suficiente: user clica Ctrl+R / F5.
    return () => {
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        reloadOnControllerChange
      );
    };
  }, [waitingSW]);

  // Pra forçar manual: window.dispatchEvent(new Event('estudo:sw-update'))
  useEffect(() => {
    if (!waitingSW) return;
    const onForce = () => {
      waitingSW.postMessage('SKIP_WAITING');
    };
    window.addEventListener('estudo:sw-update', onForce);
    return () => window.removeEventListener('estudo:sw-update', onForce);
  }, [waitingSW]);

  return null;
}
