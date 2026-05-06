# Manual de uso — Estudo Simples

> App de **repetição espaçada para concursos públicos**. Funciona offline (IndexedDB local) e sincroniza com a nuvem. Suporta objetivas, discursivas, cloze e flashcards.

Este documento é mantido junto com o código — sempre que algo muda, ele é atualizado.

---

## Sumário

1. [Modos de acesso](#1-modos-de-acesso)
2. [Painel (`/`)](#2-painel-)
3. [Banco de questões (`/banco`)](#3-banco-de-questoes-banco)
4. [Estudar — objetivas (`/estudar`)](#4-estudar--objetivas-estudar)
5. [Discursivas (`/discursivas`)](#5-discursivas-discursivas)
6. [Cards — cloze + flashcard (`/cards`)](#6-cards--cloze--flashcard-cards)
7. [Simulado (`/simulado`)](#7-simulado-simulado)
8. [Estatísticas (`/stats`)](#8-estatisticas-stats)
9. [Concursos (`/concursos`)](#9-concursos-concursos)
10. [Disciplinas e Tópicos](#10-disciplinas-e-topicos)
11. [Configurações (`/configuracoes`)](#11-configuracoes-configuracoes)
12. [Plataforma compartilhada (modo master)](#12-plataforma-compartilhada-modo-master)
13. [Atalhos de teclado](#13-atalhos-de-teclado)
14. [Planos](#14-planos)
15. [Páginas públicas e legais](#15-paginas-publicas-e-legais)
16. [Admin (operacional)](#16-admin-operacional)
17. [Notas de comercialização](#17-notas-de-comercializacao-vendas)
18. [Memorização — princípios usados](#18-memorizacao--principios-usados)

---

## 1. Modos de acesso

**Conta autenticada (email/senha)**: tudo é sincronizado entre dispositivos via Supabase. Cada usuário em sua própria instância (RLS).

**Visitante** (botão "Entrar como visitante" no /login): dados ficam só no navegador (IndexedDB), zero sync. Útil pra testar o app antes de criar conta. Ao clicar **"Criar conta"** durante o uso de visitante, você pode marcar **"Migrar minhas questões"** no signup — todas as questões adicionadas em modo visitante são re-tagueadas pra sua nova conta automaticamente.

> Login com conta existente **não migra** dados de visitante (proteção contra mistura acidental).

---

### Mobile (carro chefe)

App é mobile-first. Diferenças notáveis em telas até 760px:

- **Topbar mínima**: hamburger + logo + tema. Concurso, "Sair", "Criar conta" e info de usuário moveram pro **drawer do hamburger** (clica no ☰ → menu vertical com tabs + extras).
- **Bottom nav fixo**: 5 atalhos polegar-friendly (Painel · Banco · Estudar · Cards · Stats) com badge de pendências. Indicador visual abaixo da rota ativa.
- **🎯 FAB (botão flutuante)**: sobre a barra inferior, em qualquer rota fora de sessão. Vai direto pra `/estudar` com 10 questões SRS automáticas. Badge vermelho mostra qtd vencendo.
- **Pull-to-refresh** no `/banco`: arrasta pra baixo no topo da página → força sync manual.
- **Banco-item vertical** em mobile: checkbox + conteúdo em cima, ações em row no fim com border dashed separando. Texto preview com line-clamp generoso, chips arredondados, tap-target 40px+.
- **Alternativas tap-target generoso** (min 56px de altura) com letra circular maior, padding 14px e gap 10px. Layout otimizado pra centenas de questões sem fadiga.
- **Rate row sticky** no fundo da tela depois de responder — botões De novo / Difícil / Bom / Fácil sempre alcançáveis com o polegar, sem rolagem.
- **Confidence rating em 3 colunas** (33% cada, min 44px) também tap-friendly.
- **Wake Lock** durante sessões: tela não apaga em /estudar, /cards, /discursivas, /simulado (Android Chrome 90+, iOS 16.4+).
- **Haptic feedback**: vibração curta ao acertar, dois pulsos ao errar (Android — silencioso em iOS). Respeita `prefers-reduced-motion`.
- **Sem double-tap zoom**: `touch-action: manipulation` mata o atraso de 300ms; pinch-zoom segue funcionando pra acessibilidade.
- **Sem overflow horizontal**: `body { overflow-x: hidden }` impede que qualquer card largo crie scroll horizontal.
- **Service Worker** pra cache offline real (PWA): em produção, o app abre instantâneo da segunda vez e funciona sem internet pra rotas já visitadas. Atualizações puxadas automaticamente.
- **Web Share Target**: o Estudo Simples aparece como destino em "Compartilhar" do sistema. Se o user share um JSON de questões (ex: resposta de IA salva), o app abre `/share-target`, captura, e popula o paste do `/banco` direto.
- **Confetti** ao bater meta diária, recorde pessoal de revisões/dia, ou completar sessão de 5+ questões com 100% acerto. CSS-only, respeita `prefers-reduced-motion`.

### Acessibilidade

Em `/configuracoes` há seção dedicada:

- **Modo daltônico (CVD)**: 4 opções (Padrão · Deuteranopia · Protanopia · Tritanopia). Substitui paleta verde/vermelho por azul/laranja (deutan/protan) ou verde/magenta (tritan). Aplicado real-time em todo o app — feedback de acerto/erro fica discriminável.
- **Notificações** (opt-in): pede permissão e avisa quando há revisões vencendo. Cooldown 6h. Funciona apenas com a aba aberta (sem servidor externo). Botão "🔔 Ativar".
- **Reduced motion**: respeitado automaticamente — confetti, animações de cards, drawer slide-in e celebrações ficam off pra users com `prefers-reduced-motion: reduce`.
- **Voice search** no `/banco`: botão 🎤 ao lado do campo de busca usa Web Speech API (pt-BR). Funciona em Chrome/Edge/Safari. Útil pra busca hands-free.
- **Voice input** em `/discursivas`: botão 🎤 ao lado da textarea. Dita resposta em vez de digitar — útil pra treinar oralmente respostas longas.
- **Sons** (opt-in): som curto via Web Audio API ao acertar (dois tons ascendentes) e errar (tom baixo). Sem assets externos. Off por default.

### Tema

- **Auto** (segue OS), **Claro**, **Escuro**, **AMOLED** (preto puro — economia real de bateria em telas OLED de celulares).
- Toggle rápido no Topbar cicla entre os 4. Setting persiste em localStorage.

### Print

`@media print`: ao imprimir, esconde topbar, FAB, bottom nav, toasts e botões. Cards, alternativas (verde correta / vermelho errada) e feedback ficam estilizados pra papel. Útil pra material de estudo offline.

### Geração de questões com IA (`/banco`)

Botão **🤖 Gerar com IA** na aba Banco abre formulário com:

- Disciplina (obrigatório), tipo (objetiva/discursiva/cloze/flashcard), banca (opcional), tema (opcional), quantidade (1-50), dificuldade (1-5), observações.
- Gera prompt completo com **schema JSON do app embutido** (todas as regras: 5 alternativas, explicações por opção, formato exato).
- Botão "📋 Copiar" + links pra abrir Claude/ChatGPT/Gemini direto (copia prompt no clipboard ao clicar).
- Resposta da IA cola na área normal de import logo abaixo — wizard valida e dedupa antes de gravar.

Sem chave de API, sem custo: usa as IAs gratuitas que o user já tem.

### Insights pós-sessão

A tela de Summary depois de cada sessão (em `/estudar`) mostra:

- % acerto comparado à sua média histórica (delta em pp).
- Tempo médio por questão.
- Top 3 disciplinas estudadas + acerto por cada.
- Próximas vencendo até amanhã.
- Lista das questões erradas (link rápido pra revisar cada).
- **💡 Insights** — 1-3 observações automáticas baseadas na performance:
  - "Acima da média" / "Abaixo da média" com sugestão de ação
  - "Dominância" quando 95%+ em 8+ questões → sugere subir dificuldade
  - Tempo médio alto → sugere pausa
  - Sessão > 45min → sugere pomodoro
- Botões de ação: nova sessão · 🔁 repetir essas mesmas · ✗ repetir só erradas · continuar com vencendo.

Confetti automático se 100% acerto em pool de 5+ questões.

### Pomodoro (configurável)

Timer flutuante (canto inferior esquerdo). v2 com:

- **Foco / pausa curta / pausa longa** todos configuráveis (clica ⚙ pra ajustar). Defaults 25/5/15min.
- **Long break a cada N focos** (default 4). Ciclo automático: foco → pausa → foco → ... → após N, pausa longa → reset.
- **Skip** (⏭) pula pra próxima fase.
- **Barra de progresso** em baixo do timer.
- Persiste em localStorage — sobrevive a refresh.

---

## 2. Painel (`/`)

Dashboard inicial com um overview do estudo:

- **Stat cards** (topo): Total · Vencendo hoje · % Acerto · Streak (com 1 dia de freeze por semana, indicador 🧊).
- **Banner de modo visitante** (se aplicável): atalho pra criar conta com migração.
- **Countdown da prova**: aparece quando há concurso ativo com data definida. Mostra dias restantes, velocidade atual de estudo (rev/dia média), projeção de revisões até a prova, % do banco dominado, e mensagem motivacional ajustada conforme tempo restante.
- **Meta diária**: progresso de revisões hoje vs meta + tempo total estudado.
- **🎯 Missões diárias**: 3 quests rotativas derivadas do histórico do dia (meta · disciplinas variadas · acertar inimigas · novas · % acerto). Click vai pra rota relevante.
- **⚡ Novo recorde pessoal**: banner aparece quando hoje quebra o melhor dia anterior em revisões.
- **Conquistas**: chips com marcos atingidos (🔥 streak, 🎯 respondidas, 🏆 dominadas, 💎 % acerto, 📚 banco, ⚡ PR).
- **🎯 Hoje recomendado**: sessão sugerida misturando vencendo + erradas + novas. Atalho **P** começa direto.
- **Comece agora**: quick actions pra modos de estudo (vencendo, inimigas, novas, pendentes, **🎓 Revisão pré-prova** atalho R).
- **Atividade — últimos 90 dias**: heatmap GitHub-style, click no dia abre modal com detalhes (revisões + acerto + tempo, agrupado por disciplina).
- **📅 Plano da semana**: 7 colunas com quantidade vencendo/dia, cor escalonada relativa à meta diária.
- **⚔ Suas inimigas**: top 5 questões com pior acerto.
- **Previsão — próximos 30 dias**: gráfico de carga futura.
- **Por disciplina**: ranking com barras de % acerto + count vencendo + total.

---

## 3. Banco de questões (`/banco`)

Lista de todas as questões do usuário, com filtros, ordenações e ações em lote.

### Quick filter chips

Linha de chips no topo (atrasadas, hoje, novas, inimigas, dominadas) com counts. Click toggla o filtro.

### Filtros disponíveis

- **Busca** (`/`): texto livre. Prefixos suportados: `tag:foo`, `disc:bar`, `banca:FGV`, `due:7d` (vencendo em até N dias), `id:xxx` (id ou prefixo).
- **Disciplina, Tipo, Origem, Verificação**: selects.
- **SRS**: atrasadas / hoje / novas / sem estudo / recentes / dominadas / inimigas.
- **Imagem · Notas · Mnemônico · LaTeX**: com / sem.
- **Tempo de revisão**: hoje / ontem / semana / nunca.
- **Favoritos** (★).

Filtros persistem via URL params (`?search=...&srs=inimigas`) e podem ser salvos como **presets** nomeados.

### Ordenações

Recente, antiga, atualizada, vencendo primeiro, mais estudadas, menor % acerto, mais difíceis, **mais negligenciadas** (menor lastReviewed).

### Ações em massa (depois de selecionar)

- Marcar verificação (verificada / pendente / duvidosa)
- Setar dificuldade (1–5)
- Adicionar / remover tags (com autocomplete)
- Atribuir tópico
- Vincular concurso
- 🌐 Marcar como plataforma / 🚫 Tirar
- 🧹 Limpar histórico SRS (zera SRS+stats)
- ▶ Estudar selecionadas / filtradas
- 📥 Exportar JSON ou CSV
- 📖 Modo leitura (browse passivo, não afeta SRS)
- Excluir

### Atalhos no /banco

- `j/k` ou ↑/↓: navegar item
- `g/G`: primeiro/último
- `Enter`: editar item focado
- `Espaço`: marcar/desmarcar checkbox
- `x` ou `Delete`: excluir focado
- `F`: marcar/desmarcar favorito
- `V`: alternar verificação
- `R`: estudar 1 questão random do filtro
- `1–5`: setar dificuldade
- `Esc`: remove foco

### Indicadores nos itens

Verificação (✅/⏳/⚠️) · 📝 notas · 🧠 mnemônico · 🖼 imagem · 𝓛 LaTeX · 🏆 dominada · ⚔ inimiga · 💤 tempo morto (>30d sem revisão) · ✨ recém-importada (<24h) · ✨ nova / 📖 aprendendo / 🌱 jovem / 🌳 madura (fase SRS) · ⏱ tempo médio · % acerto · mini-spark.

---

## 4. Estudar — objetivas (`/estudar`)

Sessão de prática de questões objetivas.

### Configuração de sessão

- **Disciplinas**: multi-select (filtra pool).
- **Quantidade** + **Modo**:
  - SRS (prioriza vencidas)
  - Aleatório
  - Por dificuldade (mais difíceis primeiro)
  - Erros (últimas 5 com erro)
  - Inimigas (≥3 tentativas, <30%)
  - Novas (nunca vistas)
  - 🎓 **Revisão pré-prova**: mistura SRS + inimigas + recém-aprendidas + variadas
- **Tempo por questão** (s, 0 = sem limite)
- **Faixa de dificuldade** (mín/máx)
- **Embaralhar alternativas**
- **Interleaving** (intercala disciplinas)
- **Modo livre** (stats contam, SRS não muda — útil pra revisão pré-prova)
- 🧠 **Active recall** (esconde alternativas até revelar — força lembrar antes de ver opções)
- 🔁 **Re-injetar erradas no fim da sessão** (Anki-like learning steps)

Configuração é persistida entre sessões.

### Durante a sessão

- Banner de histórico ("X/Y acertos no histórico").
- Confidence rating opcional (🤔 chutei / 😐 incerto / 💪 confiante) — calibra metacognição em /stats.
- Nota inline (ahá-momento): captura insight no exato momento da revelação.
- Após responder: explicação + alternativa correta + mnemônico (se houver).
- **Em caso de erro**: aparece um picker rápido pra marcar a *causa* do erro (🧠 não sabia, 🤦 atenção, 📖 leitura, ⏱ tempo, 🎩 pegadinha). Anota no histórico — agregado depois em /stats com tip por categoria.
- Rate buttons mostram **preview do próximo intervalo SRS** (1d, 6d, 2mo). Cap por **exam date**: se há concurso ativo com data_prova e o intervalo passaria a prova, é capado pra `data_prova - 1d` (não agenda revisão pra depois da prova).
- **Cognitive load mix**: pool nunca tem 3+ questões dificuldade≥4 consecutivas (exceto modo "dificuldade" explícito). Reordena automaticamente pra intercalar fácil/médio/difícil.

### Atalhos /estudar

- `A–E`: marcar alternativa
- `Espaço/Enter`: revelar (em active recall)
- `Tab`: pular (skip soft, não conta)
- `1`: De novo (q=0) · `2`: Difícil · `3` ou Enter: Bom · `4`: Fácil
- `Shift+1–5`: setar dificuldade da questão pós-resposta
- `Z`: desfazer última rate (até 6s)
- `F`: modo foco (esconde topbar)

### Summary da sessão

% acerto, tempo, comparativo com média histórica, top 3 disciplinas, próximas vencendo, lista das erradas com link rápido pra cada, botões: nova sessão / 🔁 repetir essas mesmas / ✗ repetir só erradas / continuar com vencendo.

Cada sessão concluída é registrada em **Histórico de sessões** (visível em /stats).

---

## 5. Discursivas (`/discursivas`)

Sessão de questões dissertativas com auto-avaliação por rubrica.

- Texto digitado é **auto-salvo localmente** (rascunho) por questão. Reaproveita ao voltar.
- Após escrever sua resposta, clica "Revelar espelho" pra ver a resposta-modelo + rubrica.
- Auto-avaliação por quesito (slider de pontos).
- Rate 1–4 igual /estudar (usa SRS-FSRS — quality derivada do score).
- `Z` desfaz última rate.

---

## 6. Cards — cloze + flashcard (`/cards`)

### Cloze

Texto com lacunas `{{c1::resposta}}`. Revele uma de cada vez (Espaço/Enter). Conta de lacunas reveladas exibida.

### Flashcard

Frente/verso. Vira pra ver o verso.

### Comum aos dois

- Confidence rating opcional antes de revelar.
- Hint discreto: "💡 Pense na resposta antes de revelar — fortalece memorização".
- Após revelar: explicação + mnemônico.
- Rate 1–4 com preview de intervalo SRS.
- Z desfaz última rate.
- Tab pula card.
- Esc sai da sessão.

---

## 7. Simulado (`/simulado`)

Simulação de prova com cronômetro setável e relatório completo.

- Cronômetro com diálogo de "tempo extra" se acabar.
- Pode pausar/retomar (refresh-safe).
- M marca/desmarca questões pra revisar.
- A–E marcam alternativa.
- ←/→ navega entre questões.
- Relatório final: % acerto, tempo, breakdown por disciplina + dificuldade, integração com SRS opcional, comparativo com simulados anteriores (sparkline em /stats).

Histórico de simulados visível em /stats com link "Ver relatório".

---

### Conquistas (`/conquistas`)

Página dedicada com **todas as conquistas** agrupadas por categoria:
- 🔥 Streak (3 / 7 / 14 / 30 / 60 / 90 / 180 / 365 dias)
- 🎯 Esforço (50 → 10.000 respondidas)
- 🏆 Dominadas (10 → 1.000 questões com 5+ acertos seguidos)
- 💎 Qualidade (60 / 70 / 80 / 90% acerto, mín 100 tentativas)
- 📚 Banco (50 → 5.000 questões cadastradas)
- ⚡ Recordes (10 / 25 / 50 / 100 / 200 num único dia)
- 📅 Consistência (7 → 365 dias estudados total)

Cada tier mostra emoji desbloqueado ou 🔒 com "faltam X". Barra de progresso geral no topo. Confetti automático quando bate streak novo (3/7/14/30...).

## 8. Estatísticas (`/stats`)

Selector de escopo no topo: **Geral** / **Concurso ativo** / **qualquer concurso específico**.

Botão **📥 Exportar CSV** com 3 modos: questões agregadas, disciplinas agregadas, histórico cru de revisões.

### Seções

- **Predição de nota** (com concurso ativo) — combina taxa de acerto × qtd_questoes_prova vinculada
- **📊 Por período**: snapshot 7d / 30d / total (revisões + % acerto + dias estudados)
- **📅 Por dia da semana**: distribuição com bar chart e % acerto
- **📜 Últimas sessões**: lista das 10 mais recentes (kind + tempo + % acerto)
- **Esta semana vs anterior**
- **Hora do dia** mais produtiva
- **Progressão temporal** (30 dias, com média móvel 7d)
- **Tempo médio por disciplina**
- **Distribuição de dificuldade**
- **⚔ Inimigas** (taxa <30% com ≥3 tentativas)
- **Aprendizado**: dominadas (5+ acertos seguidos) + consolidando
- **Carga próxima** (30 dias)
- **🚨 Tags com pior desempenho** (top 5 com ≥10 tentativas)
- **Tags / Bancas / Origem / Concursos**: distribuição
- **Calibração metacognitiva** (overconfidence/underconfidence baseada em confidence rating)
- **Causas dos seus erros** (🧠 não sabia / 🤦 atenção / 📖 leitura / ⏱ tempo / 🎩 pegadinha) — distribuição agregada com tip de ação por categoria
- **⚡ Níveis por disciplina** — XP por disciplina (acerto +10, sequência +12, self-pass +8) com barra de progresso até o próximo nível e badge colorido. Top 12 mostradas. Pura derivação do histórico, sem schema novo
- **📉 Curva de retenção** — gráfico SVG mostrando R(t) = 0.9^(t/S) onde S é a stability média estimada das suas questões consolidadas. Compara com curva de Ebbinghaus (esquecimento sem revisão). Educa sobre o valor do SRS
- **Simulados**: agregado + sparkline
- **Desempenho por disciplina**

---

## 9. Concursos (`/concursos`)

Cadastro do concurso que você está estudando: banca, órgão, cargo, **data da prova** (gera countdown), status. Cards expandíveis pra vincular disciplinas com peso e qtd de questões esperadas.

A data da prova é o que aciona o **countdown rico** no Painel (com motivação e projeções).

Selecione um concurso como **ativo** no Topbar pra filtrar todas as listagens (banco, estudar, simulado, etc.) só pelas disciplinas vinculadas a ele.

---

## 10. Disciplinas e Tópicos

**Disciplinas** (`/disciplinas`): lista read-only de disciplinas detectadas (auto-derivadas das questões). Você só edita metadata (cor + peso default).

**Tópicos** (`/topicos`): hierarquia em árvore (auto-FK pra parent). Em revisão de UX — escondido da nav principal.

---

## 11. Configurações (`/configuracoes`)

- **Assinatura**: mostra plano atual (Grátis ou ✨ Pro) com status. Pro: botão "⚙ Gerenciar assinatura" abre o Stripe Customer Portal pra cancelar, atualizar cartão, baixar faturas. Free: "Upgrade pro Pro →" leva pra /planos.
- **Algoritmo SRS**: SM-2 (default) ou FSRS-6 (opt-in). Coexistem sem perda de dados.
- **Meta diária** (revisões/dia).
- **Tema**: auto / claro / escuro.
- **📦 Plataforma**: recarregar seed do master (visitantes/contas novas recebem auto). Botões pra limpar histórico de sessões e limpar todo o cache local.
- **📊 Uso de armazenamento**: questões + IDB usage (estimate) com warning quando >80%.
- **Backup completo**: download/import (questões + hierarquia + simulados + settings).
- **Cadastros**: links pra Concursos, Disciplinas.
- **Sobre o app**: versão, referências, links pra `/manual`, `/privacidade`, `/termos`.
- **Zona de risco**: 🗑 Excluir minha conta permanentemente — apaga tudo (questões, histórico, perfil), cancela assinatura Pro automaticamente. LGPD art. 18. Confirmação dupla (dialog + digitar e-mail).

---

## 12. Plataforma compartilhada (modo master)

Sua conta pode atuar como "master" da plataforma — questões com a tag `platform` viram base pra visitantes e contas novas, sem afetar seu fluxo pessoal.

### Workflow

1. **Marca questões com tag `platform`** no /banco (pode ser bulk).
2. **Roda export local**:

   ```powershell
   $env:NEXT_PUBLIC_SUPABASE_URL = "..."
   $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "..."
   $env:SUPABASE_EMAIL = "..."
   $env:SUPABASE_PASSWORD = "..."
   npm run export:platform
   ```

   Script lê do Supabase, descarta dados pessoais, escreve em `public/platform-questions.json`.

3. **Commit + push**: Vercel re-deploya.

Visitantes e contas novas com banco vazio carregam o seed automaticamente — clones com IDs novos, SRS zerado, atrelados ao próprio user. Cada usuário tem cópia independente.

> Tag duplicada não dá problema (dedupe case-insensitive). Não taggear = privado.

---

## 13. Atalhos de teclado

Pressione `?` em qualquer página pra abrir a lista completa.

### Globais

- `Ctrl+K` ou `Ctrl+P`: command palette
- `Ctrl+I` ou `Ctrl+B`: vai pra /banco
- `Ctrl+E`: vai pra /estudar
- `Ctrl+F`: busca global em todas as questões
- `Ctrl+Shift+L`: cicla tema
- `?`: ajuda
- **Vim-jump**: `g` seguido de letra: `h` painel, `b` banco, `e` estudar, `c` cards, `d` discursivas, `s` stats, `m` simulado, `k` concursos, `o` opções

### Painel

- `P`: começa sessão recomendada
- `R`: revisão pré-prova (30 questões variadas)

### Detalhes em cada rota: ver seções acima.

---

### Trial gratuito de 14 dias

Primeiro checkout do usuário inclui automaticamente 14 dias grátis (sem cobrança no Stripe). Acesso total ao Pro durante o trial. Cobrança só começa após o fim, e usuário pode cancelar a qualquer momento. Status `trialing` mostrado em /configuracoes com data de término.

Stripe gerencia: usuário não pode iniciar trial duas vezes (rastreado pelo customer_id). Ao recadastrar com mesmo email, trial é negado.

## 14. Planos

| Feature | Grátis | 🎓 Estudante | ✨ Pro |
|---|---|---|---|
| Questões pessoais | 200 | 2.000 | Ilimitado |
| Concursos ativos | 1 | 3 | Ilimitado |
| SRS (SM-2 + FSRS-6) | ✓ | ✓ | ✓ |
| Active recall, simulado, cards | ✓ | ✓ | ✓ |
| Predição de nota por concurso | — | ✓ | ✓ |
| Calibração metacognitiva | — | ✓ | ✓ |
| Export CSV | — | ✓ | ✓ |
| Imagens em questões | — | — | ✓ |
| Mnemônicos | — | — | ✓ |
| Suporte prioritário | — | — | ✓ |
| Acesso antecipado a novidades | — | — | ✓ |
| Preço mensal | R$ 0 | R$ 9,90 | R$ 19,90 |
| Preço anual | — | R$ 89 (25% off) | R$ 179 (25% off) |

**Limite enforçado no banco**: trigger PostgreSQL rejeita INSERT acima do limite free. Não há como bypass via devtools, curl direto, ou outras vias.

**Pagamento**: Stripe Checkout (não armazenamos dados de cartão). Cancela a qualquer momento pelo Customer Portal em /configuracoes.

Detalhes de configuração admin: ver `docs/BILLING_SETUP.md` no repo.

---

## 15. Páginas públicas e legais

Acessíveis sem login (e indexáveis por busca):

- **`/inicio`** — landing page com hero, trust strip, features, comparison vs Anki/QConcursos, social proof (testimonials), pricing teaser dos 3 planos, newsletter capture, FAQ.
- **`/planos`** — comparativo dos 3 planos (Grátis · Estudante R$ 9,90/mês · Pro R$ 19,90/mês) com toggle mensal/anual e Checkout. 14 dias de trial nos planos pagos sem cartão.
- **`/sobre`** — story, princípios, posicionamento. Conexão emocional pra conversão.
- **`/roadmap`** — pronto / em construção / próximo / considerando / não-planejado. Transparência.
- **`/concursos-populares`** — índice por banca (FGV, Cebraspe, FCC, IBFC) com SEO long-tail.
- **`/concursos-populares/[slug]`** — landing dedicada por banca: estilo, concursos típicos, dicas pra usar o app.
- **`/manual`** — este documento.
- **`/privacidade`** — Política de Privacidade (LGPD).
- **`/termos`** — Termos de Uso.
- **`/contato`** — canais de suporte (LGPD, billing, bug, feedback) com prefixos no assunto pra triagem.

Erros e roteamento:

- **`/sitemap.xml`** + **`/robots.txt`** gerados automaticamente. Crawlers indexam só rotas públicas.
- **404** — página customizada `/_not-found` com atalhos pras rotas principais.
- **Erro inesperado** — `error.tsx` (boundary do segmento root) e `global-error.tsx` (boundary global, fora do layout). Mostram refs anônimas pro user copiar ao reportar.

Todas têm o `PublicHeader` (logo sticky no topo + nav: Planos · Sobre · Bancas · Manual · Entrar · Começar) e o `PublicFooter` com links pra navegar entre elas. A logo do header é clicável pra voltar pro `/inicio` de qualquer página pública.

## 16. Admin (operacional)

Rota `/admin` protegida por env var `ADMIN_USER_IDS` (lista UUIDs separados por vírgula). Não-admin é redirecionado pra `/`. Mostra:

- Usuários totais, Pro ativos, em trial, cancelados, past-due
- Signups últimos 30 dias
- Questões ativas (todas contas)
- Eventos de analytics últimos 30 dias
- MRR/ARR estimados, conversão (pro + trial / totais)

Queries via service role (bypass RLS) — só agregações, sem dados de usuário individual.

### Analytics de uso

Tabela `analytics_events` recebe eventos privacy-first (sem PII, sem IP, sem fingerprinting). Eventos atualmente trackados: `checkout.started` (com props.interval). Mais eventos podem ser adicionados via `track('event.name', { ...props })` em qualquer client component.

### Newsletter / lead capture

Tabela `newsletter_signups` recebe leads que ainda não viraram conta — útil pra nurture com novidades. RLS bloqueia leitura (só admin via service role). Endpoint público `POST /api/newsletter` com CSRF check, rate limit, validação de email, gera token de unsubscribe (não enviado por email ainda — fase futura).

Form na landing em `/inicio` (seção pré-FAQ).

Visualização atual: contagem total agregada em /admin. Pra dashboards mais ricos, exporte da tabela via service role.

## 17. Notas de comercialização (vendas)

Estratégia atual baseada em best practices de SaaS B2C educacional:

### Funil

1. **Tráfego** ← SEO (sitemap + robots + páginas estáticas /inicio, /sobre, /roadmap, /concursos-populares/[banca]), Open Graph (compartilhamento social bonito), JSON-LD (rich snippets Google).
2. **Lead capture** ← newsletter form em `/inicio` (sem login), modo visitante sem cadastro, signup grátis sem cartão.
3. **Activation** ← seed de plataforma carrega no primeiro acesso, OnboardingTour (com delay anti-flicker), 14 dias de Pro grátis no primeiro checkout.
4. **Conversion** ← pricing comparativo, trust strip (Stripe + LGPD), comparison vs alternativas, testimonials (placeholder enquanto coleta), CTA único e claro.
5. **Retention** ← streak gamificado + freeze, achievements, daily goal, predição de nota, pause-suggestion após 30min.
6. **Recovery** ← rate limit alto na cobrança falha, status `past_due` mantém acesso (grace period Stripe), Customer Portal pra atualizar cartão sem fricção.

### Diferenciais comunicáveis

- **Foco brasileiro**: integração com bancas (FGV, Cebraspe, FCC, IBFC) e predição de nota por concurso. Anki não tem.
- **Tudo no mesmo lugar**: objetivas, discursivas, cloze, flashcards, simulado. Não precisa juntar 3 ferramentas.
- **Funciona offline**: IDB + sync. Estudo no transporte, em local sem rede, etc.
- **Privacy-first + LGPD**: backup completo qualquer hora, deletar conta em 1 clique.
- **Algoritmos modernos**: SM-2 e FSRS-6 lado a lado, user escolhe.

### Trust signals

- Stripe como processador (PCI-DSS Nível 1) — nunca armazenamos cartão.
- LGPD compliant + página /privacidade transparente.
- Cancela quando quiser, sem letras miúdas.
- 14 dias trial sem cartão (zero risk pra começar).
- 7 dias money-back garantido pelo CDC + Termos.

### Próximos passos sugeridos

Pra escalar (no backlog):
- Trial reminders por email (precisa provider Resend/SendGrid)
- Welcome email + onboarding sequence
- Email de abandoned checkout
- Programa de referral (1 mês grátis pra cada amigo que assinar)
- Conteúdo SEO: blog com posts por banca, dicas de estudo, etc.
- Reviews collected (Trustpilot/G2 widget)
- Comparison page comparando direto com QConcursos premium / Anki Pro
- "Histórias de aprovação" — usuários que passaram contando experiência

Não fazer (decisão de produto):
- Anúncios in-app
- Notificações push agressivas
- Engagement hacks (streak forçada que pune)
- Vendas de dados pra terceiros
- Telemetria com fingerprinting

## 18. Memorização — princípios usados

O app é construído sobre evidências da ciência cognitiva:

- **Spaced repetition** (Ebbinghaus, Pimsleur): SM-2 e FSRS-6 calculam intervalos otimizados pra que cada questão seja revista pouco antes de ser esquecida.
- **Active recall** (Roediger & Karpicke 2006): toggle que esconde alternativas força tentar lembrar antes de ver opções — efeito muito mais forte que reler.
- **Interleaving** (Rohrer 2012): toggle que distribui disciplinas pelo pool em vez de blocos do mesmo assunto.
- **Self-explanation**: NoteInline aparece pós-resposta, prompt "por que errei?" — elaboração consolida.
- **Confidence calibration**: rating 1-3 antes de responder + visualização de calibração em /stats.
- **Distributed practice / streak**: meta diária + streak (com 1 freeze por semana) reforçam consistência.
- **Retrieval with feedback**: feedback imediato pós-resposta (gabarito + explicação + mnemônico) maximiza fixação.
- **Mnemonics**: campo opcional `payload.mnemonic` mostrado no feedback de errar — ROOM pra Recursos Operacionais Oriundos do Mercado, etc.
