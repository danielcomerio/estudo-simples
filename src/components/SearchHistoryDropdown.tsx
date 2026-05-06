'use client';

import { useEffect, useRef, useState } from 'react';
import {
  clearSearchHistory,
  loadSearchHistory,
} from '@/lib/search-history';

/**
 * Dropdown de histórico de buscas. Mostrado ao focar o input se há
 * entries salvos. Click insere a busca antiga.
 *
 * Args:
 *  - inputRef: ref do input. Posicionamento absoluto abaixo dele.
 *  - currentValue: valor atual do input. Se não vazio, dropdown fica
 *    escondido (user já está digitando).
 *  - onPick: callback ao clicar numa entry.
 *  - refreshKey: incrementa pra forçar reload do histórico (após save).
 */
export function SearchHistoryDropdown({
  inputRef,
  currentValue,
  onPick,
  refreshKey,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  currentValue: string;
  onPick: (entry: string) => void;
  refreshKey?: number;
}) {
  const [history, setHistory] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory(loadSearchHistory());
  }, [refreshKey]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const onFocus = () => setOpen(true);
    const onBlur = () => {
      // Delay pra permitir click na entry
      setTimeout(() => setOpen(false), 150);
    };
    input.addEventListener('focus', onFocus);
    input.addEventListener('blur', onBlur);
    return () => {
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('blur', onBlur);
    };
  }, [inputRef]);

  const visible = open && currentValue.trim().length === 0 && history.length > 0;
  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 'calc(100% + 4px)',
        left: 0,
        right: 0,
        background: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        zIndex: 60,
        maxHeight: 280,
        overflowY: 'auto',
      }}
    >
      <div
        className="row between"
        style={{
          padding: '6px 10px',
          fontSize: '0.74rem',
          color: 'var(--muted)',
          alignItems: 'center',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span>🕒 Buscas recentes</span>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()} // previne blur antes do click
          onClick={() => {
            clearSearchHistory();
            setHistory([]);
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--muted)',
            cursor: 'pointer',
            fontSize: '0.74rem',
          }}
        >
          Limpar
        </button>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {history.map((entry) => (
          <li key={entry}>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(entry);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: '0.88rem',
                lineHeight: 1.3,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-elev-2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {entry}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
