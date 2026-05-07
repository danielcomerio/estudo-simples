'use client';

import { useEffect, useState } from 'react';

type UsageData = {
  period_days: number;
  total_calls: number;
  cached_calls: number;
  total_chars_in: number;
  total_chars_out: number;
  estimated_cost_cents: number;
  by_provider: Array<{
    provider: string;
    calls: number;
    cost_cents: number;
    chars_in: number;
    chars_out: number;
  }>;
  by_kind: Array<{ kind: string; calls: number }>;
};

const PROVIDER_LABEL: Record<string, string> = {
  openai: 'ChatGPT',
  anthropic: 'Claude',
  gemini: 'Gemini',
};

const KIND_LABEL: Record<string, string> = {
  explain: 'Explicar questão',
  'discursiva-eval': 'Avaliar discursiva',
  generate: 'Gerar questões',
  chat: 'Chat por questão',
  rewrite: 'Reescrever',
  ocr: 'OCR de foto',
};

export function AIUsageSection() {
  const [data, setData] = useState<UsageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/ai/usage')
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setData(j);
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="card">
        <h2>📊 Uso de IA</h2>
        <p className="muted">Sem dados no momento.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card">
        <h2>📊 Uso de IA</h2>
        <p className="muted">Carregando…</p>
      </div>
    );
  }

  if (data.total_calls === 0) {
    return (
      <div className="card">
        <h2 style={{ margin: '0 0 8px' }}>📊 Uso de IA (30 dias)</h2>
        <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
          Você ainda não usou IA. Vá em /banco e clique em <strong>🤖 Gerar
          com IA</strong> ou em qualquer questão e use <strong>🤖 Explicar</strong>.
        </p>
      </div>
    );
  }

  const cacheRate =
    data.total_calls > 0
      ? Math.round((100 * data.cached_calls) / data.total_calls)
      : 0;

  // Custo: cents pequenos → mostra em USD com 4 decimais. Tradução pra BRL
  // a 5x (cotação grosseira) só pra dar referência prática.
  const costUsd = data.estimated_cost_cents / 100;
  const costBrl = costUsd * 5;

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px' }}>📊 Uso de IA (30 dias)</h2>
      <p className="muted" style={{ margin: '0 0 14px', fontSize: '0.85rem' }}>
        Estimativa baseada nos preços públicos dos providers. Como você usa
        BYO key, esse custo foi cobrado direto na sua conta do provider —
        nada passou pelo Estudo Simples.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <Stat label="Chamadas" value={data.total_calls.toLocaleString('pt-BR')} />
        <Stat
          label="Cache hits"
          value={`${cacheRate}%`}
          hint={`${data.cached_calls} de ${data.total_calls}`}
        />
        <Stat
          label="Custo estimado"
          value={`US$ ${costUsd.toFixed(4)}`}
          hint={`~R$ ${costBrl.toFixed(2)}`}
          highlight
        />
        <Stat
          label="Chars enviados"
          value={data.total_chars_in.toLocaleString('pt-BR')}
        />
      </div>

      {data.by_provider.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: '0.92rem' }}>
            Por provider
          </h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.88rem' }}>
            {data.by_provider.map((p) => (
              <li key={p.provider} style={{ marginBottom: 2 }}>
                <strong>
                  {PROVIDER_LABEL[p.provider] ?? p.provider}
                </strong>
                : {p.calls} chamada(s) · ~US$ {(p.cost_cents / 100).toFixed(4)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.by_kind.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 6px', fontSize: '0.92rem' }}>
            Por tipo de operação
          </h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.88rem' }}>
            {data.by_kind
              .sort((a, b) => b.calls - a.calls)
              .map((k) => (
                <li key={k.kind}>
                  {KIND_LABEL[k.kind] ?? k.kind}: {k.calls}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 8,
        background: highlight ? 'var(--primary-soft)' : 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="muted" style={{ fontSize: '0.75rem' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: '1.15rem',
          fontWeight: 600,
          color: highlight ? 'var(--primary)' : undefined,
        }}
      >
        {value}
      </div>
      {hint && (
        <div className="muted" style={{ fontSize: '0.72rem', marginTop: 2 }}>
          {hint}
        </div>
      )}
    </div>
  );
}
