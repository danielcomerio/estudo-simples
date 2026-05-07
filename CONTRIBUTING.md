# Contribuindo com o Estudo Simples

App é open desenvolvimento. Aceita-se contribuições de bugs, features,
docs e testes.

## Setup local

```bash
git clone https://github.com/danielcomerio/estudo-simples
cd estudo-simples
npm install
cp .env.local.example .env.local
# Preencher NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Pra setup completo (Stripe, push, etc): ver `docs/DEPLOY.md`.

## Stack

- Next.js 14.2 App Router (`src/`)
- TypeScript estrito
- Supabase (Postgres + Auth + Storage)
- Vercel hosting + cron
- Vitest pra testes

Sem Tailwind, sem shadcn — CSS puro com variáveis em `globals.css`.
Decisão deliberada (ver CLAUDE.md).

## Workflow

1. **Issue antes** pra mudanças >100 linhas (alinha escopo).
2. **Branch** com prefix:
   - `feat/` — feature nova
   - `fix/` — bug
   - `chore/` — refactor / cleanup
   - `docs/` — só documentação
   - `test/` — só testes
3. **Commit small + atomic**. Conventional Commits format encorajado:
   - `feat(banco): empty state melhorado`
   - `fix(checkout): bloqueia duplo checkout`
4. **PR** com descrição clara, screenshots se UI, link pra issue.

## Antes de PR

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run lint        # next lint
NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x npm run build
```

Tudo deve passar. Se não, fix antes.

## Onde por o que

- **Componentes UI**: `src/components/`
- **Páginas**: `src/app/<rota>/page.tsx`
- **Lógica pura/hooks**: `src/lib/`
- **Tests**: `src/lib/__tests__/<nome>.test.ts`
- **Migrations**: `supabase/migrations/NNNN_*.sql` + par `_down.sql`
- **Docs**: `docs/`
- **CLAUDE.md**: briefing técnico — atualize se mudar algo arquitetural

## Convenções de código

- **Imports**: usar path alias `@/` (= `src/`).
- **Client components**: `'use client';` no topo.
- **Toasts**: `import { toast } from '@/components/Toast';`.
- **Confirm destrutivo**: `confirmDialog({...danger: true})`.
- **Sem comentários óbvios**. Só "por quê" não-óbvio.
- **Nada de emojis em código** sem o user pedir.
- **Sem `any`** sem comentário justificando.

## Migrations — gotchas críticos

Ler `docs/MIGRATIONS.md` ANTES de criar nova. Resumo dos problemas
comuns:

- **Gotcha #13**: ao adicionar coluna em `questions`, OBRIGATÓRIO atualizar
  `lib/sync.ts` `questionToRow` E `rowToQuestion` na MESMA PR.
- **#15**: FK composta apontando pra parent precisa que parent tenha
  `UNIQUE (id, user_id)`. `questions` ganhou na 0014.
- **#21**: aplicar manual no Supabase — não tem migrate auto.

## Testes

- **Unit tests**: pra lib pura (`lib/normalize.ts`, `lib/billing.ts`).
- **Integration**: smoke pra components não bloqueadas por mock pesado.
- **Sem Playwright/E2E** ainda — considerar quando ≥10k usuários.

Cada PR de feature deve incluir tests. Cobertura atual: 483 tests.

## Performance

`docs/PERFORMANCE.md` tem snapshot atual. Não regredir bundle inicial
sem justificativa. Use `dynamic import` pra modais raros.

## Acessibilidade

- Todos os botões só-ícone: `aria-label` + `title`.
- Inputs: `<label>` ou `aria-label`.
- Modais: `<dialog showModal()>` (focus trap nativo).
- Skip-link: `#main-content`.
- Audit checklist: `docs/LIGHTHOUSE_CHECKLIST.md`.

## Dúvidas

- Issue no GitHub
- Email contato@estudosimples.com.br

## Code of Conduct

Seja gentil. Critique código, não pessoas. Inclusivo a todos os
níveis técnicos.
