'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { syncNow } from '@/lib/sync';
import { setActiveConcursoId, setTheme } from '@/lib/settings';
import { useConcursos } from '@/lib/hierarchy';

/**
 * Command palette global. Abre com Ctrl+K (Cmd+K em Mac), Ctrl+P (alt
 * comum em VSCode-likes), ou Ctrl+I (atalho de import).
 *
 * Lista comandos: navegação (rotas), ações (sincronizar agora, trocar
 * tema), e quando há concursos cadastrados, atalho pra trocar concurso
 * ativo.
 *
 * Filtragem por substring case-insensitive. Enter executa o primeiro
 * resultado; setas navegam.
 */

type Command = {
  label: string;
  hint?: string;
  action: () => void;
  keywords?: string;
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: concursos } = useConcursos();

  const commands: Command[] = useMemo(() => {
    const cmds: Command[] = [
      { label: 'Painel', action: () => router.push('/'), hint: 'Início' },
      { label: 'Banco de questões', action: () => router.push('/banco'), keywords: 'questoes lista' },
      { label: 'Estudar (objetivas)', action: () => router.push('/estudar') },
      { label: 'Discursivas', action: () => router.push('/discursivas') },
      { label: 'Cards (Cloze + Flashcard)', action: () => router.push('/cards'), keywords: 'cloze flashcard' },
      { label: 'Simulado', action: () => router.push('/simulado') },
      { label: 'Estatísticas', action: () => router.push('/stats'), keywords: 'stats grafico' },
      { label: 'Concursos', action: () => router.push('/concursos') },
      { label: 'Disciplinas', action: () => router.push('/disciplinas') },
      { label: 'Preencher gabaritos faltantes', action: () => router.push('/revisar'), keywords: 'revisar gabarito ia bulk pendentes' },
      { label: 'Configurações', action: () => router.push('/configuracoes') },
      // Ações
      {
        label: '→ Sincronizar agora',
        action: () => void syncNow(),
        keywords: 'sync push pull',
      },
      {
        label: '→ Estudar 10 vencendo (auto)',
        action: () => router.push('/estudar?modo=srs&qtd=10&auto=1'),
        keywords: 'rapido sessao',
      },
      {
        label: '→ Trocar tema: claro',
        action: () => setTheme('light'),
      },
      {
        label: '→ Trocar tema: escuro',
        action: () => setTheme('dark'),
      },
      {
        label: '→ Trocar tema: automático',
        action: () => setTheme('auto'),
      },
      {
        label: '→ Concurso ativo: nenhum (ver tudo)',
        action: () => setActiveConcursoId(null),
        keywords: 'limpar filtro',
      },
    ];
    // Concursos como atalhos pra setActiveConcursoId
    for (const c of concursos ?? []) {
      cmds.push({
        label: `→ Ativar concurso: ${c.nome}`,
        action: () => setActiveConcursoId(c.id),
        hint: c.banca ?? undefined,
      });
    }
    return cmds;
  }, [router, concursos]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      (c.label + ' ' + (c.keywords ?? '') + ' ' + (c.hint ?? ''))
        .toLowerCase()
        .includes(q)
    );
  }, [commands, query]);

  // Atalhos globais pra abrir/fechar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && (e.key === 'k' || e.key === 'K' || e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      // Ctrl+I dedicado pra import
      if (isMod && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        router.push('/banco');
        return;
      }
      // Ctrl+B → /banco; Ctrl+E → /estudar
      if (isMod && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        router.push('/banco');
        return;
      }
      if (isMod && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        router.push('/estudar');
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  // Reset ao abrir + foco
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset índice quando query muda
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // Esc/clique-fora fecha; setas navegam; Enter executa
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[activeIdx];
        if (cmd) {
          cmd.action();
          setOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, activeIdx]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          width: '90vw',
          maxWidth: 540,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar comandos…  (esc fecha)"
          style={{
            width: '100%',
            padding: '14px 18px',
            fontSize: '1rem',
            background: 'transparent',
            border: 0,
            borderBottom: '1px solid var(--border)',
            color: 'var(--text)',
            outline: 'none',
          }}
        />
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 4,
            maxHeight: '50vh',
            overflowY: 'auto',
          }}
        >
          {filtered.length === 0 && (
            <li style={{ padding: 14, color: 'var(--muted)' }}>
              Nenhum comando.
            </li>
          )}
          {filtered.map((cmd, i) => {
            const active = i === activeIdx;
            return (
              <li key={i}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => {
                    cmd.action();
                    setOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    width: '100%',
                    padding: '10px 14px',
                    background: active ? 'var(--primary-soft)' : 'transparent',
                    border: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'var(--text)',
                    borderRadius: 'var(--radius)',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span>{cmd.label}</span>
                  {cmd.hint && (
                    <span
                      className="muted"
                      style={{ fontSize: '0.82rem', flexShrink: 0 }}
                    >
                      {cmd.hint}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <div
          style={{
            padding: '6px 14px',
            fontSize: '0.78rem',
            color: 'var(--muted)',
            borderTop: '1px solid var(--border)',
          }}
        >
          ↑↓ navega · Enter executa · Esc fecha · Ctrl+K abre
        </div>
      </div>
    </div>
  );
}
