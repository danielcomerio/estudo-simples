/**
 * Logo do Estudo Simples como SVG inline. Compartilhado entre Topbar
 * (logged) e PublicHeader (anon).
 *
 * Por que inline e não <img src="/icon.svg">: em dev (localhost) o
 * browser/SW às vezes serve cache stale ou nem responde, deixando um
 * quadrado vazio. SVG inline render imediato, sem rede, imune a cache.
 *
 * Mantém visual idêntico ao public/icon.svg (favicon/manifest) — se
 * editar um, edite o outro.
 *
 * Acessibilidade: id dos gradients é prefixado pra evitar colisão
 * quando 2 instâncias do logo coexistem na página.
 */
export function BrandLogo({
  size = 26,
  idPrefix = 'es-bl',
  className,
}: {
  size?: number;
  idPrefix?: string;
  className?: string;
}) {
  const g1 = `${idPrefix}-g1`;
  const g2 = `${idPrefix}-g2`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      role="img"
      aria-label="Estudo Simples"
      width={size}
      height={size}
      className={className}
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={g1} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
        <linearGradient id={g2} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#0b1220" />
      <circle
        cx="32"
        cy="32"
        r="25"
        stroke="#22c55e"
        strokeWidth="2"
        fill="none"
        strokeDasharray="3 4"
        opacity="0.42"
        strokeLinecap="round"
      />
      <path
        d="M 51 19 L 56 14 L 51 14 M 56 14 L 56 20"
        stroke="#22c55e"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
      <circle cx="32" cy="32" r="19" fill={`url(#${g1})`} />
      <circle cx="32" cy="32" r="19" fill={`url(#${g2})`} opacity="0.18" />
      <path
        d="M 22 33 L 29 40 L 43 26"
        stroke="#062013"
        strokeWidth="4.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
