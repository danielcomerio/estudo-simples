'use client';

import { useEffect, useState } from 'react';
import { toast } from './Toast';

type Prefs = {
  community_enabled: boolean;
  personal_enabled: boolean;
  personal_qtd: number;
  personal_types: string[];
  personal_disciplinas: string[];
  notify_hour: number;
  notify_minute: number;
};

// Brasília é UTC-3 (sem horário de verão desde 2019).
// DB armazena UTC (notify_hour 0-23). UI mostra BRT.
function utcToBR(utc: number): number {
  return (utc - 3 + 24) % 24;
}
function brToUTC(br: number): number {
  return (br + 3) % 24;
}

const TYPES: Array<{ value: string; label: string }> = [
  { value: 'objetiva', label: 'Objetiva' },
  { value: 'discursiva', label: 'Discursiva' },
  { value: 'cloze', label: 'Cloze' },
  { value: 'flashcard', label: 'Flashcard' },
];

export function DailyPreferencesSection() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/daily/preferences')
      .then((r) => r.json())
      .then((j: { prefs: Prefs }) => setPrefs(j.prefs))
      .catch(() => toast('Falha ao carregar preferências', 'error'));
  }, []);

  function update<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: value });
  }

  async function save() {
    if (!prefs) return;
    setSaving(true);
    try {
      const res = await fetch('/api/daily/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'erro');
      }
      toast('Preferências salvas', 'success');
    } catch (e) {
      toast(`Falha: ${(e as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!prefs) {
    return (
      <div className="card">
        <h2>📅 Desafio Diário</h2>
        <p className="muted">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px' }}>📅 Desafio Diário</h2>
      <p className="muted" style={{ margin: '0 0 18px', fontSize: '0.9rem' }}>
        Configure como receber as questões do dia.
      </p>

      <div style={{ marginBottom: 18 }}>
        <label className="row" style={{ gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={prefs.community_enabled}
            onChange={(e) => update('community_enabled', e.target.checked)}
          />
          <span>
            <strong>Modo Comunidade</strong>
            <span
              className="muted"
              style={{ display: 'block', fontSize: '0.85rem' }}
            >
              Receba avisos quando o set comunitário for publicado. Mesmas
              questões pra todos, ranking competitivo.
            </span>
          </span>
        </label>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label className="row" style={{ gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={prefs.personal_enabled}
            onChange={(e) => update('personal_enabled', e.target.checked)}
          />
          <span>
            <strong>Modo Pessoal (BYO IA)</strong>
            <span
              className="muted"
              style={{ display: 'block', fontSize: '0.85rem' }}
            >
              Gere questões customizadas com sua chave de IA (configure em
              Chaves de IA acima). Sem custo pro app.
            </span>
          </span>
        </label>
      </div>

      {prefs.personal_enabled && (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 14,
            marginBottom: 18,
            background: 'var(--bg-elev-2)',
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <label
              style={{ display: 'block', marginBottom: 4, fontSize: '0.9rem' }}
            >
              Quantidade
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={prefs.personal_qtd}
              onChange={(e) =>
                update(
                  'personal_qtd',
                  Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 10))
                )
              }
              style={{ width: 80 }}
            />
            <span className="muted" style={{ marginLeft: 8, fontSize: '0.85rem' }}>
              questões/dia (1–50)
            </span>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label
              style={{ display: 'block', marginBottom: 6, fontSize: '0.9rem' }}
            >
              Tipos de questão
            </label>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {TYPES.map((t) => (
                <label
                  key={t.value}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <input
                    type="checkbox"
                    checked={prefs.personal_types.includes(t.value)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...prefs.personal_types, t.value]
                        : prefs.personal_types.filter((x) => x !== t.value);
                      update('personal_types', next);
                    }}
                  />
                  <span style={{ fontSize: '0.9rem' }}>{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label
              style={{ display: 'block', marginBottom: 4, fontSize: '0.9rem' }}
            >
              Disciplinas (vírgula-separadas)
            </label>
            <input
              type="text"
              value={prefs.personal_disciplinas.join(', ')}
              onChange={(e) =>
                update(
                  'personal_disciplinas',
                  e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              }
              placeholder="Português, Direito Constitucional"
              style={{ width: '100%' }}
            />
            <span className="muted" style={{ fontSize: '0.78rem' }}>
              Vazio = qualquer disciplina do seu banco.
            </span>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <label
          style={{ display: 'block', marginBottom: 4, fontSize: '0.9rem' }}
        >
          Hora de notificação (horário de Brasília)
        </label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="number"
            min={0}
            max={23}
            value={utcToBR(prefs.notify_hour)}
            onChange={(e) => {
              const br = Math.max(
                0,
                Math.min(23, parseInt(e.target.value, 10) || 0)
              );
              update('notify_hour', brToUTC(br));
            }}
            style={{ width: 60 }}
          />
          <span>:</span>
          <input
            type="number"
            min={0}
            max={59}
            step={5}
            value={prefs.notify_minute}
            onChange={(e) =>
              update(
                'notify_minute',
                Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0))
              )
            }
            style={{ width: 60 }}
          />
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            BRT (UTC-3)
          </span>
        </div>
      </div>

      <button onClick={save} disabled={saving}>
        {saving ? 'Salvando…' : 'Salvar preferências'}
      </button>
    </div>
  );
}
