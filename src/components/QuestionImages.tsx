'use client';

/**
 * Renderiza as imagens anexadas a uma questão (do payload.imagens).
 * Esconde-se quando vazio.
 *
 * Layout: lista vertical responsiva, max-width controlado pra não
 * estourar o card. Click amplia (target="_blank" abre URL pública
 * em nova aba — bucket é público).
 */
export function QuestionImages({
  urls,
  size = 'normal',
}: {
  urls: string[] | undefined;
  size?: 'normal' | 'compact';
}) {
  if (!urls || urls.length === 0) return null;
  const maxWidth = size === 'compact' ? 220 : 480;
  const maxHeight = size === 'compact' ? 140 : 360;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        margin: '8px 0',
      }}
    >
      {urls.map((url, i) => (
        <a
          key={url + i}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir em tamanho real"
          style={{
            display: 'block',
            maxWidth,
            maxHeight,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            background: 'var(--bg-elev-2)',
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
        </a>
      ))}
    </div>
  );
}
