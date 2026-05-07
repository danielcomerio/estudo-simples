# Push notifications — setup completo

Pra ativar push notifications em produção (Web Push agora; FCM/APNS no
futuro pra mobile nativo).

## 1. Gerar par VAPID

VAPID = mecanismo de autenticação de servidor pra Web Push. O par é
único do projeto e nunca muda (rotacionar invalida todas as
subscriptions registradas — evite).

```bash
npx web-push generate-vapid-keys
```

Output:
```
Public Key:  BEf2...ABC
Private Key: x9k...XYZ
```

## 2. Configurar env vars na Vercel

Settings → Environment Variables → Production:

| Nome | Valor | Visibilidade |
|------|-------|--------------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | (Public Key do passo 1) | Public (cliente lê) |
| `VAPID_PRIVATE_KEY` | (Private Key do passo 1) | **Secret** |
| `VAPID_SUBJECT` | `mailto:admin@app.estudosimples.com.br` | Secret |
| `CRON_SECRET` | (random, ex: `openssl rand -hex 32`) | Secret |

**ATENÇÃO**:
- `VAPID_PRIVATE_KEY` **nunca** com prefixo `NEXT_PUBLIC_`.
- `CRON_SECRET` previne disparo manual dos endpoints `/api/cron/*` —
  Vercel cron envia automático com header `Authorization: Bearer ${CRON_SECRET}`.

Salve as keys também em local seguro (1Password, Bitwarden) — perdê-las
significa que todos os subscribers ficam órfãos e precisam re-ativar.

## 3. Re-deploy

Vercel detecta novas envs e re-deploy é automático ao próximo push,
ou clique manual em "Redeploy" no último deployment.

## 4. Aplicar migrations

Já feito? Confira:

```sql
select to_regclass('public.push_devices') is not null as ok_0015;
select exists (
  select 1 from pg_proc
  where proname = 'count_due_per_user'
) as ok_0016;
```

Se algum `false`:

- 0015: aplicar `supabase/migrations/0015_push_devices.sql`
- 0016: aplicar `supabase/migrations/0016_count_due_rpc.sql`

## 5. Testar Web Push (browser)

1. Abre app em produção como user logado.
2. Vai em `/configuracoes` → seção "Notificações" → clique
   "🔔 Ativar notificações".
3. Browser pede permissão → permite.
4. Toast "Notificações ativadas" + estado vira "✅ ativadas".

Confere no banco:

```sql
select * from push_devices order by created_at desc limit 5;
```

Deve aparecer 1 row pro seu user com `platform='web'`.

## 6. Testar disparo manual

Sem rodar o cron, pra disparar push de teste pra um user específico:

```bash
# Local: adapte pra teu setup
curl -X GET https://app.estudosimples.com.br/api/cron/srs-due \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

Resposta:
```json
{ "ok": true, "processed": 1, "sent": 1, "failed": 0, "disabled": 0 }
```

## 7. Cron automático

Vercel cron já está configurado em `vercel.json`:
- `0 12 * * *` — `/api/cron/srs-due` (12h UTC, ~9h Brasil)
- `0 22 * * *` — `/api/cron/streak-risk` (22h UTC, ~19h Brasil)

Verifica execução em Vercel Dashboard → Project → Logs → filter
"cron".

## 8. Troubleshooting

### "VAPID keys ausentes"
Env var não setada ou típo errado. Confira `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
(public) e `VAPID_PRIVATE_KEY` (server). Re-deploy após mudar envs.

### "Permissão negada"
User clicou "Não" no prompt do browser. Pra reativar: clique no cadeado
da URL → Site permissions → Notificações → Permitir → recarrega página.

### Push enviado mas notif não aparece
- Service Worker pode não estar ativo (em dev SW só roda em prod).
- Browser bloqueou push silencioso (todas exigem `userVisibleOnly: true`,
  já está no código).
- macOS: notificações do Chrome ficam em System Preferences →
  Notifications & Focus → Chrome → Allow Notifications.

### `count_due_per_user` retorna vazio
Pode ser que nenhum user tenha questões SRS-vencendo no momento. Pra
testar, force `dueDate` numa questão sua pra ontem:

```sql
update questions
   set srs = jsonb_set(srs, '{dueDate}', to_jsonb(extract(epoch from now() - interval '1 day') * 1000)::text::jsonb)
 where id = '<id>'
   and user_id = '<seu-uuid>';
```

## 9. Mobile nativo (futuro)

Pra Android/iOS via Capacitor + push notifications:

```bash
npm install @capacitor/push-notifications
npx cap sync
```

Depois:
- Android: Firebase Console → projeto → adicionar Android app →
  download `google-services.json` → coloca em `android/app/`
- iOS: Apple Developer → Certificates → criar APNS Auth Key →
  configurar em Capacitor.config

Endpoint `/api/push/register` já aceita `platform: 'fcm'` e `'apns'`.
Disparo server-side (`lib/push-server.ts`) precisa ser estendido pra
chamar FCM HTTP v1 e APNS HTTP/2 — não implementado ainda.

## 10. Custos

- Web Push: free (Mozilla autopush, Google Cloud Messaging — ambos sem
  custo pra uso normal).
- FCM (Android): free tier suporta milhões/dia.
- APNS (iOS): incluso no Apple Developer Program (USD 99/ano).
- Vercel cron: free tier 100 execuções/dia (suficiente).

Total: $0 pra Web Push em escala normal.
