import type { GabaritoSource } from '@/lib/types';

/**
 * Badge visual indicando origem do gabarito da questão.
 *
 *   - 'ia':       🤖 IA (atenção: pendente de oficialização)
 *   - 'oficial':  ✓ oficial (banca, sem ressalva)
 *   - 'crowd':    👥 crowd (validação coletiva — usado em decks compartilhados)
 *   - null/undef: nada
 *
 * Acompanha questões importadas com gabarito de origem conhecida. Não
 * substitui `Question.verificacao` (esse é o estado de revisão pessoal
 * do usuário); complementa.
 */
export function GabaritoSourceBadge({
  source,
  size = 'small',
}: {
  source?: GabaritoSource | null;
  size?: 'small' | 'medium';
}) {
  if (!source) return null;

  const fontSize = size === 'small' ? '0.7rem' : '0.82rem';
  const padding = size === 'small' ? '1px 6px' : '3px 9px';

  if (source === 'ia') {
    return (
      <span
        title="Gabarito gerado por IA — pendente de validação contra fonte oficial"
        aria-label="Gabarito gerado por IA"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          fontSize,
          padding,
          borderRadius: 999,
          background: 'var(--warn-bg, rgba(217, 119, 6, 0.12))',
          color: 'var(--warn, #d97706)',
          border: '1px solid var(--warn, #d97706)',
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        🤖 IA
      </span>
    );
  }
  if (source === 'oficial') {
    return (
      <span
        title="Gabarito oficial da banca"
        aria-label="Gabarito oficial"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          fontSize,
          padding,
          borderRadius: 999,
          background: 'var(--primary-soft)',
          color: 'var(--primary)',
          border: '1px solid var(--primary)',
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        ✓ oficial
      </span>
    );
  }
  // crowd
  return (
    <span
      title="Gabarito de validação coletiva (deck compartilhado)"
      aria-label="Gabarito coletivo"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize,
        padding,
        borderRadius: 999,
        background: 'var(--bg-elev-2)',
        color: 'var(--muted)',
        border: '1px solid var(--border)',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      👥 crowd
    </span>
  );
}
