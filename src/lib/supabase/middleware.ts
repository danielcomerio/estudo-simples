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
  // API routes do Stripe usam própria auth (signature/cookies). Webhook
  // recebe POST direto do Stripe sem nossa sessão.
  '/api/stripe/webhook',
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

  return response;
}
