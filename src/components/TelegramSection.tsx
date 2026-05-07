'use client';

import { useEffect, useState } from 'react';
import { toast } from './Toast';
import { confirmDialog } from './ConfirmDialog';

/**
 * Settings → "Telegram" — vincula conta pra receber avisos via bot.
 *
 * Fluxo:
 *  1. POST /api/telegram/bind → recebe deeplink t.me/bot?start=TOKEN
 *  2. User clica → bot recebe /start TOKEN no webhook
 *  3. Webhook confirma binding
 *  4. UI faz polling em GET /api/telegram/bind pra detectar
 */
type BindStatus =
  | { loading: true }
  | { bound: false }
  | { bound: true; display: string | null; chat_id: number; bound_at: string };

export function TelegramSection() {
  const [status, setStatus] = useState<BindStatus>({ loading: true });
  const [pendingDeeplink, setPendingDeeplink] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const reload = async () => {
    try {
      const res = await fetch('/api/telegram/bind');
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus({ bound: false });
        return;
      }
      setStatus(json as BindStatus);
    } catch {
      setStatus({ bound: false });
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  // Polling enquanto pendingDeeplink ativo
  useEffect(() => {
    if (!pendingDeeplink) return;
    const interval = setInterval(reload, 3000);
    return () => clearInterval(interval);
  }, [pendingDeeplink]);

  // Stop polling quando bound
  useEffect(() => {
    if ('bound' in status && status.bound && pendingDeeplink) {
      setPendingDeeplink(null);
      toast('Telegram vinculado com sucesso!', 'success');
    }
  }, [status, pendingDeeplink]);

  const startBinding = async () => {
    setWorking(true);
    try {
      const res = await fetch('/api/telegram/bind', { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.deeplink) {
        toast('Erro ao gerar token de vinculação.', 'error');
        return;
      }
      setPendingDeeplink(json.deeplink);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error');
    } finally {
      setWorking(false);
    }
  };

  const unbind = async () => {
    const ok = await confirmDialog({
      title: 'Desvincular Telegram?',
      message:
        'Você não receberá mais avisos no Telegram. Pode revincular depois.',
    });
    if (!ok) return;
    try {
      const res = await fetch('/api/telegram/bind', { method: 'DELETE' });
      if (!res.ok) {
        toast('Erro ao desvincular', 'error');
        return;
      }
      toast('Telegram desvinculado.', 'success');
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error');
    }
  };

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px' }}>📲 Telegram</h2>
      <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
        Receba lembretes diários de revisão SRS, avisos de streak em
        risco e resumo semanal direto no Telegram. Grátis (Telegram Bot
        API é free).
      </p>

      {'loading' in status && status.loading && (
        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Carregando…
        </p>
      )}

      {'bound' in status && status.bound && (
        <div style={{ marginTop: 14 }}>
          <p
            style={{
              margin: '0 0 10px',
              fontSize: '0.92rem',
            }}
          >
            ✅ Vinculado a <strong>{status.display ?? 'Telegram'}</strong>{' '}
            <span className="muted" style={{ fontSize: '0.78rem' }}>
              (desde{' '}
              {new Date(status.bound_at).toLocaleDateString('pt-BR')})
            </span>
          </p>
          <button
            type="button"
            onClick={unbind}
            style={{ padding: '4px 12px', fontSize: '0.85rem' }}
          >
            Desvincular
          </button>
        </div>
      )}

      {'bound' in status && !status.bound && !pendingDeeplink && (
        <button
          type="button"
          className="primary"
          onClick={startBinding}
          disabled={working}
          style={{ marginTop: 14 }}
        >
          {working ? 'Gerando…' : '🔗 Vincular Telegram'}
        </button>
      )}

      {pendingDeeplink && (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            background: 'var(--primary-soft)',
            borderRadius: 'var(--radius)',
            borderLeft: '3px solid var(--primary)',
          }}
        >
          <p style={{ margin: '0 0 10px', fontSize: '0.92rem' }}>
            👉 Clique no link abaixo pra abrir o Telegram e confirmar:
          </p>
          <a
            href={pendingDeeplink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              background: 'var(--primary)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: 'var(--radius)',
              fontWeight: 500,
              fontSize: '0.92rem',
              marginBottom: 8,
            }}
          >
            Abrir bot no Telegram
          </a>
          <p
            className="muted"
            style={{ fontSize: '0.78rem', margin: '8px 0 0' }}
          >
            Após autorizar no bot, esta página atualiza automaticamente.
            Token expira em 1 hora.
          </p>
        </div>
      )}
    </div>
  );
}
