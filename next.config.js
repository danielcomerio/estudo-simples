/** @type {import('next').NextConfig} */

// CSP estrita. Justificativas pra cada source:
//  - script-src 'self' + 'unsafe-inline' pra runtime do Next (style/_next/static).
//    'unsafe-eval' SÓ em dev (Next dev server usa eval pra HMR/React Refresh).
//    Em produção fica fora — defesa contra XSS via injeção de eval.
//  - connect-src: Supabase (domínio configurado por env), Stripe API (pra
//    hosted Checkout / Customer Portal). Em dev, ws://localhost pra HMR.
//  - frame-src: Stripe Checkout/Customer Portal (iframes do Stripe Elements
//    se forem usados no futuro).
//  - img-src: 'self' + data: (KaTeX inline) + blob: (lightbox preview) +
//    https: pra imagens de Supabase Storage.
//  - object-src 'none': bloqueia <object>/<embed> (XSS vetor antigo).
//  - frame-ancestors 'none': clickjacking impossível.
//  - upgrade-insecure-requests: força HTTPS em sub-resources (skip em dev pra http://localhost).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
let supabaseHost = '';
let supabaseWs = '';
try {
  if (supabaseUrl) {
    const u = new URL(supabaseUrl);
    supabaseHost = u.origin;
    supabaseWs = u.origin.replace(/^https/, 'wss');
  }
} catch {}

const isDev = process.env.NODE_ENV !== 'production';

const scriptSrc = isDev
  ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com`
  : `script-src 'self' 'unsafe-inline' https://js.stripe.com`;

const connectSrc = isDev
  ? `connect-src 'self' ${supabaseHost} ${supabaseWs} https://api.stripe.com ws://localhost:* http://localhost:*`
  : `connect-src 'self' ${supabaseHost} ${supabaseWs} https://api.stripe.com`;

const csp = [
  `default-src 'self'`,
  scriptSrc,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data:`,
  connectSrc,
  `frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://billing.stripe.com`,
  `frame-ancestors 'none'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self' https://checkout.stripe.com https://billing.stripe.com`,
  // upgrade-insecure-requests só em prod — em dev quebra http://localhost
  isDev ? '' : `upgrade-insecure-requests`,
]
  .filter(Boolean)
  .join('; ');

const securityHeaders = [
  // CSP — defesa principal contra XSS
  { key: 'Content-Security-Policy', value: csp },
  // HSTS — força HTTPS por 2 anos, inclui subdomínios
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Não-inferência de MIME (mitiga XSS via tipo errado)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Não embed em iframes (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Privacy: não vaza referer pra terceiros completos
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Bloqueia features perigosas que app não usa
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(self "https://checkout.stripe.com")',
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['@supabase/ssr', '@supabase/supabase-js'],
  },
  async headers() {
    return [
      {
        // Aplica em tudo exceto assets estáticos (que o Vercel serve direto)
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
