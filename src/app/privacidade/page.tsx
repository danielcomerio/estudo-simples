import fs from 'fs';
import path from 'path';
import { ManualView } from '@/components/ManualView';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';

export const dynamic = 'force-static';
export const metadata = {
  title: 'Política de Privacidade — Estudo Simples',
  description: 'Como coletamos, usamos e protegemos seus dados. Conformidade LGPD.',
};

export default function PrivacyPage() {
  let content = '';
  try {
    content = fs.readFileSync(
      path.join(process.cwd(), 'docs', 'PRIVACY.md'),
      'utf8'
    );
  } catch {
    content = '# Política de Privacidade\n\nDocumento indisponível.';
  }
  return (
    <>
      <PublicHeader />
      <ManualView markdown={content} />
      <PublicFooter />
    </>
  );
}
