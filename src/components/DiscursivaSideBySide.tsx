'use client';

import { useState } from 'react';
import { renderRichText } from '@/lib/utils';

/**
 * Modo "espelho lado-a-lado" pra discursivas. Mostra a resposta do
 * candidato e o espelho oficial em duas colunas pra autoavaliação
 * detalhada.
 *
 * Toggle escondido por default — user clica "comparar lado-a-lado"
 * pra abrir.
 */
export function DiscursivaSideBySide({
  resposta,
  espelho,
}: {
  resposta: string;
  espelho: string;
}) {
  const [open, setOpen] = useState(false);

  if (!resposta.trim() || !espelho.trim()) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        className="ghost"
        onClick={() => setOpen((o) => !o)}
        style={{ padding: '6px 12px', fontSize: '0.85rem' }}
      >
        {open ? '▼ Fechar comparação' : '◀▶ Comparar lado-a-lado'}
      </button>
      {open && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
            marginTop: 10,
          }}
        >
          <div
            style={{
              padding: 12,
              background: 'var(--bg-elev-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
            }}
          >
            <h4 style={{ margin: '0 0 8px', fontSize: '0.92rem' }}>
              📝 Sua resposta
            </h4>
            <div
              style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.55 }}
              dangerouslySetInnerHTML={{ __html: renderRichText(resposta) }}
            />
          </div>
          <div
            style={{
              padding: 12,
              background: 'var(--primary-soft)',
              border: '1px solid var(--primary)',
              borderRadius: 'var(--radius)',
            }}
          >
            <h4 style={{ margin: '0 0 8px', fontSize: '0.92rem' }}>
              ✅ Espelho oficial
            </h4>
            <div
              style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.55 }}
              dangerouslySetInnerHTML={{ __html: renderRichText(espelho) }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
