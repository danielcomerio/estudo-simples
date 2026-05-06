import type { MetadataRoute } from 'next';

/**
 * /robots.txt — permite crawlers nas páginas públicas, bloqueia
 * rotas autenticadas (que retornariam redirect pra /login mesmo, mas
 * documenta a intenção pra crawlers).
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://estudo-simples.vercel.app';
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/inicio',
          '/planos',
          '/manual',
          '/sobre',
          '/roadmap',
          '/contato',
          '/concursos-populares',
          '/concursos-populares/',
          '/privacidade',
          '/termos',
          '/login',
          '/signup',
        ],
        disallow: [
          '/banco',
          '/estudar',
          '/discursivas',
          '/cards',
          '/simulado',
          '/stats',
          '/concursos',
          '/disciplinas',
          '/topicos',
          '/configuracoes',
          '/revisar',
          '/duplicatas',
          '/api/',
          '/auth/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
