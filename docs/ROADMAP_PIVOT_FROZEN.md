# Roadmap PIVOT — CONGELADO

> ⚠️ **NÃO EXECUTE NADA DESTE ARQUIVO sem pedido EXPLÍCITO do owner.**
>
> Estas tasks só fazem sentido **se o app pivotar** de "plataforma de concurso/SRS"
> para "Study OS genérico" (Notion-meets-Anki). É decisão de positioning, não
> incremento. Risco de over-engineering, refactor profundo, perda de foco.

---

## Decisão de pivot

Critérios pra acionar essa stack:
- Owner declara explicitamente "vamos pivotar pra study OS"
- Validação de mercado: pelo menos 100 users pedindo features fora-de-concurso
- Capital/tempo pra 6-12 meses de refactor antes de monetizar verticais novas
- Aceitar perder o nicho deep-concurso atual

Enquanto nenhuma das condições acima for verdade, **não tocar**.

---

## Tasks congeladas

### Abstração genérica de contextos
- [ ] **P1** `study_contexts` table — tipos: concurso, faculdade, enem, idioma, certificação, custom
- [ ] **P2** UI seletor de contexto no Topbar (substitui ConcursoSelector)
- [ ] **P3** Personas/agentes IA não-vinculadas a concurso

### Agenda genérica
- [ ] **P4** Calendar view multi-contexto (semana/mês)
- [ ] **P5** Reminder scheduler genérico (qualquer tipo de evento)

### Sharing pivot-dependente
- [ ] **P6** Compartilhar contexto inteiro / agenda inteira
- [ ] **P7** Modo "professor → N alunos" (escolar/grupo) com gestão de contextos

### Workflows/automação
- [ ] **P8** Workflows ("se completar X, fazer Y") — feature de OS de produtividade

### Anexos / files
- [ ] **P9** Upload de PDF/imagem por contexto + IA lê
- [ ] **P10** Tela compartilhada / monitoring ao vivo (token-heavy)

### Voice / vertical multimodal
- [ ] **P11** Voice input pra qualquer questão (não só discursiva)

### Plataforma EAD
- [ ] **P12** Cursos/aulas dentro do app

---

## Por que cada uma é PIVOT (não CORE)

| Task | Razão |
|---|---|
| P1, P2 | Refactor de schema profundo. `concursos` deixa de ser cidadão de primeira classe. |
| P3 | "Prof. Cálculo I" é faculdade, não concurso. |
| P4, P5 | Compete com Notion/Google Calendar — sem moat. |
| P6, P7 | Dependem de P1; sem ele não fazem sentido. |
| P8 | Feature de produtividade (Zapier-like) — fora do escopo educacional. |
| P9, P10 | Compete com NotebookLM/Mem; custo alto. |
| P11 | Voice em discursiva já cobre o caso real. Generalizar é nicho. |
| P12 | Vira EAD — mercado totalmente diferente. |

---

## Como ativar

Owner deve, ao pedir alguma destas tasks:
1. Confirmar a decisão de pivot (writing).
2. Mover a task pro `ROADMAP_CURRENT.md`.
3. Adicionar contexto/justificativa.

Sem esse processo, Claude/agente NÃO deve executar.
