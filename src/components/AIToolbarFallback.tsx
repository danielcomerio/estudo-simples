'use client';

import Link from 'next/link';
import { getDefaultProvider } from '@/lib/ai-keys';

/**
 * Mostra UM link "Configurar IA" no toolbar do /banco quando o user
 * não tem chave configurada. Substitui os 3 links individuais que
 * AIGenerateButton/AIClozeFromTextButton/AIOCRButton mostravam (que
 * apareciam lado a lado e era redundante visual).
 *
 * Quando provider existir, esse componente não renderiza nada — os 3
 * botões reais aparecem.
 */
export function AIToolbarFallback() {
  const provider = getDefaultProvider();
  if (provider) return null;
  return (
    <Link
      href="/configuracoes#ai-keys"
      scroll={false}
      title="Configure uma chave de IA pra usar geração, OCR e cloze automáticos"
      style={{
        fontSize: '0.85rem',
        color: 'var(--muted)',
        textDecoration: 'underline',
        padding: '6px 12px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      🤖 Configurar IA pra geração automática
    </Link>
  );
}
