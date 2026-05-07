# Templates de email — Supabase Auth

Templates HTML pra colar no Supabase Dashboard → Auth → Email Templates.
Substituem os defaults genéricos do Supabase por algo branded e em pt-BR.

Variáveis disponíveis (Supabase populates):
- `{{ .ConfirmationURL }}` — link de confirm/reset
- `{{ .Token }}` — token bruto (raramente usado)
- `{{ .TokenHash }}` — hash do token
- `{{ .Email }}` — email do destinatário
- `{{ .Data }}` — metadata adicional

## Confirm signup

**Subject:** Confirme seu email · Estudo Simples

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Confirme seu email</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:48px;height:48px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:12px;line-height:48px;font-size:24px;color:#fff;font-weight:700;">ES</div>
    </div>
    <h1 style="margin:0 0 16px;font-size:22px;text-align:center;">Bem-vindo ao Estudo Simples 🎓</h1>
    <p style="line-height:1.6;margin:0 0 24px;">
      Olá! Pra ativar sua conta e começar a estudar, clique no botão abaixo:
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 28px;background:#22c55e;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">
        Confirmar email
      </a>
    </div>
    <p style="line-height:1.6;font-size:13px;color:#666;margin:0;">
      Se o botão não funcionar, copie e cole esse link:<br>
      <code style="background:#f4f4f5;padding:4px 6px;border-radius:4px;font-size:12px;word-break:break-all;">{{ .ConfirmationURL }}</code>
    </p>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:28px 0;">
    <p style="font-size:12px;color:#888;line-height:1.6;text-align:center;margin:0;">
      Estudo Simples · Repetição espaçada para concursos<br>
      Não esperava esse email? Pode ignorar — não vai acontecer nada.
    </p>
  </div>
</body>
</html>
```

## Magic Link / Login

**Subject:** Seu link de acesso · Estudo Simples

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Seu link de acesso</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
    <h1 style="margin:0 0 16px;font-size:22px;text-align:center;">🔐 Seu link de acesso</h1>
    <p style="line-height:1.6;margin:0 0 24px;">
      Clique no botão pra entrar no Estudo Simples. O link expira em 1 hora.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 28px;background:#22c55e;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Entrar agora</a>
    </div>
    <p style="font-size:13px;color:#666;line-height:1.6;margin:0;">
      Se você não solicitou esse link, ignore esse email.
    </p>
  </div>
</body>
</html>
```

## Reset password

**Subject:** Redefinir senha · Estudo Simples

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Redefinir senha</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
    <h1 style="margin:0 0 16px;font-size:22px;text-align:center;">Redefinir senha</h1>
    <p style="line-height:1.6;margin:0 0 24px;">
      Recebemos uma solicitação pra redefinir sua senha. Clique no
      botão pra criar uma nova:
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 28px;background:#22c55e;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Redefinir senha</a>
    </div>
    <p style="font-size:13px;color:#666;line-height:1.6;margin:0 0 8px;">
      Se você não fez essa solicitação, ignore — sua senha continua a mesma.
    </p>
    <p style="font-size:13px;color:#666;line-height:1.6;margin:0;">
      O link expira em 1 hora.
    </p>
  </div>
</body>
</html>
```

## Como aplicar

1. Supabase Dashboard → seu projeto → Authentication → Email Templates.
2. Selecione o template (Confirm signup / Magic Link / Reset Password).
3. Subject: cole o assunto sugerido.
4. Body: cole o HTML correspondente.
5. Save.

## Testar

- Crie uma conta nova (signup) → confirme que o email chega com o
  visual correto.
- Use "Esqueci a senha" → confirme reset email.
- Confira no Spam — se SMTP do Supabase entrega no spam, configure
  SMTP customizado (SendGrid/Postmark grátis tier).

## Próximos passos sugeridos

- SMTP customizado pra evitar caixa de spam (Supabase free SMTP é
  rate-limited e nem sempre entrega).
- Domain authentication (DKIM/SPF/DMARC) no provedor de SMTP.
- Logo PNG hospedada (atualmente o "ES" é texto inline; se quiser
  trocar por logo, hospede em /public/logo-email.png e use `<img>`).
