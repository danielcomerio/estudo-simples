# Rollback — guia rápido

Como reverter mudanças do projeto em 3 cenários, do mais simples ao
catastrófico. **Provavelmente você só vai precisar do Cenário 1.**

---

## Cenário 1 — "Mudei de ideia" (95% dos casos)

**Quando:** você experimentou algo num branch (ex: `pivot-study-os`) e
quer voltar pro estado de produção.

**Pré-requisito:** as mudanças que você fez foram **aditivas** (sem
DROP/RENAME) — regra documentada em [`PIVOT_RULES.md`](PIVOT_RULES.md)
quando aplicável.

```powershell
git checkout main
```

**Pronto.** Production na Vercel já está em `main`, nada muda.

**Tabelas novas no Supabase ficam órfãs** (vazias e não-referenciadas
pelo código de `main`). Não causam problema. Pode deletar com:

```sql
-- Roda só se quiser limpeza, opcional
DROP TABLE IF EXISTS nome_da_tabela_nova CASCADE;
```

Se também quer apagar o branch de exploração:

```powershell
git branch -D pivot-study-os                    # local
git push origin --delete pivot-study-os         # remoto
```

---

## Cenário 2 — "Sujei dados por engano" (raro)

**Quando:** durante exploração, você inseriu/modificou dados reais por
engano (ex: criou questão de teste no production).

**Solução cirúrgica** — não precisa restore inteiro.

```powershell
git checkout main
```

E no Supabase Dashboard SQL Editor:

```sql
-- Exemplos — adapte ao caso:
DELETE FROM questions WHERE created_at > '2026-05-08 14:00:00';
UPDATE concursos SET nome = 'Nome original' WHERE id = '...';
```

Se não tiver certeza dos IDs/timestamps a apagar, abre o backup JSON
mais recente e compara — `backup-YYYY-MM-DD-HHMMSS.json` tem snapshot
do estado certo.

---

## Cenário 3 — "Catastrófico, restore total" (esperançosamente nunca)

**Quando:** algo deu MUITO errado — schema corrompido, dados destruídos,
quer voltar ao estado exato de um backup.

**Pré-requisito:** ter rodado `npm run backup` recentemente E ter o
arquivo `backup-XXX.json` salvo.

**Tempo total:** ~10 min.

### Passo 1 — Reset total do schema

Supabase Dashboard → SQL Editor → cola e executa:

```sql
-- ⚠️ APAGA TUDO do schema public. IRREVERSÍVEL sem backup.
-- Não toca em auth.users, storage.objects (managed pelo Supabase).
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

### Passo 2 — Reaplicar schema

Gere snapshot atual (consolidado de todas as migrations):

```powershell
npm run snapshot:schema
# Cria: schema-snapshot-YYYY-MM-DD.sql
```

Cola o conteúdo do `schema-snapshot-YYYY-MM-DD.sql` no SQL Editor →
Run. Recria todas as tabelas, indexes, triggers, RLS, RPCs.

### Passo 3 — Restaurar dados

```powershell
npm run restore -- backup-YYYY-MM-DD-HHMMSS.json
```

Insere os dados em ordem de dependência (FK-aware). Idempotente
(re-rodar não duplica).

### Passo 4 — Storage e auth (manual, se necessário)

- **Bucket questions-images**: precisa ser criado manualmente via
  Dashboard → Storage → New Bucket. Ver `supabase/storage_setup.sql`.
- **auth.users**: managed pelo Supabase Auth. Não está no backup.
  Se restore for num project novo SEM os usuários originais, FKs
  com `user_id` vão falhar. Solução: re-criar contas com mesmos UUIDs
  via API admin (avançado) OU restaurar só o owner atual.

### Passo 5 — Validar

```powershell
npm run check:migrations    # confirma schema OK
npm run dev                 # testa local
```

---

## Tabela-resumo dos comandos

| Comando | O que faz | Quando usar |
|---|---|---|
| `git checkout main` | Volta código pro production | Cenário 1, sempre |
| `git tag -l` | Lista tags (snapshots) | Pra ver pontos de restore |
| `git checkout pre-pivot-20260507` | Vai pra commit exato da tag | Inspecionar estado antigo (read-only) |
| `npm run backup` | Dump JSON de todas as tabelas | Antes de mudanças arriscadas |
| `npm run snapshot:schema` | Concatena migrations em 1 SQL | Antes do Cenário 3 |
| `npm run restore -- backup-X.json` | Insere dados do backup | Cenário 3, passo 3 |
| `npm run check:migrations` | Cruza disco × DB | Validação |
| `npm run check:migrations -- --mark-applied 0030,0031` | Marca como aplicada | Quando aplica via Dashboard manual |

---

## Checklist antes de operação arriscada

- [ ] `npm run backup` rodado nos últimos minutos
- [ ] Arquivo `backup-XXX.json` movido pra fora do projeto (Drive/pen drive)
- [ ] `npm run snapshot:schema` se for mexer em schema
- [ ] Tag git criada (`git tag -a antes-de-X -m "..."`)
- [ ] Branch separado se for experimento longo (`git checkout -b ...`)
- [ ] Confirmar que está no branch certo (`git status`)

---

## O que é gerenciado pelo Supabase (NÃO restaurado)

Tudo isso vive fora do nosso schema `public.*` e não está no backup nem
nas migrations:

- **`auth.users`**: contas de usuário. Backup do Supabase Dashboard
  (Authentication → Users → Export) se precisar separadamente.
- **`storage.objects`**: imagens de questões no bucket
  `questions-images`. Backup do bucket via Dashboard se precisar.
- **Stripe customers/subscriptions**: viver no Stripe, não no Supabase.
- **Logs de Vercel/Supabase**: managed services.

---

## Q&A rápido

**Q: O backup tem todos os dados pra recriar tudo?**
A: Tem todos os dados de `public.*`. Schema vive nas migrations (git).
Storage objects e auth.users são managed externos.

**Q: Se eu deletar o projeto Supabase inteiro, dá pra restaurar?**
A: Depende. Você precisa criar projeto novo, recriar bucket, recriar
usuários (Supabase Auth não exporta facilmente), aplicar schema, depois
restore. Possível mas trabalhoso. Por isso preserve o projeto atual.

**Q: Restore preserva IDs originais?**
A: Sim — todos os UUIDs são preservados literais no backup. Apenas
sequences (`bigserial`) podem precisar reset manual em casos raros.

**Q: Se eu rodar restore num DB que JÁ tem dados, dá conflito?**
A: Não — usa upsert. Atualiza linhas existentes pelos IDs originais
e insere as faltantes. Idempotente.
