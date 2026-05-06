import { Suspense } from 'react';
import { ShareTargetReceiver } from '@/components/ShareTargetReceiver';

export const dynamic = 'force-dynamic';

/**
 * Endpoint de Web Share Target. Outros apps (browser share, Notes,
 * Messages, etc.) podem compartilhar texto/JSON pra cá.
 *
 * Recebe via GET com title/text/url e tenta extrair JSON. Se for JSON
 * válido com schema do app, redireciona pra /banco com o conteúdo
 * pré-populado pra revisão.
 */
export default function ShareTargetPage() {
  return (
    <main
      style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: '40px 20px',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '1.4rem', margin: '0 0 12px' }}>
        Recebendo conteúdo compartilhado…
      </h1>
      <Suspense fallback={<p className="muted">Processando…</p>}>
        <ShareTargetReceiver />
      </Suspense>
    </main>
  );
}
