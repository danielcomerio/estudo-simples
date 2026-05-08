/**
 * Template de email de boas-vindas pós-signup. Stub texto+html prontos
 * pra integração com qualquer provider transacional (Resend, Postmark,
 * Brevo, AWS SES, etc).
 *
 * USER ACTION pra ativar envio real:
 *  1. Cadastrar conta em provider (Resend recomendado: 3k emails grátis)
 *  2. Adicionar env var RESEND_API_KEY (ou similar)
 *  3. Criar /api/cron/welcome-email que percorre auth.users
 *     created_at > now() - 24h, envia o email, marca como sent.
 *  4. Adicionar entry em vercel.json crons.
 *
 * Por ora a função `welcomeEmailHTML` está pronta pra ser chamada de
 * qualquer endpoint quando você decidir ligar.
 */

export function welcomeEmailSubject(): string {
  return '👋 Bem-vindo ao Estudo Simples';
}

export function welcomeEmailHTML(opts: { email: string }): string {
  const safeEmail = opts.email.replace(/[<>&"]/g, '');
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Bem-vindo ao Estudo Simples</title>
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 600px; margin: 24px auto; padding: 0 16px; color: #1a1a1a;">
  <h1 style="color: #22c55e;">👋 Bem-vindo ao Estudo Simples!</h1>
  <p>Sua conta (${safeEmail}) está pronta. Repetição espaçada pra concursos públicos brasileiros.</p>
  <h2>Primeiros passos</h2>
  <ol>
    <li><strong>Importe questões</strong> em <a href="https://app.estudosimples.com.br/banco">/banco</a> (JSON, Anki TXT, ou cole texto).</li>
    <li><strong>Cadastre seu concurso</strong> em <a href="https://app.estudosimples.com.br/concursos">/concursos</a> e vincule disciplinas com peso.</li>
    <li><strong>Estude</strong> em <a href="https://app.estudosimples.com.br/estudar">/estudar</a> — modo SRS prioriza vencidas automaticamente.</li>
    <li><strong>(Opcional) Plug uma chave IA</strong> em <a href="https://app.estudosimples.com.br/configuracoes#ai-keys">/configuracoes</a> pra desbloquear tutor ao vivo, gerar questões, mnemônicas, plano semanal.</li>
  </ol>
  <h2>Atalhos úteis</h2>
  <ul>
    <li><kbd>Ctrl+Shift+N</kbd> — captura rápida de qualquer rota</li>
    <li><kbd>F8</kbd> — modo focado (esconde topbar)</li>
    <li><kbd>?</kbd> — ver todos os atalhos</li>
  </ul>
  <p style="margin-top: 32px; color: #666; font-size: 0.85rem;">
    Dúvidas? Responda este email. Bom estudo! 🚀
  </p>
</body>
</html>`;
}

export function welcomeEmailText(opts: { email: string }): string {
  return `👋 Bem-vindo ao Estudo Simples!

Sua conta (${opts.email}) está pronta. Repetição espaçada pra concursos públicos brasileiros.

PRIMEIROS PASSOS

1. Importe questões em /banco (JSON, Anki TXT, ou cole texto)
2. Cadastre seu concurso em /concursos e vincule disciplinas com peso
3. Estude em /estudar — modo SRS prioriza vencidas automaticamente
4. (Opcional) Plug uma chave IA em /configuracoes pra desbloquear tutor ao vivo, gerar questões, mnemônicas, plano semanal

ATALHOS ÚTEIS
- Ctrl+Shift+N: captura rápida
- F8: modo focado
- ?: ver todos os atalhos

Bom estudo!
https://app.estudosimples.com.br
`;
}
