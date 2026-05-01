'use client';

import { useEffect, useRef, useState } from 'react';
import { useConcursos } from '@/lib/hierarchy';
import { setActiveConcursoId, useActiveConcursoId } from '@/lib/settings';
import { toast } from './Toast';

/**
 * Selector compacto pro Topbar — mostra o concurso ativo e abre dropdown
 * pra trocar. "Todos" significa sem filtro (vê tudo).
 *
 * Behavior:
 *  - Sem concursos cadastrados: mostra "Sem concursos" link pra /configuracoes.
 *  - 1+ cadastrados: dropdown com lista + opção "Todos".
 *  - Persistência em localStorage via lib/settings.
 *
 * O filtro real (questões mostradas) é aplicado pelos componentes consumidores
 * — este aqui só edita o setting.
 */
export function ActiveConcursoSelector() {
  const { data: concursos } = useConcursos();
  const activeId = useActiveConcursoId();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Defesa: se o concurso ativo foi excluído em outra tab, volta pra "todos"
  useEffect(() => {
    if (!activeId || !concursos) return;
    const exists = concursos.some((c) => c.id === activeId);
    if (!exists) {
      setActiveConcursoId(null);
      toast('Concurso ativo removido — voltando para "todos"', 'warn');
    }
  }, [activeId, concursos]);

  const active = concursos?.find((c) => c.id === activeId) ?? null;
  const label = active?.nome ?? 'Todos os concursos';

  if (!concursos || concursos.length === 0) {
    return null;
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="ghost"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Trocar concurso ativo"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          maxWidth: 240,
        }}
      >
        <span aria-hidden style={{ fontSize: '0.85em' }}>📚</span>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        <span aria-hidden style={{ fontSize: '0.7em', opacity: 0.6 }}>▾</span>
      </button>

      {open && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 4px)',
            background: 'var(--bg-elev-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            listStyle: 'none',
            margin: 0,
            padding: 4,
            minWidth: 240,
            maxHeight: 320,
            overflowY: 'auto',
            zIndex: 50,
          }}
        >
          <ConcursoOption
            label="Todos os concursos"
            sub="ver questões de qualquer concurso"
            isActive={activeId === null}
            onClick={() => {
              setActiveConcursoId(null);
              setOpen(false);
            }}
          />
          <li
            aria-hidden
            style={{
              borderTop: '1px solid var(--border)',
              margin: '4px 0',
            }}
          />
          {concursos.map((c) => (
            <ConcursoOption
              key={c.id}
              label={c.nome}
              sub={[c.banca, c.orgao].filter(Boolean).join(' · ') || null}
              isActive={activeId === c.id}
              onClick={() => {
                setActiveConcursoId(c.id);
                setOpen(false);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ConcursoOption({
  label,
  sub,
  isActive,
  onClick,
}: {
  label: string;
  sub: string | null;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={isActive}
        onClick={onClick}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '8px 10px',
          borderRadius: 'var(--radius)',
          border: 'none',
          background: isActive ? 'var(--primary-soft)' : 'transparent',
          cursor: 'pointer',
          color: 'var(--text)',
        }}
      >
        <div style={{ fontWeight: isActive ? 600 : 400 }}>
          {isActive && '✓ '}
          {label}
        </div>
        {sub && (
          <div className="muted" style={{ fontSize: '0.82rem', marginTop: 2 }}>
            {sub}
          </div>
        )}
      </button>
    </li>
  );
}
