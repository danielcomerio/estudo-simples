'use client';

import { useState } from 'react';
import { useMyPlan } from '@/lib/use-plan';
import { canShareDecks } from '@/lib/billing';
import { toast } from './Toast';
import { Modal } from './Modal';
import Link from 'next/link';

/**
 * Botão pra compartilhar questões selecionadas via link público (Fase
 * C2). Gate Pro: free/estudante vê upsell em vez do botão.
 *
 * Fluxo:
 *  1. Click → abre dialog com seletor de expiração.
 *  2. POST /api/share → retorna { token, url }.
 *  3. Mostra URL completa no dialog com botão "Copiar".
 */
export function ShareDeckButton({
  selectedIds,
}: {
  selectedIds: Set<string>;
}) {
  const { plan } = useMyPlan();
  const canShare = canShareDecks(plan);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [expirationDays, setExpirationDays] = useState(30);

  if (selectedIds.size === 0) return null;

  // Free/Estudante vê upsell discreto em vez do botão de compartilhar.
  if (!canShare) {
    return (
      <Link href="/planos" title="Compartilhar bancos é exclusivo do plano Pro">
        <button
          type="button"
          aria-label="Compartilhar (requer Pro)"
        >
          🔒 Compartilhar (Pro)
        </button>
      </Link>
    );
  }

  const createLink = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionIds: Array.from(selectedIds),
          expirationDays,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.token) {
        const msg =
          (json as { message?: string } | null)?.message ??
          'Erro criando link.';
        toast(msg, 'error', 6000);
        setCreating(false);
        return;
      }
      const fullUrl = `${window.location.origin}/import/${json.token}`;
      setLink(fullUrl);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro de rede', 'error');
    } finally {
      setCreating(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copiado pra área de transferência.', 'success');
    } catch {
      toast('Falha ao copiar — copie manualmente.', 'error');
    }
  };

  const close = () => {
    setOpen(false);
    setLink(null);
    setCreating(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Compartilhar ${selectedIds.size} questão(ões) selecionadas via link`}
        aria-label={`Compartilhar ${selectedIds.size} questões via link`}
        style={{
          background: 'var(--primary-soft)',
          border: '1px solid var(--primary)',
          color: 'var(--primary)',
          fontWeight: 500,
        }}
      >
        🔗 Compartilhar ({selectedIds.size})
      </button>

      {open && (
        <Modal onClose={close} ariaLabel="Compartilhar banco" maxWidth={520}>
            <h2 id="share-dialog-title" style={{ margin: '0 0 8px' }}>
              🔗 Compartilhar banco
            </h2>
            <p className="muted" style={{ marginTop: 0, fontSize: '0.9rem' }}>
              {selectedIds.size}{' '}
              {selectedIds.size === 1 ? 'questão será compartilhada' : 'questões serão compartilhadas'}.
              O receptor importa pra conta dele e vira dono pleno das cópias —
              suas alterações futuras NÃO afetam quem já importou (snapshot
              congelado).
            </p>

            {!link ? (
              <>
                <label
                  style={{ display: 'block', marginTop: 14 }}
                >
                  <span>Expira em</span>
                  <select
                    value={expirationDays}
                    onChange={(e) =>
                      setExpirationDays(Number(e.target.value))
                    }
                    style={{ marginLeft: 8 }}
                    aria-label="Período de expiração do link"
                  >
                    <option value={7}>7 dias</option>
                    <option value={30}>30 dias</option>
                    <option value={90}>90 dias</option>
                    <option value={180}>180 dias</option>
                    <option value={365}>1 ano</option>
                    {/* "Sem expiração" = 100 anos. Nada é "sem prazo"
                        no DB (CHECK exige expires_at > created_at), mas
                        100 anos é além de qualquer relevância prática.
                        User mantém a opção de revogar manualmente
                        quando quiser via /configuracoes. */}
                    <option value={36500}>Sem expiração</option>
                  </select>
                </label>

                <div className="row gap" style={{ marginTop: 18 }}>
                  <button
                    type="button"
                    className="primary"
                    onClick={createLink}
                    disabled={creating}
                  >
                    {creating ? 'Gerando…' : 'Gerar link'}
                  </button>
                  <button type="button" onClick={close}>
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ marginTop: 14, fontSize: '0.9rem' }}>
                  Link gerado:
                </p>
                <input
                  type="text"
                  readOnly
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }}
                  aria-label="URL do link compartilhado"
                />
                <div className="row gap" style={{ marginTop: 14 }}>
                  <button type="button" className="primary" onClick={copy}>
                    📋 Copiar link
                  </button>
                  <button type="button" onClick={close}>
                    Fechar
                  </button>
                </div>
                <p
                  className="muted"
                  style={{ marginTop: 12, fontSize: '0.8rem' }}
                >
                  Pra revogar este link depois, vá em{' '}
                  <a
                    href="/configuracoes#sharing"
                    style={{ color: 'var(--primary)' }}
                  >
                    Configurações → Links compartilhados
                  </a>
                  .
                </p>
              </>
            )}
        </Modal>
      )}
    </>
  );
}
