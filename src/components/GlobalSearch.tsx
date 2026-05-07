'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, selectActiveQuestions } from '@/lib/store';
import { renderRichText } from '@/lib/utils';

/**
 * Busca global pela tecla Ctrl+Shift+F (Cmd+Shift+F em Mac). Mostra
 * dialog com input e top 20 resultados (objetiva/discursiva/cloze/
 * flashcard). Click navega pra /banco?search=termo (filtrado).
 *
 * Atalho mudou de Ctrl+F → Ctrl+Shift+F (2026-05): user reportou que
 * sequestrar o Ctrl+F nativo era inesperado/confuso. Convenção
 * IDE-like pra "search in all files" mantém a feature poderosa
 * (busca em TODAS as questões, não só visíveis) sem conflitar com
 * o find-in-page do browser.
 */
export function GlobalSearch() {
  const router = useRouter();
  const questions = useStore(selectActiveQuestions);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl+Shift+F (Cmd+Shift+F em mac) abre/fecha. Antes era Ctrl+F
      // mas conflitava com find-in-page nativo do browser e confundia.
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key === 'F' || e.key === 'f')
      ) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (open && e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      // Foca após mount do dialog
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQ('');
    }
  }, [open]);

  const results = useMemo(() => {
    const txt = q.trim().toLowerCase();
    if (txt.length < 2) return [];
    const out: { id: string; preview: string; tema: string; disc: string; type: string }[] = [];
    for (const item of questions) {
      const p = item.payload as Record<string, unknown>;
      const enun =
        (p.enunciado as string) ??
        (p.enunciado_completo as string) ??
        (p.texto as string) ??
        (p.frente as string) ??
        '';
      const hay = [enun, item.tema, item.disciplina_id, item.banca_estilo]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(txt)) continue;
      out.push({
        id: item.id,
        preview: enun.slice(0, 200),
        tema: item.tema ?? '',
        disc: item.disciplina_id ?? '',
        type: item.type,
      });
      if (out.length >= 20) break;
    }
    return out;
  }, [q, questions]);

  if (!open) return null;

  const goto = (id: string) => {
    setOpen(false);
    router.push(`/banco?search=${encodeURIComponent('id:' + id)}`);
  };

  const gotoSearch = () => {
    setOpen(false);
    router.push(`/banco?search=${encodeURIComponent(q)}`);
  };

  return (
    <div
      role="dialog"
      aria-modal
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 16,
        paddingTop: '10vh',
      }}
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: 640,
          maxHeight: '70vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busca global em todas as questões (Ctrl+Shift+F)…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && q.trim()) {
                if (results.length === 1) {
                  goto(results[0].id);
                } else {
                  gotoSearch();
                }
              }
            }}
            style={{ width: '100%', fontSize: '0.95rem' }}
          />
          <div
            className="muted"
            style={{ marginTop: 6, fontSize: '0.78rem' }}
          >
            {q.trim().length < 2
              ? 'Mínimo 2 caracteres'
              : `${results.length}${results.length === 20 ? '+' : ''} resultado(s) · Enter abre /banco com filtro · Esc fecha`}
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="ghost"
              onClick={() => goto(r.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
                borderRadius: 0,
                background: 'transparent',
              }}
            >
              <div className="muted" style={{ fontSize: '0.75rem', marginBottom: 2 }}>
                {r.type} · {r.disc || '(sem disciplina)'}
                {r.tema && ` · ${r.tema}`}
              </div>
              <div
                style={{
                  fontSize: '0.88rem',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
                dangerouslySetInnerHTML={{ __html: renderRichText(r.preview) }}
              />
            </button>
          ))}
          {q.trim().length >= 2 && results.length === 0 && (
            <div
              className="muted"
              style={{ padding: 14, fontSize: '0.85rem', textAlign: 'center' }}
            >
              Nenhuma questão encontrada com "{q}".
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
