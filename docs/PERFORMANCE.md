# Performance — análise atual

Snapshot do bundle em 2026-05.

## Bundle sizes (após build)

| Rota | Page | First Load JS |
|------|------|---------------|
| `/` (Painel) | 16 kB | 259 kB |
| `/banco` | 50.2 kB | 297 kB |
| `/estudar` | 17.4 kB | 272 kB |
| `/cards` | 8.1 kB | 262 kB |
| `/discursivas` | 8.85 kB | 263 kB |
| `/simulado` | 12.1 kB | 258 kB |
| `/stats` | 21.1 kB | 265 kB |
| `/configuracoes` | 15.1 kB | 264 kB |
| `/decks` | 4.94 kB | 163 kB |
| `/concursos` | 5.93 kB | 249 kB |
| `/revisar` | 6.21 kB | 250 kB |
| `/import/[token]` | 5.77 kB | 243 kB |
| **Public pages** | <2 kB | <100 kB |
| **Middleware** | — | 79.5 kB |

**Shared chunks**: 87.4 kB (Next + React + comuns).

## Análise

### Boas
- Public pages (planos, sobre, manual) ficam em ~96-100 kB First Load —
  excelente pra SEO/lighthouse.
- Banco páginas privadas ficam em 240-300 kB — aceitável pra app
  rico em features.
- Middleware compacto (79.5 kB).

### Pontos de atenção
- `/banco` tem 50 kB de page chunk — maior. Esperado: contém
  filters, bulk actions, drawers, share, etc.
- `/stats` tem 21 kB — viz library + cálculos. Já usa `LazyMount`
  pra adiar visualizações pesadas.

### Sem otimizações pendentes urgentes
- Lazy-load de modais (ShareDeckButton, CommandPalette) economiza
  ~5-10 kB cada mas não muda perceived perf.
- Tree-shake de KaTeX (carrega ~50 kB) só compensa se < 5% das
  questões usam LaTeX.

## Lighthouse esperado

Em produção (HTTPS, gzip, brotli):
- Performance: 85-95 (varia por rede)
- Accessibility: 95+ (após audits aplicados)
- Best Practices: 100
- SEO: 100 (public pages)
- PWA: 100 (manifest ok, SW ok, ícones ok)

Pra rodar local: Lighthouse no Chrome DevTools com throttling
"Slow 4G".

## Recomendações futuras

Se virar bottleneck:
1. **Image optimization**: `next/image` em vez de `<img>` puro
   onde aplicável (logo já é SVG inline).
2. **Font loading**: usar `display: swap` nos `<link rel="preload">`
   (não há fontes externas hoje — system fonts).
3. **Prefetch de rotas**: Link já faz prefetch automático no hover.
4. **Code splitting agressivo**: dynamic imports pra ShareDeckButton,
   CommandPalette, ShortcutsHelp se a tela inicial pesar mais.
5. **Bundler analyzer**: `npm install -D @next/bundle-analyzer` pra
   ver detalhe de cada chunk.

Hoje **NENHUMA dessas é necessária** — bundle está razoável e
percepção de velocidade depende mais de network do que de bundle size.
