'use client';

import { useEffect, useState } from 'react';
import { toast } from './Toast';

/**
 * Seção em /configuracoes pra usuário ativar push notifications.
 *
 * Status detectados:
 *   - 'unsupported': browser sem Notification API ou ServiceWorker.
 *   - 'denied': user bloqueou explicitamente — não dá pra reverter via JS.
 *   - 'granted-not-registered': permissão dada mas não registramos token.
 *   - 'granted-registered': tudo ok.
 *   - 'default': nunca pediu — mostra botão "Ativar".
 *
 * Backend: POST /api/push/register com token. VAPID public key vem
 * de NEXT_PUBLIC_VAPID_PUBLIC_KEY (env). Se não setada, mostra
 * mensagem "admin precisa configurar".
 */
type Status =
  | 'loading'
  | 'unsupported'
  | 'denied'
  | 'default'
  | 'granted-not-registered'
  | 'granted-registered';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export function PushNotificationsSection() {
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);

  const detect = async () => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setStatus('unsupported');
      return;
    }
    const perm = Notification.permission;
    if (perm === 'denied') {
      setStatus('denied');
      return;
    }
    if (perm === 'default') {
      setStatus('default');
      return;
    }
    // granted: checa se tem subscription ativa
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? 'granted-registered' : 'granted-not-registered');
    } catch {
      setStatus('granted-not-registered');
    }
  };

  useEffect(() => {
    void detect();
  }, []);

  const enable = async () => {
    if (!VAPID_PUBLIC_KEY) {
      toast(
        'Chave VAPID não configurada. Admin precisa setar NEXT_PUBLIC_VAPID_PUBLIC_KEY.',
        'error',
        6000
      );
      return;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        toast('Permissão negada.', 'warn');
        await detect();
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any,
      });
      const json = sub.toJSON();
      const token = JSON.stringify(json);
      const res = await fetch('/api/push/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform: 'web' }),
      });
      if (!res.ok) {
        toast('Erro ao registrar dispositivo.', 'error');
        await detect();
        return;
      }
      toast('Notificações ativadas.', 'success');
      setStatus('granted-registered');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const token = JSON.stringify(sub.toJSON());
        await sub.unsubscribe();
        await fetch(
          '/api/push/register?token=' + encodeURIComponent(token),
          { method: 'DELETE' }
        );
      }
      toast('Notificações desativadas.', 'success');
      await detect();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px' }}>Notificações</h2>
      {status === 'loading' && (
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          Verificando suporte do navegador…
        </p>
      )}
      {status === 'unsupported' && (
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          Seu navegador não suporta notificações push. Use Chrome,
          Firefox, Edge ou Safari atualizados; ou instale o app via
          PWA pra obter as notificações via OS.
        </p>
      )}
      {status === 'denied' && (
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          Você bloqueou notificações antes. Pra reativar: clique no
          ícone de cadeado/info na barra de endereço → Permissões →
          Notificações → Permitir → recarregue a página.
        </p>
      )}
      {(status === 'default' || status === 'granted-not-registered') && (
        <>
          <p
            className="muted"
            style={{ margin: '0 0 12px', fontSize: '0.9rem' }}
          >
            Receba lembretes de questões vencendo na revisão (SRS) e
            avisos de streak em risco. Pode desativar a qualquer
            momento.
          </p>
          <button
            type="button"
            className="primary"
            onClick={enable}
            disabled={busy}
          >
            {busy ? 'Ativando…' : '🔔 Ativar notificações'}
          </button>
        </>
      )}
      {status === 'granted-registered' && (
        <>
          <p
            style={{ margin: '0 0 12px', fontSize: '0.9rem' }}
          >
            ✅ Notificações ativadas neste dispositivo.
          </p>
          <button
            type="button"
            onClick={disable}
            disabled={busy}
          >
            {busy ? 'Desativando…' : 'Desativar neste dispositivo'}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Converte VAPID public key (base64url) pra Uint8Array que
 * pushManager.subscribe espera.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    out[i] = rawData.charCodeAt(i);
  }
  return out;
}
