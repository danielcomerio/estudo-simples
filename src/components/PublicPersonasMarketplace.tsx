'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from './Toast';

type PublicPersona = {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  system_prompt: string;
  use_count: number;
  created_at: string;
};

export function PublicPersonasMarketplace() {
  const [personas, setPersonas] = useState<PublicPersona[] | null>(null);
  const [q, setQ] = useState('');
  const [importing, setImporting] = useState<string | null>(null);

  async function reload(search: string) {
    setPersonas(null);
    const url = search
      ? `/api/personas-publicas?q=${encodeURIComponent(search)}`
      : '/api/personas-publicas';
    const r = await fetch(url);
    if (r.ok) {
      const j = await r.json();
      setPersonas(j.items ?? []);
    } else {
      setPersonas([]);
    }
  }

  useEffect(() => {
    void reload('');
  }, []);

  async function importPersona(id: string) {
    setImporting(id);
    try {
      const r = await fetch('/api/personas-publicas/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: id }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      toast(
        'Persona importada pra sua conta. Edite em /configuracoes.',
        'success'
      );
    } catch (e) {
      toast(`Falha: ${(e as Error).message}`, 'error');
    } finally {
      setImporting(null);
    }
  }

  return (
    <main className="page" style={{ maxWidth: 900 }}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ margin: '0 0 4px' }}>🎭 Personas públicas</h1>
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          Personas IA compartilhadas pela comunidade. Importe pra sua conta
          e use no AI Coach.
        </p>
      </header>

      <div className="row gap" style={{ marginBottom: 14 }}>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void reload(q);
          }}
          placeholder="Buscar por nome ou descrição…"
          style={{ flex: 1 }}
        />
        <button type="button" onClick={() => void reload(q)}>
          Buscar
        </button>
      </div>

      {personas === null && (
        <p className="muted" style={{ textAlign: 'center', marginTop: 20 }}>
          Carregando…
        </p>
      )}

      {personas && personas.length === 0 && (
        <div
          className="card"
          style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}
        >
          {q
            ? `Nenhuma persona encontrada pra "${q}".`
            : 'Nenhuma persona pública ainda. Marque uma sua como pública em /configuracoes pra ser a primeira!'}
        </div>
      )}

      {personas && personas.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {personas.map((p) => (
            <li key={p.id} className="card" style={{ marginBottom: 10 }}>
              <div className="row between" style={{ gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <strong style={{ fontSize: '1rem' }}>
                    {p.emoji} {p.name}
                  </strong>
                  {p.description && (
                    <p
                      className="muted"
                      style={{
                        fontSize: '0.85rem',
                        margin: '4px 0',
                      }}
                    >
                      {p.description}
                    </p>
                  )}
                  <details style={{ marginTop: 6, fontSize: '0.78rem' }}>
                    <summary
                      style={{ cursor: 'pointer', color: 'var(--muted)' }}
                    >
                      Ver system prompt
                    </summary>
                    <pre
                      style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontSize: '0.78rem',
                        background: 'var(--bg-elev-2)',
                        padding: 8,
                        borderRadius: 4,
                        marginTop: 6,
                      }}
                    >
                      {p.system_prompt}
                    </pre>
                  </details>
                  <div
                    className="muted"
                    style={{ fontSize: '0.74rem', marginTop: 6 }}
                  >
                    👥 {p.use_count} importações
                  </div>
                </div>
                <button
                  type="button"
                  className="primary"
                  onClick={() => importPersona(p.id)}
                  disabled={importing === p.id}
                >
                  {importing === p.id ? 'Importando…' : '📥 Importar'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p
        className="muted"
        style={{ marginTop: 20, fontSize: '0.85rem', textAlign: 'center' }}
      >
        <Link href="/configuracoes#personas" style={{ color: 'var(--primary)' }}>
          ← Voltar pras minhas personas
        </Link>
      </p>
    </main>
  );
}
