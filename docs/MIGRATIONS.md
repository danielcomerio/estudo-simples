# Migrations — guia operacional

Como criar, aplicar e reverter migrations no Estudo Simples.

## Convenção

- Localização: `supabase/migrations/`
- Nome: `NNNN_descrição.sql` + `NNNN_descrição_down.sql` (par)
- Numeração: sequencial, 4 dígitos, sem pular.
- Sempre **idempotente** (`CREATE TABLE IF NOT EXISTS`, `DROP IF EXISTS`).
- Sempre **transacional** (`BEGIN; ... COMMIT;`).

## Próxima migration

A "próxima migration" é tracking manual no `CLAUDE.md`. Atualmente
**0017** (após 0016_count_due_rpc).

Antes de codar nova:
```bash
ls supabase/migrations/ | sort | tail -3
```

## Como criar

1. **Criar dois arquivos** (`up` e `down`):
   ```bash
   touch supabase/migrations/0017_minha_feature.sql
   touch supabase/migrations/0017_minha_feature_down.sql
   ```

2. **Header obrigatório** no `up`:
   ```sql
   -- =====================================================================
   -- Migration 0017 — descrição curta
   -- =====================================================================
   -- Por que: motivação concreta (problema real ou feature concreta).
   -- Idempotente. Aditiva (ou: backwards-incompatible — se for o caso).
   --
   -- Dependências: lista migrations anteriores que precisam estar
   -- aplicadas (ex: depende de 0010 disciplina_uuid existir).
   ```

3. **`down` mínimo**:
   ```sql
   begin;
   -- reverter aqui (drop coluna, drop tabela, etc)
   commit;
   ```

4. Se a migration toca `questions` (adiciona coluna):
   - **OBRIGATÓRIO** atualizar `lib/sync.ts` `questionToRow` E
     `rowToQuestion` na MESMA PR. **Gotcha #13** — sem isso, push
     apaga e pull ignora silenciosamente. Já queimou 3 vezes.

5. Se a migration adiciona FK composta apontando pra `questions`:
   - Confira que `questions` tem `UNIQUE (id, user_id)` — adicionado
     pela 0014. Sem isso, FK composta rejeita com erro 42830.

6. Se a migration adiciona FK composta apontando pra outras tabelas
   da hierarquia (`concursos`, `disciplinas`, `topicos`):
   - Esses já têm `UNIQUE (id, user_id)` desde 0002.

## Como aplicar

1. **Local** (rodar manualmente em desenvolvimento):
   - Supabase Dashboard → SQL Editor.
   - Cola conteúdo do arquivo `up`.
   - Roda.
   - Verifica resultado (NOTICE no log se a migration tem RAISE).

2. **Produção**:
   - Mesma coisa, mas depois de validar em staging.
   - Idealmente fora de horário de pico.
   - Sempre **fazer backup do banco antes** se a migration é
     destrutiva (drop, alter constraint).

3. **Após aplicar**, atualiza checklist no `CLAUDE.md`:
   - Atualizar "Próxima migration deve ser NNNN+1".
   - Adicionar entrada na seção "Migrations 0005-NNNN" descrevendo
     o que foi feito.

## Como reverter

1. Idealmente **só durante desenvolvimento** ou se a migration
   recém-aplicada quebrou produção.
2. Aplicar o `_down.sql` correspondente no SQL Editor.
3. Em casos destrutivos (drop tabela), **fazer backup** dos dados
   primeiro:
   ```sql
   COPY (SELECT * FROM tabela) TO '/tmp/backup.csv' WITH CSV HEADER;
   ```
4. Documentar no commit message **por que** foi revertida.

## Gotchas conhecidos

### #13 — questionToRow / rowToQuestion
Coluna nova em `questions` que esquece de atualizar essas duas
funções de mapping. Resultado:
- Push: rows enviadas SEM o campo novo → server interpreta como null
  → backend pode rejeitar ou apagar dado.
- Pull: rows recebidas com o campo são ignoradas → estado local diverge.

Mitigação: PR review checa se `lib/sync.ts` foi tocado quando a
migration adiciona coluna em `questions`.

### #15 — FK composta UNIQUE
PostgreSQL exige UNIQUE constraint EXATA sobre as colunas
referenciadas pra FK composta funcionar. PRIMARY KEY (id) NÃO conta
pra `(id, user_id)`. Adicionar UNIQUE explícito.

### #21 — Aplicação manual
Migrations não rodam automaticamente — Supabase não tem o conceito de
"migrate up". Rodar manualmente.

Sintoma de esquecer: erro `column "X" does not exist in schema cache`
no push. Verificar:
```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='X';
```

Se a coluna existe mas erro persiste, force refresh do PostgREST:
```sql
NOTIFY pgrst, 'reload schema';
```

## Checklist pré-PR

- [ ] Arquivo `up` + `down` criados
- [ ] Header com motivação clara
- [ ] Idempotente (`IF NOT EXISTS`, `IF EXISTS`)
- [ ] Transacional (`BEGIN; COMMIT;`)
- [ ] Se toca `questions`: `lib/sync.ts` atualizado também
- [ ] Se adiciona FK composta: confirmou que parent tem UNIQUE composto
- [ ] Aplicado em staging primeiro
- [ ] `CLAUDE.md` atualizado (próxima migration + descrição na lista)

## Histórico

Ver `CLAUDE.md` seção "Migrations 0005–N" pro one-liner de cada
migration aplicada. Decisões de design ficam nos commits e nesse
documento.
