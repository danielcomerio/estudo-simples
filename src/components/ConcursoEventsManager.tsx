'use client';

import { useEffect, useState } from 'react';
import { toast } from './Toast';
import { confirmDialog } from './ConfirmDialog';

type EventRow = {
  id: string;
  concurso_id: string;
  type: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  notes: string | null;
  reminder_minutes_before: number | null;
  notified_at: string | null;
};

const TYPES: Array<{ value: string; label: string }> = [
  { value: 'inscricao_inicio', label: '📋 Inscrição abre' },
  { value: 'inscricao_fim', label: '⏰ Inscrição fecha' },
  { value: 'prova_objetiva', label: '📝 Prova objetiva' },
  { value: 'prova_discursiva', label: '✍️ Prova discursiva' },
  { value: 'redacao', label: '📄 Redação' },
  { value: 'taf', label: '🏃 TAF' },
  { value: 'simulado', label: '🎯 Simulado' },
  { value: 'reuniao_estudo', label: '👥 Reunião' },
  { value: 'outro', label: '📅 Outro' },
];

/**
 * Gera URL pra adicionar evento direto no Google Calendar (one-shot).
 * Formato oficial: calendar.google.com/calendar/render?action=TEMPLATE&...
 *
 * Datas em formato YYYYMMDDTHHMMSSZ (UTC).
 */
function googleCalendarUrl(ev: EventRow): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return (
      d.getUTCFullYear().toString() +
      String(d.getUTCMonth() + 1).padStart(2, '0') +
      String(d.getUTCDate()).padStart(2, '0') +
      'T' +
      String(d.getUTCHours()).padStart(2, '0') +
      String(d.getUTCMinutes()).padStart(2, '0') +
      '00Z'
    );
  };
  const start = fmt(ev.starts_at);
  const end = ev.ends_at
    ? fmt(ev.ends_at)
    : fmt(new Date(Date.parse(ev.starts_at) + 60 * 60 * 1000).toISOString());
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${start}/${end}`,
    details: ev.notes ?? 'Criado via Estudo Simples',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const REMINDER_OPTIONS: Array<{ value: number | null; label: string }> = [
  { value: null, label: 'Sem lembrete' },
  { value: 60, label: '1 hora antes' },
  { value: 1440, label: '1 dia antes' },
  { value: 2880, label: '2 dias antes' },
  { value: 10080, label: '1 semana antes' },
  { value: 43200, label: '30 dias antes' },
];

export function ConcursoEventsManager({ concursoId }: { concursoId: string }) {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [adding, setAdding] = useState(false);

  async function reload() {
    const r = await fetch(
      `/api/concurso-events?concurso_id=${encodeURIComponent(concursoId)}`
    );
    if (r.ok) {
      const j = await r.json();
      setEvents(j.items ?? []);
    } else {
      setEvents([]);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concursoId]);

  async function remove(id: string) {
    const ok = await confirmDialog({
      title: 'Remover evento?',
      message: 'O evento será apagado permanentemente.',
      danger: true,
    });
    if (!ok) return;
    const r = await fetch(`/api/concurso-events/${id}`, { method: 'DELETE' });
    if (r.ok) {
      toast('Evento removido', 'success');
      void reload();
    } else {
      toast('Falha ao remover', 'error');
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <strong style={{ fontSize: '0.92rem' }}>📅 Eventos</strong>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{ padding: '2px 10px', fontSize: '0.78rem' }}
          >
            + Novo
          </button>
        )}
      </div>

      {adding && (
        <EventForm
          concursoId={concursoId}
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            void reload();
          }}
        />
      )}

      {events === null ? (
        <p className="muted" style={{ fontSize: '0.82rem' }}>
          Carregando…
        </p>
      ) : events.length === 0 && !adding ? (
        <p className="muted" style={{ fontSize: '0.82rem' }}>
          Nenhum evento. Adicione provas, simulados, prazos de inscrição.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {events.map((e) => (
            <li
              key={e.id}
              style={{
                padding: '6px 8px',
                marginBottom: 4,
                background: 'var(--bg-elev-2)',
                borderRadius: 6,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.85rem',
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                {TYPES.find((t) => t.value === e.type)?.label.split(' ')[0] ??
                  '📅'}{' '}
                <strong>{e.title}</strong>
                <span
                  className="muted"
                  style={{ marginLeft: 8, fontSize: '0.78rem' }}
                >
                  {new Date(e.starts_at).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {e.reminder_minutes_before !== null && ' · 🔔'}
                  {e.notified_at && ' ✓'}
                </span>
              </span>
              <a
                href={googleCalendarUrl(e)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: '0 6px', fontSize: '0.85rem', color: 'var(--muted)', textDecoration: 'none' }}
                title="Adicionar ao Google Calendar"
                aria-label="Adicionar ao Google Calendar"
              >
                📅
              </a>
              <button
                type="button"
                onClick={() => remove(e.id)}
                className="ghost"
                style={{ padding: '0 6px', fontSize: '0.78rem' }}
                aria-label="Remover"
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EventForm({
  concursoId,
  onCancel,
  onSaved,
}: {
  concursoId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState('prova_objetiva');
  const [title, setTitle] = useState('');
  // Default: amanhã 9h BRT (12h UTC)
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrow.setUTCHours(12, 0, 0, 0);
  const [datetime, setDatetime] = useState(
    tomorrow.toISOString().slice(0, 16)
  );
  const [reminder, setReminder] = useState<number | null>(1440);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) {
      toast('Título obrigatório', 'error');
      return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/concurso-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concurso_id: concursoId,
          type,
          title: title.trim(),
          starts_at: new Date(datetime).toISOString(),
          reminder_minutes_before: reminder,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      toast('Evento criado', 'success');
      onSaved();
    } catch (e) {
      toast(`Falha: ${(e as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        padding: 10,
        background: 'var(--bg-elev-2)',
        borderRadius: 8,
        marginBottom: 10,
        display: 'grid',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{ flex: '0 0 180px' }}
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 200))}
          placeholder="Título (ex: 1ª fase, Brasília)"
          style={{ flex: 1, minWidth: 150 }}
        />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          style={{ flex: '1 1 200px' }}
        />
        <select
          value={reminder ?? ''}
          onChange={(e) =>
            setReminder(e.target.value === '' ? null : Number(e.target.value))
          }
          style={{ flex: '1 1 160px' }}
        >
          {REMINDER_OPTIONS.map((r) => (
            <option key={String(r.value)} value={r.value ?? ''}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="row gap">
        <button
          type="button"
          className="primary"
          onClick={save}
          disabled={saving || !title.trim()}
          style={{ padding: '4px 10px', fontSize: '0.85rem' }}
        >
          {saving ? 'Salvando…' : 'Criar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ padding: '4px 10px', fontSize: '0.85rem' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
