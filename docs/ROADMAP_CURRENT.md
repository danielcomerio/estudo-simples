# Roadmap CURRENT — escopo concurso/SRS

Tasks que agregam ao app **sem mudar o positioning**. Concurso continua o produto.
Toda task aqui:
- Reusa schema/infra existente.
- Não exige abstrações genéricas (nada de `study_contexts`, agenda multi-contexto, etc).
- Tem ROI claro pro concurseiro.

Ordem de execução em sprints. **Pause-point** entre sprints pra avaliar valor antes de continuar.

---

## Sprint 1 — MVP geração + foundation

- [ ] **A5** Streaming SSE em `/api/ai/chat` (opt-in via flag, não quebra clientes atuais)
- [ ] **A4** Cache de explicações (`ai_response_cache` table — migration 0026)
- [ ] **A1** Geração de questões via IA no /banco (wizard preview/aceitar/descartar/editar)

**Entregável**: user gera 5 questões via IA, revê preview, aceita/edita/descarta. Explicações streamam character-by-character. Mesma explicação pedida 2x = grátis na 2ª.

## Sprint 2 — chat + transparência

- [ ] **A6** Tracking `ai_usage` (tokens/dia/provider visível ao user)
- [ ] **A2** Chat persistente por questão (drawer)
- [ ] **A3** Reescrever/parafrasear questão (gerar variações)

## Sprint 3 — backfill rápido

- [ ] **B3** OCR de foto de questão → entry no banco (vision model)
- [ ] **A7** Cloze gen a partir de texto colado

## Sprint 4 — fontes confiáveis (anti-alucinação)

- [ ] **B1** Vade Mecum API (Direito) — busca artigo literal
- [ ] **B2** Jurisprudência STJ/STF (busca por súmula/tema)

## Sprint 5 — Discovery / pull novos users

- [ ] **B4** Editais ativos (PCI/PNCP) → cards no Dashboard

## Sprint 6 — Gamification IA + AI Coach (escopo concurso)

- [ ] **C1** AI Coach do concurso ativo (chat global, conhece disciplinas fracas)
- [ ] **C2** Personas customizáveis vinculadas a concurso ("Prof. FGV — Direito")
- [ ] **C3** Marketplace de personas (extensão da C4 atual de decks)
- [ ] **C4** Achievement: "Mestre da banca FGV" (reusa AchievementDetector)

## Sprint 7 — Eventos vinculados a concurso (NÃO virar agenda genérica)

- [ ] **D1** `events` table **child de concurso** (provas, simulados, redações)
- [ ] **D2** Reminder de eventos via `notifyUser` (push/telegram/discord)
- [ ] **D3** Google Calendar **export one-way** (sync push)
- [ ] **D4** ICS subscribe URL pública (`/api/ics/[token]`)

## Sprint 8 — Pricing

- [ ] **E1** Tier "Pro+" com pool de tokens IA inclusos (app paga)
- [ ] **E2** UI "BYO te economiza R$X/mês"

## Manutenção / qualidade (paralelo, picado entre sprints)

- [ ] **F1** Migrar PomodoroTimer/GoalCelebration/OnboardingTour/GlobalDropZone pro `<Modal>` helper
- [ ] **F2** Tests pra Modal, AchievementDetector, BadgingHost
- [ ] **F3** Audit hooks: `account.signup`, `sharing.created`, `sharing.revoked`, `password.changed`
- [ ] **F4** Verificar Gotcha #13 pra cada migration nova (push/pull não quebra)
- [ ] **F5** Refactor split de Dashboard (700+ LOC) e StatsView (3400+ LOC)
- [ ] **F6** Streaming também no AIDiscursivaEvaluator
- [ ] **F7** `check:migrations` ganha `--mark-applied <id>`

---

## Fora de escopo (CURRENT) — ver `ROADMAP_PIVOT_FROZEN.md`

Tudo que exige `study_contexts` genérico, agenda multi-contexto, ou abstração que descaracterize o app como "plataforma de concurso" foi pra stack PIVOT.
