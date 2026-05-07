# Changelog

Mudanças relevantes pro user (não inclui refactor interno, fixes triviais
de tipo, ou tweaks de a11y minor — esses ficam só no git log).

Datas em ISO. Versões semver-ish (não publicado em registry — release
contínua na Vercel).

## [2026-05 — onda 2.5] — Stats avançados + Marketplace + Audit (2026-05-07)

### Novo

- **🎯 Forecast** em /stats: quando atinge a meta de revisões.
- **👥 Comparativo com peers**: P25/P50/P75 anônimo da comunidade.
- **📅 Streak diário** em Conquistas (/diario).
- **⚙️ Daily Preferences** UI em Configurações.
- **🎁 Badge "Novidades"** no Topbar com dot vermelho.
- **⭐ Decks favoritos** no marketplace público.
- **👾 Discord** webhook (sem bot, validação com ping).
- **💬 Comments** públicos por questão (API).
- **🔁 Retenção D1/D7/D30** no /admin.
- **🐛 Errors dashboard** /admin/errors (Sentry-lite).
- **📤 Share card** de progresso (PNG OG dinâmico).
- **🎉 XP toast** animado ao acertar (15/10/5 por confidence).
- **🔔 PWA badging** count de pendentes no ícone do app.
- **🩺 Health check** Telegram.
- **🖼️ OG image** dinâmica /import/[token].
- **📋 Docs**: DEPLOY.md, EMAIL_TEMPLATES.md.

### Performance/UX

- Service Worker v2: cacheia imagens Supabase Storage + pre-cache rotas.
- Prefetch das próximas 3 imagens na queue de estudar.
- Print-friendly aprimorado para /banco.

### Auditoria/Privacidade

- Migration 0024 audit_log com IP+UA opcional.
- audit() helper plugado em sharing.public_enabled.

### Migrations

- 0021 deck_favorites
- 0022 discord_webhooks
- 0023 question_comments
- 0024 audit_log

### Tests

- 574 testes (+76 nessa onda: forecast, daily-streak, percentile, discord,
  whats-new, migrations smoke, anki edge, sharing extra, notify-helpers).

### Limpeza

- EmptyState.tsx + TopicosSection.tsx removidos (612 LOC).

## [2026-05 — onda 2] — IA + Engagement + Curadoria

### Novo

- **🤖 AI Tutor BYO key**: explica questões erradas usando sua própria
  chave OpenAI/Anthropic/Gemini. Sem custo pro app.
- **🤖 Avaliador de discursivas via IA**: nota 0-10 + feedback
  estruturado contra espelho. BYO key.
- **📅 Questões do Dia**: /diario com set comunitário curado +
  ranking competitivo top 50.
- **📲 Telegram**: vincule sua conta pra receber lembretes via bot.
  Fallback automático quando push não chega.
- **👍/👎 Rating de questões**: comunidade curadoria. Útil pra
  marketplace.
- **🎴 Anki TSV export**: backup/migração universal.
- **🔊 TTS**: leitura de enunciados em voz (Web Speech API).
- **📚 Marketplace público de decks**: descoberta via /decks-publicos.
- **📅 Concurso countdown** no Topbar com cores por urgência.

### Mudanças

- Mobile drawer: scroll lock + z-index 9999.
- Logo SVG inline em todo lugar (consistência).

### Migrations

- 0017 marketplace público
- 0018 telegram bindings
- 0019 questões do dia
- 0020 question ratings

## [2026-05 — onda 1] — Sharing + Mobile + Push

### Novo

- **Live decks (Fase C3)**: compartilhe um deck de questões com colegas
  por email. Eles veem em tempo real (read-only). Quando você revoga o
  acesso, um snapshot final fica preservado pra eles continuarem
  estudando. Página `/decks` pra gerenciar.
- **Snapshot links (Fase C2)**: gere um link público com seleção de
  questões. Receptor importa cópia pra própria conta. Botão
  "🔗 Compartilhar" em `/banco` (toolbar bulk). Gestão dos links em
  `/configuracoes`.
- **Tier Pro/Master**: sharing limitado a Pro/Master. Free vê upsell.
- **Origem do gabarito**: distinguir gabarito oficial vs gerado por IA.
  Badge 🤖 IA em `/banco`, durante estudo (objetivas/cards/discursivas)
  e relatório de simulado. Filtro novo + chip rápido "🤖 IA p/ validar".
  Bulk action "✓ Marcar oficial".
- **Push notifications**: infra completa (FCM/APNS/Web Push). Botão
  "Ativar notificações" em `/configuracoes`. Cron diário 12h dispara
  pra revisões SRS vencendo (requer VAPID configurado).
- **Mobile**: capacitor.config.ts pronto pra wrap em Android/iOS. Setup
  detalhado em `docs/CAPACITOR_SETUP.md`.
- **Conta Master**: tier especial pra owner/admin. Sem limites, sem
  passar por Stripe, blindado contra rebaixamento.

### Mudanças importantes

- **Ctrl+F**: devolvido ao find-in-page nativo do browser (era hijacked
  pra busca global). Busca global agora é `Ctrl+Shift+F`.
- **Disciplinas auto-derivadas (Fase A/B)**: import normaliza
  disciplina/tags pra slug canônico. Variações de acento ("Matemática"
  vs "matematica") agora viram a mesma disciplina automaticamente.
  Schema migrou pra FK rígida com dual-write.
- **N:N concurso ↔ questão (Fase C1)**: questão pode pertencer a
  múltiplos concursos sem duplicar.
- **Layout**: topbar/bottom-nav voltam corretamente após navegar pra
  página pública e voltar (BFCacheGuard).

### Correções

- Master mostrava "Status: canceled" no /configuracoes (webhook
  Stripe não pulava master). Resolvido em 3 camadas (webhook +
  trigger DB + UI).
- Duplo checkout aceito mesmo com subscription ativa. Agora bloqueia
  com 409 + UI sugere portal.
- Logo localhost vazio em dev (cache). SVG agora inline.
- Checkbox de seleção em /banco com hitbox 36×36 (era 18×18).
- Toast aria-live separado por severidade (errors em region assertive).
- ConfirmDialog com aria-labelledby + aria-describedby.

### Arquivos pra você (admin/dev)

- `docs/MANUAL.md` — manual do usuário, atualizado com origem do gabarito.
- `docs/API.md` — referência dos endpoints REST.
- `docs/CAPACITOR_SETUP.md` — passo-a-passo mobile.
- `docs/MOBILE_ANALYSIS.md` — análise técnica das opções mobile.
- `CLAUDE.md` — briefing pra próximas sessões de Claude.
- `supabase/manual/promote_master.sql` — promove user a master.
- `supabase/manual/promote_master_template.sql` — versão genérica.
- `supabase/manual/backfill_gabarito_ia.sql` — marcar questões com
  gabarito gerado por IA retroativamente.

## [2026-04 e anterior] — Onda 0/1/2

Ver `CLAUDE.md` seção "Histórico crítico de decisões" pra
narrativa completa das ondas 0 (migração inicial), 1 (ferramentas de
import + tipos novos) e 2 (refinements e produtividade).

Resumo: app começou como SPA standalone (HTML/CSS/JS + localStorage)
em abril/2026 e migrou pra Next.js 14 + Supabase + Vercel em
2026-04-25. Onda 0 estabilizou hierarquia (concursos/disciplinas/
tópicos), Onda 1 introduziu questões reais com origem/fonte/
verificação + cloze/flashcard, Onda 2 trouxe IndexedDB, sync
resiliente, KaTeX, imagens, confidence rating.
