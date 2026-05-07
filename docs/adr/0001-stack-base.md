# ADR 0001 — Stack base: Next.js 14 + Supabase + Vercel

## Status

Aceito (2026-04-25).

## Contexto

App de SRS pra concursos públicos brasileiros. Migração de SPA standalone
(HTML/CSS/JS + localStorage) pra plataforma com:
- auth + sync entre dispositivos
- backend hosting brasileiro/baixa latência
- preço de infra ≤ USD 50/mês até 1k usuários

## Decisão

- **Frontend**: Next.js 14.2 (App Router, src/, TypeScript estrito)
- **Backend**: Supabase (Postgres + Auth + Storage + RLS)
- **Hosting**: Vercel (free Hobby tier inicial; Pro quando justificar)
- **Pagamentos**: Stripe (Brasil suportado, Pix oferecido futuramente)

## Por quê

- Next 14 estável, App Router permite Server Components leves.
- Supabase: RLS resolve segurança per-tenant sem código de auth próprio.
- Vercel: deploy 1-click, edge runtime, cron jobs nativos.

## Consequências

- + Velocidade de iteração alta
- + Boa experiência de desenvolvimento
- − Vendor lock-in (Supabase + Vercel). Mitigado por padronização SQL +
  Next standard.
- − Custo escalando se crescer (>10k usuários precisa de Vercel Pro).

## Alternativas consideradas

- Remix: similar; Next ganhou por ecosistema mais amplo.
- Self-hosted Postgres + Next: mais controle, mais ops. Não compensa pra
  app monousuário (Daniel).
- Firebase: vendor lock-in pior, sem Postgres.
