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
14. [Memorização — princípios usados](#14-memorizacao--principios-usados)

---

## 1. Modos de acesso

**Conta autenticada (email/senha)**: tudo é sincronizado entre dispositivos via Supabase. Cada usuário em sua própria instância (RLS).

**Visitante** (botão "Entrar como visitante" no /login): dados ficam só no navegador (IndexedDB), zero sync. Útil pra testar o app antes de criar conta. Ao clicar **"Criar conta"** durante o uso de visitante, você pode marcar **"Migrar minhas questões"** no signup — todas as questões adicionadas em modo visitante são re-tagueadas pra sua nova conta automaticamente.

> Login com conta existente **não migra** dados de visitante (proteção contra mistura acidental).

---

## 2. Painel (`/`)

Dashboard inicial com um overview do estudo:

- **Stat cards** (topo): Total · Vencendo hoje · % Acerto · Streak (com 1 dia de freeze por semana, indicador 🧊).
- **Banner de modo visitante** (se aplicável): atalho pra criar conta com migração.
- **Countdown da prova**: aparece quando há concurso ativo com data definida. Mostra dias restantes, velocidade atual de estudo (rev/dia média), projeção de revisões até a prova, % do banco dominado, e mensagem motivacional ajustada conforme tempo restante.
- **Meta diária**: progresso de revisões hoje vs meta + tempo total estudado.
- **Conquistas**: chips com marcos atingidos (🔥 streak, 🎯 respondidas, 🏆 dominadas, 💎 % acerto, 📚 banco).
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
- Rate buttons mostram **preview do próximo intervalo SRS** (1d, 6d, 2mo).

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

- **Algoritmo SRS**: SM-2 (default) ou FSRS-6 (opt-in). Coexistem sem perda de dados.
- **Meta diária** (revisões/dia).
- **Tema**: auto / claro / escuro.
- **📦 Plataforma**: recarregar seed do master (visitantes/contas novas recebem auto). Botões pra limpar histórico de sessões e limpar todo o cache local.
- **📊 Uso de armazenamento**: questões + IDB usage (estimate) com warning quando >80%.
- **Backup completo**: download/import (questões + hierarquia + simulados + settings).
- **Cadastros**: links pra Concursos, Disciplinas.
- **Sobre o app**: versão e referências.

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

## 14. Memorização — princípios usados

O app é construído sobre evidências da ciência cognitiva:

- **Spaced repetition** (Ebbinghaus, Pimsleur): SM-2 e FSRS-6 calculam intervalos otimizados pra que cada questão seja revista pouco antes de ser esquecida.
- **Active recall** (Roediger & Karpicke 2006): toggle que esconde alternativas força tentar lembrar antes de ver opções — efeito muito mais forte que reler.
- **Interleaving** (Rohrer 2012): toggle que distribui disciplinas pelo pool em vez de blocos do mesmo assunto.
- **Self-explanation**: NoteInline aparece pós-resposta, prompt "por que errei?" — elaboração consolida.
- **Confidence calibration**: rating 1-3 antes de responder + visualização de calibração em /stats.
- **Distributed practice / streak**: meta diária + streak (com 1 freeze por semana) reforçam consistência.
- **Retrieval with feedback**: feedback imediato pós-resposta (gabarito + explicação + mnemônico) maximiza fixação.
- **Mnemonics**: campo opcional `payload.mnemonic` mostrado no feedback de errar — ROOM pra Recursos Operacionais Oriundos do Mercado, etc.
