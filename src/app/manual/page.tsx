import fs from 'fs';
import path from 'path';
import { ManualView } from '@/components/ManualView';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';

/**
 * Página de manual. Renderiza docs/MANUAL.md como HTML formatado.
 * Markdown é processado server-side em build pra não trazer parser
 * pesado pro client. Fallback: se arquivo ausente, mostra mensagem.
 */
export const dynamic = 'force-dynamic';

export default function ManualPage() {
  let content = '';
  try {
    const file = path.join(process.cwd(), 'docs', 'MANUAL.md');
    content = fs.readFileSync(file, 'utf8');
  } catch {
    content =
      '# Manual\n\nNão foi possível carregar o manual. Verifique `docs/MANUAL.md`.';
  }
  return (
    <>
      <PublicHeader />
      <ManualView markdown={content} />
      <PublicFooter />
    </>
  );
}
