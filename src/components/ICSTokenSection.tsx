'use client';

import { useEffect, useState } from 'react';
import { toast } from './Toast';
import { confirmDialog } from './ConfirmDialog';

type TokenInfo = {
  token: string;
  enabled: boolean;
  fetch_count: number;
  last_fetched_at: string | null;
};

export function ICSTokenSection() {
  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(false);

  async function reload() {
    const r = await fetch('/api/ics-token');
    if (r.ok) {
      const j = await r.json();
      setInfo(j.token);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function regenerate() {
    const ok = await confirmDialog({
      title: 'Regenerar token?',
      message:
        'O link atual deixa de funcionar. Você precisará re-assinar o calendário em todos os apps que usam.',
      danger: true,
    });
    if (!ok) return;
    setLoading(true);
    try {
      const r = await fetch('/api/ics-token', { method: 'POST' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast('Token novo gerado.', 'success');
      await reload();
    } catch (e) {
      toast(`Falha: ${(e as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function disable() {
    const ok = await confirmDialog({
      title: 'Desativar feed?',
      message: 'Apps de calendário não vão mais conseguir acessar.',
      danger: true,
    });
    if (!ok) return;
    setLoading(true);
    try {
      const r = await fetch('/api/ics-token', { method: 'DELETE' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast('Feed desativado.', 'success');
      await reload();
    } catch (e) {
      toast(`Falha: ${(e as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast('URL copiada', 'success');
    } catch {
      toast('Falha ao copiar', 'error');
    }
  }

  if (!info) {
    return (
      <div className="card">
        <h2>📅 Calendário (ICS)</h2>
        <p className="muted">Carregando…</p>
      </div>
    );
  }

  const fullUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/ics/${info.token}`
      : `/api/ics/${info.token}`;

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px' }}>📅 Calendário (ICS)</h2>
      <p className="muted" style={{ margin: '0 0 14px', fontSize: '0.85rem' }}>
        Assine o feed pra ver eventos de concurso (provas, simulados,
        prazos) no Google Calendar, Outlook ou Apple Calendar. Atualiza
        automaticamente.
      </p>

      {info.enabled ? (
        <>
          <div
            style={{
              padding: 10,
              background: 'var(--bg-elev-2)',
              borderRadius: 6,
              marginBottom: 10,
              fontFamily: 'monospace',
              fontSize: '0.78rem',
              wordBreak: 'break-all',
              border: '1px solid var(--border)',
            }}
          >
            {fullUrl}
          </div>

          <div className="row gap" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="primary"
              onClick={() => copy(fullUrl)}
            >
              📋 Copiar URL
            </button>
            <a
              href={fullUrl}
              download="estudo-simples.ics"
              className="ghost"
              style={{
                padding: '6px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                textDecoration: 'none',
                fontSize: '0.88rem',
              }}
            >
              ⬇ Baixar .ics
            </a>
            <button type="button" onClick={regenerate} disabled={loading}>
              🔄 Regenerar
            </button>
            <button type="button" onClick={disable} disabled={loading}>
              🚫 Desativar
            </button>
          </div>

          <details style={{ fontSize: '0.85rem' }}>
            <summary style={{ cursor: 'pointer' }}>
              Como assinar no Google Calendar?
            </summary>
            <ol style={{ paddingLeft: 18, lineHeight: 1.7 }}>
              <li>Abra calendar.google.com.</li>
              <li>
                Lateral esquerda → <strong>Outros calendários</strong> → +.
              </li>
              <li>Selecione "Por URL" e cole o link acima.</li>
              <li>Adicionar calendário. Atualiza a cada ~12h.</li>
            </ol>
          </details>

          <p className="muted" style={{ fontSize: '0.74rem', marginTop: 10 }}>
            {info.fetch_count} acessos ·{' '}
            {info.last_fetched_at
              ? `último: ${new Date(info.last_fetched_at).toLocaleString('pt-BR')}`
              : 'nunca acessado'}
          </p>
        </>
      ) : (
        <button onClick={regenerate} disabled={loading}>
          🔄 Reativar feed
        </button>
      )}
    </div>
  );
}
