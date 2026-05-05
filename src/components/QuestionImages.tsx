'use client';

import { useEffect, useState } from 'react';

/**
 * Renderiza as imagens anexadas a uma questão (do payload.imagens).
 * Esconde-se quando vazio.
 *
 * Click abre LIGHTBOX in-app (overlay com zoom). Antes era target=_blank
 * que tirava o user da sessão. Esc/Click fora fecha.
 */
export function QuestionImages({
  urls,
  size = 'normal',
}: {
  urls: string[] | undefined;
  size?: 'normal' | 'compact';
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setLightbox(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  if (!urls || urls.length === 0) return null;
  const maxWidth = size === 'compact' ? 220 : 480;
  const maxHeight = size === 'compact' ? 140 : 360;
  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          margin: '8px 0',
        }}
      >
        {urls.map((url, i) => (
          <button
            key={url + i}
            type="button"
            onClick={() => setLightbox(url)}
            title="Ampliar imagem"
            style={{
              display: 'block',
              maxWidth,
              maxHeight,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
              background: 'var(--bg-elev-2)',
              padding: 0,
              cursor: 'zoom-in',
            }}
          >
            <img
              src={url}
              alt={`imagem ${i + 1}`}
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight,
                objectFit: 'contain',
              }}
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {lightbox && (
        <div
          role="dialog"
          aria-modal
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 250,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            cursor: 'zoom-out',
          }}
        >
          <img
            src={lightbox}
            alt="imagem ampliada"
            style={{
              maxWidth: '95vw',
              maxHeight: '95vh',
              objectFit: 'contain',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Fechar"
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(0,0,0,0.5)',
              color: 'white',
              fontSize: '1.2rem',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
