'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { addQuestionsBulk, useStore } from '@/lib/store';
import { newSRS, newStats } from '@/lib/srs';
import { scheduleSync } from '@/lib/sync';
import { toast } from './Toast';
import type { SharedQuestion } from '@/lib/sharing';
import type { Question } from '@/lib/types';

type Preview = {
  owner_display: string;
  question_count: number;
  filtro: Record<string, unknown>;
  created_at: string;
  expires_at: string;
  snapshot: SharedQuestion[];
};

/**
 * Tela do receptor: GET /api/share/[token] → preview → botão importar
 * → cria cópias locais (origem='compartilhada', fonte.shared_from).
 *
 * Não exige login pra VER preview (o token é o gate). Mas exige login
 * pra IMPORTAR (precisa user_id pra anexar as questões).
 */
export function ImportSharedDeck({ token }: { token: string }) {
  const userId = useStore((s) => s.userId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/share/${token}`);
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !json) {
          setError(
            (json as { message?: string } | null)?.message ??
              `Erro ${res.status}: link indisponível.`
          );
          return;
        }
        setPreview(json as Preview);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Erro de rede');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const doImport = () => {
    if (!preview || !userId || userId === 'guest') return;
    setImporting(true);
    try {
      // Converte SharedQuestion → partial pra addQuestionsBulk.
      // SRS/stats zerados (receptor começa do zero).
      // Marca origem com fonte.shared_from pra rastreabilidade.
      const items: Array<
        Omit<Question, 'id' | 'user_id' | 'created_at' | 'updated_at'>
      > = preview.snapshot.map((sq) => ({
        type: sq.type,
        disciplina_id: sq.disciplina_id,
        tema: sq.tema,
        banca_estilo: sq.banca_estilo,
        dificuldade: sq.dificuldade,
        payload: sq.payload,
        srs: newSRS(),
        stats: newStats(),
        deleted_at: null,
        ...(sq.tags ? { tags: sq.tags } : {}),
        origem: sq.origem ?? 'autoral',
        fonte: {
          ...(sq.fonte ?? {}),
          shared_from: preview.owner_display,
          shared_at: new Date().toISOString(),
        },
        verificacao: sq.verificacao ?? 'pendente',
      }));
      addQuestionsBulk(items, userId);
      scheduleSync(800);
      toast(`${items.length} questão(ões) importada(s) pra sua conta.`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro na importação', 'error');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <main className="page" style={{ maxWidth: 720 }}>
        <p className="muted">Carregando link compartilhado…</p>
      </main>
    );
  }
  if (error || !preview) {
    return (
      <main className="page" style={{ maxWidth: 720 }}>
        <h1>Link indisponível</h1>
        <p className="muted">{error ?? 'Erro desconhecido.'}</p>
        <p style={{ marginTop: 18 }}>
          <Link href="/" style={{ color: 'var(--primary)' }}>
            ← Voltar pro app
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="page" style={{ maxWidth: 720 }}>
      <h1>📥 Banco compartilhado</h1>
      <div className="card" style={{ marginTop: 14 }}>
        <p style={{ margin: '0 0 8px' }}>
          <strong>{preview.owner_display}</strong> compartilhou{' '}
          <strong>{preview.question_count}</strong>{' '}
          {preview.question_count === 1 ? 'questão' : 'questões'} com você.
        </p>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Compartilhado em{' '}
          {new Date(preview.created_at).toLocaleDateString('pt-BR')} · expira em{' '}
          {new Date(preview.expires_at).toLocaleDateString('pt-BR')}.
        </p>

        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 500 }}>
            Ver preview das primeiras 10 questões
          </summary>
          <ul
            style={{
              marginTop: 10,
              padding: 0,
              listStyle: 'none',
              fontSize: '0.85rem',
              maxHeight: 280,
              overflow: 'auto',
            }}
          >
            {preview.snapshot.slice(0, 10).map((q, i) => (
              <li
                key={i}
                style={{
                  padding: '6px 0',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                }}
              >
                <strong>{q.disciplina_id ?? '(sem disciplina)'}</strong>
                {q.tema && <> · {q.tema}</>}
                <br />
                <span className="muted">
                  {extractEnunciadoPreview(q.payload).slice(0, 140)}…
                </span>
              </li>
            ))}
          </ul>
        </details>
      </div>

      {!userId || userId === 'guest' ? (
        <div className="card" style={{ marginTop: 14 }}>
          <p style={{ margin: '0 0 10px' }}>
            Você precisa estar logado pra importar essas questões.
          </p>
          <Link href={`/login?next=/import/${token}`}>
            <button type="button" className="primary">
              Entrar pra importar
            </button>
          </Link>
          <Link
            href={`/signup?next=/import/${token}`}
            style={{ marginLeft: 10 }}
          >
            <button type="button">Criar conta grátis</button>
          </Link>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 14 }}>
          <p style={{ margin: '0 0 10px', fontSize: '0.9rem' }}>
            As questões serão copiadas pra sua conta. Você fica dono pleno
            das cópias — pode editar, deletar, estudar normalmente. Sem
            sincronização contínua com a base original.
          </p>
          <button
            type="button"
            className="primary"
            onClick={doImport}
            disabled={importing}
            style={{ padding: '10px 20px' }}
          >
            {importing ? 'Importando…' : `Importar ${preview.question_count} questões`}
          </button>
        </div>
      )}
    </main>
  );
}

function extractEnunciadoPreview(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const p = payload as Record<string, unknown>;
  if (typeof p.enunciado === 'string') return p.enunciado;
  if (typeof p.texto === 'string') return p.texto;
  if (typeof p.frente === 'string') return p.frente;
  if (typeof p.enunciado_completo === 'string') return p.enunciado_completo;
  return '';
}
