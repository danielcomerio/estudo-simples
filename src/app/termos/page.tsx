import fs from 'fs';
import path from 'path';
import { ManualView } from '@/components/ManualView';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';

export const dynamic = 'force-static';
export const metadata = {
  title: 'Termos de Uso — Estudo Simples',
  description: 'Regras para uso do Estudo Simples.',
};

export default function TermsPage() {
  let content = '';
  try {
    content = fs.readFileSync(
      path.join(process.cwd(), 'docs', 'TERMS.md'),
      'utf8'
    );
  } catch {
    content = '# Termos de Uso\n\nDocumento indisponível.';
  }
  return (
    <>
      <PublicHeader />
      <ManualView markdown={content} />
      <PublicFooter />
    </>
  );
}
