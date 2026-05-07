# Diferenciais competitivos — pesquisa & roadmap

Reflexão sobre features que podem distinguir o Estudo Simples no
mercado de apps de SRS pra concursos públicos brasileiros.

## Cenário competitivo

Players principais:
- **Anki** — universal, mas UX antiquada e foco genérico (não específico pra concurso BR)
- **QConcursos** — banco enorme de questões reais mas pouco SRS científico
- **Gran Cursos / Estratégia** — cursos completos com tutoria, caro
- **TEC Concursos** — banco + simulados mas sem SRS adaptativo
- **Apps menores** (Memrise, Quizlet) — não específicos pra concurso BR

**Nosso ponto cego diferencial**: SRS **rigoroso** (SM-2 + FSRS-6) +
**conteúdo flexível** (importa de qualquer fonte) + **brasileiro**
(disciplinas, bancas, layout) + **offline-first**.

## Categorias de diferenciais

### 1. Conteúdo & IA (alto impacto)

| # | Feature | Custo | Impacto |
|---|---------|-------|---------|
| 1.1 | OCR de imagens (Tesseract.js) — importar de PDF/screenshot | Médio | Alto |
| 1.2 | TTS leitura de enunciado (Web Speech API) | Baixo | Médio |
| 1.3 | AI Tutor opcional (BYO API key — OpenAI/Anthropic/Gemini) | Baixo | Alto |
| 1.4 | Auto-classificação tópicos via LLM | Médio | Médio |
| 1.5 | Detecção semântica de duplicatas (embeddings) | Alto | Baixo |
| 1.6 | Anki .apkg import/export | Médio | **Muito alto** (canal de adoção) |
| 1.7 | Quizlet import | Baixo | Baixo |

### 2. Estudo & Engagement

| # | Feature | Custo | Impacto |
|---|---------|-------|---------|
| 2.1 | Pomodoro integrado com SRS (ciclos automáticos) | Baixo | Alto |
| 2.2 | Modo "esmagar" (gauntlet com pressão temporal crescente) | Baixo | Médio |
| 2.3 | Modo foco extremo (esconde tudo exceto questão) | Baixo | Médio |
| 2.4 | Sessões focadas em fraquezas (auto-gera) | Baixo | Alto |
| 2.5 | Live study rooms (WebRTC + chat) | Alto | Alto |
| 2.6 | Conquistas/streaks expandido (já implementado parcial) | — | — |

### 3. Integrações externas

| # | Feature | Custo | Impacto |
|---|---------|-------|---------|
| 3.1 | Calendar export (.ics) das revisões agendadas | Baixo | **Alto** |
| 3.2 | Notion sync (export questões) | Médio | Médio |
| 3.3 | Google Calendar/iCloud bidirecional | Alto | Alto |
| 3.4 | WhatsApp bot pra responder questões | Muito alto | Médio |
| 3.5 | Login social (Google/Apple) | Médio | Alto |
| 3.6 | Stripe + Pix (já tem Stripe; Pix via Stripe Brasil) | Baixo | Alto |
| 3.7 | Webhooks personalizados pra integrações de cursinhos | Alto | Médio |

### 4. Analytics & Coaching

| # | Feature | Custo | Impacto |
|---|---------|-------|---------|
| 4.1 | Heatmap de cobertura do edital | Baixo | **Muito alto** |
| 4.2 | Predição de aprovação (modelo simples) | Médio | Alto |
| 4.3 | Concurso countdown global (Topbar) | Baixo | Alto |
| 4.4 | AI coaching textual (BYO key) | Baixo | Alto |
| 4.5 | Comparativo com média de outros users | Médio | Médio |

### 5. Sharing & Social (já cobrimos C2/C3)

| # | Feature | Status |
|---|---------|--------|
| 5.1 | Snapshot links | ✅ feito |
| 5.2 | Live decks com revogação freeze | ✅ feito |
| 5.3 | Marketplace público de decks | A fazer |
| 5.4 | Comentários por questão | Considerar (moderação) |
| 5.5 | Ranking acertos por questão | Considerar (privacidade) |

### 6. Acessibilidade & UX

| # | Feature | Status |
|---|---------|--------|
| 6.1 | High contrast mode | ✅ existe |
| 6.2 | Keyboard navigation Vim-like | ✅ existe |
| 6.3 | Screen reader optimized | ✅ feito (aria-labels, aria-live) |
| 6.4 | TTS reading | A fazer |
| 6.5 | Voice input pra discursivas | ✅ existe |

## Ordem de implementação proposta (esta sessão)

Priorizo baixo custo + alto impacto + viável sem dependências externas:

1. **DIFERENCIAIS.md** — este documento (registro de visão)
2. **Calendar .ics export** das revisões — útil + simples
3. **Concurso countdown global** — engagement diário, simples
4. **TTS de leitura de enunciados** — Web Speech API
5. **Heatmap de cobertura do edital** — visual de cobertura em /stats
6. **Modo "Foco extremo"** — esconde UI durante questão
7. **Pomodoro integrado com SRS** — ciclos automáticos
8. **Anki .apkg export** — canal de adoção (Anki users que querem migrar)
9. **AI Tutor opcional (BYO key)** — settings pra OpenAI/Anthropic key,
   chat embutido pra explicar erros
10. **Marketplace listagem pública (extensão C2)** — descobrir decks
11. **Sessão "atacar fraquezas"** — auto-gera com top piores
12. **Login social Google** — reduz fricção signup

Não-implementáveis nesta sessão (custo alto):
- WhatsApp bot, OCR robusto, Live rooms, AI local pesado, Notion bidirecional

## Integrações de IA — análise detalhada

### Modelo BYO (Bring Your Own) API key

**Conceito**: usuário pluga sua própria chave OpenAI/Anthropic/Gemini.
App nunca paga API call. Settings page tem campos pra cada provider.

**Vantagens**:
- Zero custo pro app
- User tem controle (escolhe modelo, vê billing)
- Pro users provavelmente já têm contas dessas IAs

**Desvantagens**:
- Fricção pro user comum (precisa criar conta + pegar key)
- Suporte a debugging vira complicado

**Implementação**:
- Settings → "Conexão com IAs"
- Campos: OpenAI key, Anthropic key, Gemini key
- LocalStorage criptografado (já temos `lz-string`; usar `crypto.subtle`
  com chave derivada de algo no user)
- Edge function proxy `/api/ai/chat` que recebe key + prompt e
  faz pass-through (NÃO armazena a key no server)
- Botão "Explicar" em questões erradas chama o proxy
- Default: prompt formatado com a questão + erro do user

### Modelo nosso (managed)

App provê API com gates de uso (rate limit por plano). Custo do app.

**Vantagem**: zero fricção
**Desvantagem**: custo escala com base; precisa controle de abuse

**Decisão**: começar com BYO. Se virar feature popular, considerar
managed pra Pro com cap.

## Diferencial mais provavelmente vencedor

**Heatmap de cobertura do edital + AI tutor BYO + Calendar sync**.

Por quê: nenhum competidor brasileiro foca em SRS científico **+**
visualização de cobertura **+** integração com produtividade
(calendar). É o nicho exato do concurseiro autodidata.

## Roadmap executado nesta sessão

Ver tasks abaixo. Ordem por viabilidade decrescente.
