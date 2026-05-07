'use client';

import { useEffect, useState } from 'react';
import { toast } from './Toast';

type Status = {
  configured: boolean;
  enabled: boolean;
  last_used_at: string | null;
  created_at: string | null;
};

export function DiscordSection() {
  const [status, setStatus] = useState<Status | null>(null);
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  async function reload() {
    const res = await fetch('/api/discord');
    if (res.ok) setStatus(await res.json());
  }
  useEffect(() => {
    void reload();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/discord', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook_url: url }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      toast('Webhook conectado! Confira o canal.', 'success');
      setUrl('');
      void reload();
    } catch (e) {
      toast(`Falha: ${(e as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm('Remover webhook do Discord?')) return;
    const res = await fetch('/api/discord', { method: 'DELETE' });
    if (res.ok) {
      toast('Removido.', 'success');
      void reload();
    } else {
      toast('Falha ao remover.', 'error');
    }
  }

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px' }}>👾 Discord</h2>
      <p className="muted" style={{ margin: '0 0 14px', fontSize: '0.88rem' }}>
        Receba notificações no Discord via webhook. Sem bot, sem OAuth.
      </p>

      {status?.configured ? (
        <div
          style={{
            padding: 12,
            borderRadius: 'var(--radius)',
            background: 'var(--primary-soft)',
            border: '1px solid var(--primary)',
            marginBottom: 12,
          }}
        >
          <strong>✓ Webhook configurado</strong>
          <div className="muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
            {status.last_used_at
              ? `Usado por último: ${new Date(status.last_used_at).toLocaleString('pt-BR')}`
              : 'Aguardando primeira mensagem.'}
          </div>
          <button
            type="button"
            onClick={() => void remove()}
            style={{ marginTop: 10 }}
          >
            Remover
          </button>
        </div>
      ) : (
        <details>
          <summary style={{ cursor: 'pointer', marginBottom: 8 }}>
            Como criar um webhook?
          </summary>
          <ol
            style={{
              fontSize: '0.85rem',
              paddingLeft: 20,
              lineHeight: 1.7,
              margin: '8px 0',
            }}
          >
            <li>
              No seu servidor Discord, vá em{' '}
              <strong>Configurações do canal → Integrações → Webhooks</strong>.
            </li>
            <li>
              Clique <strong>Novo Webhook</strong>, dê um nome, copie a URL.
            </li>
            <li>Cole abaixo e clique conectar.</li>
          </ol>
        </details>
      )}

      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://discord.com/api/webhooks/..."
        style={{ width: '100%', marginTop: 8 }}
      />
      <button
        onClick={() => void save()}
        disabled={saving || !url}
        style={{ marginTop: 8 }}
      >
        {saving ? 'Validando…' : status?.configured ? 'Atualizar' : 'Conectar'}
      </button>
    </div>
  );
}
