import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookiePayload = { name: string; value: string; options?: CookieOptions };

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/auth/callback',
  '/manual',
  '/inicio',
  '/planos',
  '/privacidade',
  '/termos',
  '/contato',
  '/sobre',
  '/roadmap',
  '/concursos-populares',
  // API routes do Stripe usam própria auth (signature/cookies). Webhook
  // recebe POST direto do Stripe sem nossa sessão.
  '/api/stripe/webhook',
  // Health check sem auth (uptime monitoring)
  '/api/health',
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookiePayload[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: getUser() para revalidar a sessão e atualizar cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isGuest = request.cookies.get('es-guest')?.value === '1';

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  // Sem user real e sem flag de visitante: força login
  if (!user && !isGuest && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    if (pathname && pathname !== '/') {
      url.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(url);
  }

  // Real auth user tentando acessar /login ou /signup → home (já tem conta).
  // Visitante PODE acessar /signup pra criar conta + migrar dados — esse é
  // exatamente o ponto do modo visitante (testar e depois converter). Em
  // /login também é permitido visitante caso queira logar com conta existente.
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Headers de segurança aplicados em todas as rotas que passam pelo
  // middleware. Não sobrescrevem se já setados a jusante.
  applySecurityHeaders(response);

  return response;
}

/**
 * Headers de segurança defensivos. Mitigam XSS, clickjacking, MIME
 * sniffing e referer leak.
 *
 * CSP é deliberadamente permissivo pra Stripe (precisa scripts inline
 * + eval em iframes de checkout) e Supabase. Mais restritivo no future
 * se rastrearmos todos os scripts.
 */
function applySecurityHeaders(response: NextResponse): void {
  const supabaseHost = (() => {
    try {
      return process.env.NEXT_PUBLIC_SUPABASE_URL
        ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
        : '';
    } catch {
      return '';
    }
  })();

  const csp = [
    "default-src 'self'",
    // Scripts: self + Stripe + Vercel Analytics. unsafe-inline necessário
    // pra Next.js inline scripts (poderia trocar por nonce, mas exige
    // mudar SSR). 'unsafe-eval' pra ts-fsrs/lz-string que usam Function().
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
    // Style: inline pra emojis, KaTeX, styled props.
    "style-src 'self' 'unsafe-inline'",
    // Images: self + data: (svg inline) + blob: (preview de uploads) +
    // Supabase storage (questions-images bucket).
    `img-src 'self' data: blob: ${supabaseHost}`,
    // Fontes do system + KaTeX font face inline (data:).
    "font-src 'self' data:",
    // Fetch: API Supabase + Stripe.
    `connect-src 'self' ${supabaseHost} https://api.stripe.com https://*.supabase.co`,
    // Iframes: só Stripe (checkout/portal).
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "frame-ancestors 'none'", // anti-clickjacking
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(self), geolocation=(), payment=(self "https://js.stripe.com")'
  );
  // X-Frame-Options legado (browsers velhos sem CSP frame-ancestors)
  response.headers.set('X-Frame-Options', 'DENY');
}
