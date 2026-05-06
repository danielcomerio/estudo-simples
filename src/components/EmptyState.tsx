import Link from 'next/link';

/**
 * Componente padrão pra empty states. Garante consistência visual
 * em todas as rotas: ícone grande + título + descrição opcional + CTA.
 */
export function EmptyState({
  icon,
  title,
  description,
  cta,
  secondary,
}: {
  icon: string;
  title: string;
  description?: string | React.ReactNode;
  cta?: { href?: string; onClick?: () => void; label: string };
  secondary?: { href?: string; onClick?: () => void; label: string };
}) {
  return (
    <div
      className="card"
      style={{
        textAlign: 'center',
        padding: '32px 20px',
        background: 'var(--bg-elev-2)',
        border: '1px dashed var(--border)',
      }}
    >
      <div
        style={{ fontSize: '3rem', lineHeight: 1, marginBottom: 14 }}
        aria-hidden
      >
        {icon}
      </div>
      <h2 style={{ margin: '0 0 8px', fontSize: '1.15rem' }}>{title}</h2>
      {description && (
        <div
          className="muted"
          style={{
            margin: '0 auto 18px',
            maxWidth: 460,
            fontSize: '0.92rem',
            lineHeight: 1.55,
          }}
        >
          {description}
        </div>
      )}
      {(cta || secondary) && (
        <div
          className="row gap"
          style={{ justifyContent: 'center', flexWrap: 'wrap' }}
        >
          {cta &&
            (cta.href ? (
              <Link href={cta.href}>
                <button type="button" className="primary">
                  {cta.label}
                </button>
              </Link>
            ) : (
              <button type="button" className="primary" onClick={cta.onClick}>
                {cta.label}
              </button>
            ))}
          {secondary &&
            (secondary.href ? (
              <Link href={secondary.href}>
                <button type="button">{secondary.label}</button>
              </Link>
            ) : (
              <button type="button" onClick={secondary.onClick}>
                {secondary.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
