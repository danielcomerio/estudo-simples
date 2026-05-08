'use client';

import { useState } from 'react';
import { useStore, selectActiveQuestions } from '@/lib/store';
import { getAIKey, getDefaultProvider } from '@/lib/ai-keys';
import { toast } from './Toast';
import type { Question } from '@/lib/types';

/**
 * Busca semântica via IA. User digita pergunta natural ("questões
 * sobre prescrição em direito tributário"), IA filtra do pool atual.
 *
 * Setado via callback que devolve IDs filtrados pro parent (BancoList)
 * aplicar como filtro temporário.
 *
 * Sem chave configurada: oculto.
 */
export function AISearchButton({
  onResults,
  onClear,
}: {
  /** Callback com IDs das questões relevantes. Vazio = sem resultado. */
  onResults: (ids: Set<string>, query: string) => void;
  /** Callback pra limpar filtro semântico ativo. */
  onClear: () => void;
}) {
  const provider = getDefaultProvider();
  const allQuestions = useStore(selectActiveQuestions);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeQuery, setActiveQuery] = useState<string | null>(null);

  if (!provider) return null;

  async function search() {
    if (!query.trim() || loading) return;
    setLoading(true);
    const apiKey = getAIKey(provider!);
    if (!apiKey) {
      toast('Chave não configurada', 'error');
      setLoading(false);
      return;
    }
    try {
      const pool = allQuestions.slice(0, 200).map((q: Question) => {
        const p = q.payload as Record<string, unknown>;
        const enunciado =
          (p.enunciado as string) ??
          (p.enunciado_completo as string) ??
          (p.texto as string) ??
          (p.frente as string) ??
          '';
        return {
          id: q.id,
          enunciado,
          disciplina: q.disciplina_id ?? '',
          tags: q.tags ?? [],
        };
      });

      const res = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          query: query.trim(),
          questions: pool,
          limit: 30,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message ?? `HTTP ${res.status}`);
      }
      const ids = new Set<string>(json.ids ?? []);
      if (ids.size === 0) {
        toast('Nenhuma questão relevante encontrada', 'warn');
      } else {
        toast(`✓ ${ids.size} questões relevantes`, 'success');
      }
      onResults(ids, query.trim());
      setActiveQuery(query.trim());
      setOpen(false);
    } catch (e) {
      toast(`Falha: ${(e as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setActiveQuery(null);
    setQuery('');
    onClear();
  }

  return (
    <>
      {!activeQuery ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          title="Busca semântica via IA — entende sinônimos, conceitos relacionados"
          style={{
            background: 'var(--bg-elev-2)',
            border: '1px solid var(--primary)',
            color: 'var(--primary)',
            fontWeight: 500,
            padding: '6px 12px',
            fontSize: '0.85rem',
          }}
        >
          🤖 Busca IA
        </button>
      ) : (
        <button
          type="button"
          onClick={clear}
          title={`Filtrando por "${activeQuery}". Click pra limpar.`}
          style={{
            background: 'var(--primary)',
            color: '#fff',
            border: '1px solid var(--primary)',
            fontWeight: 500,
            padding: '6px 12px',
            fontSize: '0.85rem',
          }}
        >
          🤖 IA: "{activeQuery.slice(0, 25)}{activeQuery.length > 25 ? '…' : ''}" ✕
        </button>
      )}

      {open && (
        <div
          style={{
            position: 'absolute',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 12,
            marginTop: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            zIndex: 50,
            width: 320,
          }}
        >
          <div style={{ fontSize: '0.85rem', marginBottom: 6 }}>
            <strong>Busca semântica</strong>
            <div className="muted" style={{ fontSize: '0.78rem' }}>
              Pergunte em linguagem natural — IA entende contexto.
            </div>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, 500))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void search();
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="ex: questões sobre prescrição tributária"
            autoFocus
            style={{ width: '100%', marginBottom: 8, fontSize: '0.85rem' }}
          />
          <div className="row gap">
            <button
              type="button"
              className="primary"
              onClick={search}
              disabled={!query.trim() || loading}
              style={{ padding: '4px 12px', fontSize: '0.85rem' }}
            >
              {loading ? 'Buscando…' : 'Buscar'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ padding: '4px 12px', fontSize: '0.85rem' }}
            >
              Cancelar
            </button>
          </div>
          <div className="muted" style={{ fontSize: '0.72rem', marginTop: 6 }}>
            Pool: até 200 questões mais recentes
          </div>
        </div>
      )}
    </>
  );
}
