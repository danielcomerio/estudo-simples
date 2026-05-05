# Política de Privacidade — Estudo Simples

**Última atualização:** 2026-05-05

Esta política explica como o Estudo Simples coleta, usa, armazena e protege seus dados pessoais. Em conformidade com a LGPD (Lei nº 13.709/2018) e princípios do GDPR.

---

## 1. Quem somos

**Estudo Simples** é um aplicativo de repetição espaçada para preparação a concursos públicos, operado pessoalmente. Em caso de dúvidas, entre em contato pelo e-mail constante na seção de contato do app.

## 2. Dados que coletamos

### 2.1 Dados de cadastro

- **E-mail**: utilizado para identificação da conta, autenticação e comunicação relativa ao serviço.
- **Senha**: armazenada apenas como hash criptográfico irreversível pelo Supabase (provedor de autenticação). Nunca temos acesso à senha em texto puro.

### 2.2 Dados de uso

- Questões importadas, criadas e editadas pelo usuário (banco de questões).
- Histórico de respostas (acertos, erros, tempo gasto).
- Estatísticas de estudo (por disciplina, banca, dia da semana, etc.).
- Concursos cadastrados, disciplinas, tópicos, simulados.
- Preferências (tema, algoritmo SRS, meta diária, etc.).

### 2.3 Dados de pagamento (apenas para usuários Pro)

Pagamentos são processados pelo **Stripe**. **Não armazenamos** dados de cartão de crédito ou pagamento. Recebemos do Stripe apenas:

- ID do cliente (`stripe_customer_id`)
- ID da assinatura (`stripe_subscription_id`)
- Status da assinatura (active, past_due, canceled, etc.)
- Data do próximo ciclo
- Flag de cancelamento agendado

Para detalhes sobre como o Stripe processa seus dados, consulte: [https://stripe.com/br/privacy](https://stripe.com/br/privacy).

### 2.4 Modo Visitante

Usuários no modo visitante têm seus dados armazenados **apenas localmente** (IndexedDB do navegador). Nada é enviado aos nossos servidores enquanto o modo visitante está ativo.

### 2.5 Cookies

Utilizamos:

- **Cookie de autenticação Supabase**: necessário para manter a sessão. HttpOnly, Secure, SameSite.
- **Cookie `es-guest`**: marca usuários no modo visitante. Sem dados pessoais.
- **Cookies do Stripe**: durante o checkout, definidos pelo Stripe diretamente em domínio próprio (não nosso).

Não usamos cookies de tracking, analytics de terceiros ou publicidade.

## 3. Como usamos seus dados

- Para fornecer e operar o serviço.
- Para sincronizar entre dispositivos (apenas para usuários autenticados).
- Para processar pagamentos (Stripe, apenas para Pro).
- Para enviar comunicações relativas à conta (confirmação de e-mail, recuperação de senha).

**Não fazemos:**

- Não vendemos dados.
- Não compartilhamos dados com terceiros para fins de marketing.
- Não usamos dados para treinar modelos de IA externos.

## 4. Onde seus dados ficam armazenados

- **Supabase** (banco de dados, autenticação): infraestrutura em servidores AWS, com criptografia em trânsito (TLS 1.2+) e em repouso (AES-256).
- **Stripe** (pagamentos): conformidade PCI-DSS Nível 1.
- **Vercel** (hospedagem da aplicação): edge network global. Não armazenamos dados do usuário no Vercel — só servimos o app.

Dados podem ser processados em servidores fora do Brasil (EUA, principalmente). Os provedores acima possuem certificações internacionais de segurança e conformidade LGPD/GDPR.

## 5. Por quanto tempo guardamos

- **Conta ativa**: enquanto você usar o app.
- **Após exclusão da conta**: dados pessoais (e-mail, perfil, questões, histórico) são removidos imediatamente. Dados anonimizados de pagamento ficam retidos pelo Stripe conforme exigências fiscais (geralmente 5 anos).
- **Backups**: snapshots automáticos do Supabase ficam por 7 dias. Após esse período, dados deletados não são recuperáveis.

## 6. Seus direitos (LGPD art. 18)

Você pode, a qualquer momento:

- **Acessar** seus dados — botão "Exportar backup" em /configuracoes baixa tudo em JSON.
- **Corrigir** dados — direto no app (editar questões, perfil, etc.).
- **Excluir** sua conta — botão "Excluir minha conta" em /configuracoes. Apaga tudo permanentemente.
- **Portar** dados — formato JSON exportável é interoperável.
- **Revogar** consentimento — basta excluir a conta.
- **Ser informado** sobre uso indevido — caso suspeite, escreva para nosso e-mail de contato.

## 7. Segurança

- Comunicação criptografada (HTTPS/TLS).
- Autenticação via Supabase Auth (PBKDF2 para hash de senha).
- Row-Level Security (RLS) no banco isolando dados por usuário.
- Headers de segurança (CSP, HSTS, X-Frame-Options, etc.).
- Rate limiting em endpoints sensíveis.
- Pagamentos em ambiente PCI-DSS (Stripe).

## 8. Crianças e adolescentes

O app não é destinado a menores de 16 anos. Não coletamos intencionalmente dados de menores. Caso identifique que isso ocorreu, escreva imediatamente para nosso e-mail.

## 9. Atualizações

Esta política pode ser atualizada. A data acima reflete a última revisão. Mudanças materiais serão comunicadas por e-mail aos usuários autenticados.

## 10. Contato

Em caso de dúvidas sobre privacidade ou para exercer seus direitos LGPD, escreva para o e-mail de contato divulgado no app, com a tag "[LGPD]" no assunto. Resposta em até 15 dias úteis.
