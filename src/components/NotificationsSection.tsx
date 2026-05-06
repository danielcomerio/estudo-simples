'use client';

import { useEffect, useState } from 'react';
import {
  isNotificationsSupported,
  notificationsPermission,
  isNotificationsEnabled,
  enableNotifications,
  disableNotifications,
} from '@/lib/notifications';
import { toast } from './Toast';

/**
 * Toggle de notificações em /configuracoes. Pede permissão se ainda
 * não foi pedida. Mostra estado da permissão (granted/denied/default)
 * com instrução clara em caso de denied.
 */
export function NotificationsSection() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setSupported(isNotificationsSupported());
    setPermission(notificationsPermission());
    setEnabled(isNotificationsEnabled());
  }, []);

  if (supported === null) return null; // hydrating

  const onToggle = async () => {
    if (enabled) {
      disableNotifications();
      setEnabled(false);
      toast('Notificações desativadas', 'success');
      return;
    }
    const ok = await enableNotifications();
    if (ok) {
      setPermission('granted');
      setEnabled(true);
      toast('Notificações ativadas. Vamos avisar você de revisões vencidas.', 'success');
      // Notificação imediata pra confirmar que funciona
      try {
        new Notification('Estudo Simples', {
          body: '✅ Notificações funcionando! Vamos lembrar você das revisões.',
          icon: '/icon.svg',
        });
      } catch {}
    } else {
      setPermission(notificationsPermission());
      toast(
        permission === 'denied'
          ? 'Permissão negada. Habilite nas configurações do navegador.'
          : 'Não consegui ativar notificações.',
        'error'
      );
    }
  };

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px' }}>🔔 Notificações</h2>
      <p
        className="muted"
        style={{ margin: '0 0 12px', fontSize: '0.9rem', lineHeight: 1.5 }}
      >
        Avisa quando há questões vencendo (cooldown de 6h pra não
        spammar). Funciona apenas com a aba aberta — sem servidor
        externo, sem rastreamento.
      </p>

      {!supported ? (
        <p
          style={{
            margin: 0,
            padding: 10,
            background: 'var(--bg-elev-2)',
            borderRadius: 'var(--radius)',
            fontSize: '0.88rem',
          }}
        >
          ⚠️ Seu navegador não suporta notificações.
        </p>
      ) : permission === 'denied' ? (
        <div
          style={{
            padding: 12,
            background: 'var(--warn-bg, rgba(217, 119, 6, 0.08))',
            border: '1px solid var(--warn, #d97706)',
            borderRadius: 'var(--radius)',
            fontSize: '0.88rem',
            lineHeight: 1.5,
          }}
        >
          ⚠️ Permissão negada. Pra ativar, vá nas configurações do
          navegador → permissões deste site → notificações → permitir.
          Depois recarregue a página.
        </div>
      ) : (
        <div className="row gap" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={enabled ? 'ghost' : 'primary'}
            onClick={() => void onToggle()}
            style={{ padding: '8px 16px' }}
          >
            {enabled ? '🔕 Desativar' : '🔔 Ativar notificações'}
          </button>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            {enabled
              ? 'Ativadas — vai avisar de revisões vencidas'
              : permission === 'granted'
                ? 'Permissão OK, mas notificações desativadas'
                : 'Permissão ainda não pedida'}
          </span>
        </div>
      )}
    </div>
  );
}
