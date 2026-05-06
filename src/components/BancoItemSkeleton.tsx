/**
 * Placeholder que imita o layout do banco-item real, em vez de
 * retângulos genéricos. Reduz layout shift quando o conteúdo carrega.
 */
export function BancoItemSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="banco-item"
          style={{
            opacity: 0.6,
            pointerEvents: 'none',
            animationDelay: `${i * 80}ms`,
          }}
          aria-hidden
        >
          <div
            className="skeleton"
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="skeleton"
              style={{
                width: '85%',
                height: 14,
                marginBottom: 6,
                borderRadius: 4,
              }}
            />
            <div
              className="skeleton"
              style={{
                width: '60%',
                height: 14,
                marginBottom: 10,
                borderRadius: 4,
              }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <div
                className="skeleton"
                style={{ width: 60, height: 16, borderRadius: 999 }}
              />
              <div
                className="skeleton"
                style={{ width: 80, height: 16, borderRadius: 999 }}
              />
              <div
                className="skeleton"
                style={{ width: 40, height: 16, borderRadius: 999 }}
              />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
