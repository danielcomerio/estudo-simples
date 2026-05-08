# Próxima migration: 0032

A próxima migration nova **DEVE** ser numerada `0032_*.sql` (e
`0032_*_down.sql` correspondente).

## Checklist obrigatório pra cada migration nova

1. **Nome descritivo**: `NNNN_<noun>_<verb>.sql`
   - Bom: `0032_questions_add_soma_type.sql`
   - Ruim: `0032_misc.sql`

2. **Down migration na mesma PR** (`NNNN_*_down.sql`)
   - Reversível ou explicar por que não é (`-- IRREVERSIBLE: ...`).

3. **Idempotente** (use `IF NOT EXISTS`, `ON CONFLICT`, etc).

4. **Termina com applied_migrations insert**:
   ```sql
   insert into public.applied_migrations (id, applied_at)
   values ('0032', now())
   on conflict (id) do update set applied_at = excluded.applied_at;
   ```

5. **Atualizar `questionToRow` / `rowToQuestion` em `lib/sync.ts`** se
   adicionar colunas novas em `questions` (Gotcha #13 do CLAUDE.md).

6. **Testar localmente** antes do push:
   ```bash
   npm run check:migrations
   ```

7. **USER ACTION**: aplicar manualmente no Supabase Dashboard SQL editor
   (não há auto-apply via CI). Adicionar instruções específicas no
   topo da migration se exigir setup manual (ex: bucket Storage).

## Features pendentes que podem motivar 0032

- **T27 — Tipo "soma"** (UFRGS): atualizar CHECK de `questions.type` pra
  aceitar `'soma'` + criar tipo `SomaPayload` em `lib/types.ts`.
- **T111 — Webhooks Slack**: criar tabela `slack_webhooks` (mesmo
  pattern de `discord_webhooks` da 0022).
- **T55 — Welcome email**: trigger pós-signup ou tabela
  `welcome_emails_sent` (rastreio).
