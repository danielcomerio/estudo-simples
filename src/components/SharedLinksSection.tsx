'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMyPlan } from '@/lib/use-plan';
import { canShareDecks } from '@/lib/billing';
import { confirmDialog } from './ConfirmDialog';
import { toast } from './Toast';

/**
 * Seção de "Links compartilhados" em /configuracoes (Fase C2 UI).
 *
 * Lista snapshots gerados por mim (shared_decks). Mostra contador de
 * acessos, vencimento, status, com ações de copiar URL e revogar.
 *
 * Gate Pro/Master via canShareDecks. Free/Estudante não vê a seção
 * (sem upsell aqui — quem clicou em "Compartilhar" no /banco já viu
 * o upsell lá).
 */
type SharedLink = {
  id: string;
  token: string;
  question_count: number;
  created_at: string;
  expires_at: string;
  access_count: number;
  revoked_at: string | null;
  is_public?: boolean;
  title?: string | null;
  description?: string | null;
};

export function SharedLinksSection() {
  const { plan } = useMyPlan();
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRevoked, setShowRevoked] = useState(false);

  const reload = async () => {
    if (!canShareDecks(plan)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/share');
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      setLinks((json as { links: SharedLink[] }).links ?? []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, [plan]);

  if (!canShareDecks(plan)) return null;

  const ativos = links.filter(
    (l) => !l.revoked_at && new Date(l.expires_at).getTime() > Date.now()
  );
  const inativos = links.filter(
    (l) => l.revoked_at || new Date(l.expires_at).getTime() <= Date.now()
  );

  return (
    <div className="card" id="sharing">
      <h2 style={{ margin: '0 0 8px' }}>Links compartilhados</h2>
      <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
        Snapshots de questões que você compartilhou via{' '}
        <strong>/banco → Compartilhar</strong>. Cada link é um congelado
        no momento da criação — receptor importa cópias pra conta dele.
      </p>

      {loading ? (
        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Carregando…
        </p>
      ) : ativos.length === 0 && inativos.length === 0 ? (
        <p
          className="muted"
          style={{ marginTop: 12, fontSize: '0.85rem' }}
        >
          Nenhum link gerado ainda. Vá em{' '}
          <Link href="/banco" style={{ color: 'var(--primary)' }}>
            /banco
          </Link>
          , selecione algumas questões e clique em Compartilhar.
        </p>
      ) : (
        <>
          {ativos.length > 0 && (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '12px 0 0',
              }}
            >
              {ativos.map((l) => (
                <LinkItem
                  key={l.id}
                  link={l}
                  onRevoked={reload}
                />
              ))}
            </ul>
          )}

          {inativos.length > 0 && (
            <details style={{ marginTop: 14 }}>
              <summary
                className="muted"
                style={{ cursor: 'pointer', fontSize: '0.85rem' }}
                onClick={() => setShowRevoked((v) => !v)}
              >
                Revogados ou expirados ({inativos.length})
              </summary>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '8px 0 0',
                  fontSize: '0.85rem',
                }}
              >
                {inativos.map((l) => (
                  <li
                    key={l.id}
                    className="muted"
                    style={{
                      padding: '6px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <code style={{ fontSize: '0.78rem' }}>
                      …{l.token.slice(-8)}
                    </code>
                    {' · '}
                    {l.question_count} questão(ões){' · '}
                    {l.access_count} acesso(s){' · '}
                    {l.revoked_at
                      ? `revogado em ${new Date(l.revoked_at).toLocaleDateString('pt-BR')}`
                      : `expirou em ${new Date(l.expires_at).toLocaleDateString('pt-BR')}`}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function LinkItem({
  link,
  onRevoked,
}: {
  link: SharedLink;
  onRevoked: () => void;
}) {
  const [editingPublic, setEditingPublic] = useState(false);
  const [title, setTitle] = useState(link.title ?? '');
  const [description, setDescription] = useState(link.description ?? '');
  const [savingPublic, setSavingPublic] = useState(false);

  const togglePublic = async (newPublic: boolean) => {
    setSavingPublic(true);
    try {
      const res = await fetch(`/api/share/${link.token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_public: newPublic,
          ...(newPublic ? { title: title.trim() || null, description: description.trim() || null } : {}),
        }),
      });
      if (!res.ok) {
        toast('Erro ao atualizar', 'error');
        return;
      }
      toast(
        newPublic
          ? 'Deck publicado no marketplace.'
          : 'Deck removido do marketplace.',
        'success'
      );
      setEditingPublic(false);
      onRevoked(); // reload list
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error');
    } finally {
      setSavingPublic(false);
    }
  };
  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin}/import/${link.token}`
      : `/import/${link.token}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copiado.', 'success');
    } catch {
      toast('Falha ao copiar.', 'error');
    }
  };

  const revoke = async () => {
    const ok = await confirmDialog({
      title: 'Revogar link?',
      message:
        'Quem ainda não importou perderá o acesso. Quem já importou continua com as cópias na conta dele.',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/share/${link.token}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        toast('Erro revogando.', 'error');
        return;
      }
      toast('Link revogado.', 'success');
      onRevoked();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error');
    }
  };

  const daysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(link.expires_at).getTime() - Date.now()) /
        (24 * 60 * 60 * 1000)
    )
  );

  return (
    <li
      style={{
        padding: '10px 0',
        borderTop: '1px solid var(--border)',
        display: 'grid',
        gap: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <strong style={{ fontSize: '0.92rem' }}>
          {link.question_count} questão(ões)
        </strong>
        <div className="row gap" style={{ alignItems: 'center' }}>
          <button
            type="button"
            onClick={copy}
            style={{ padding: '4px 10px', fontSize: '0.85rem' }}
          >
            📋 Copiar
          </button>
          <button
            type="button"
            onClick={() => {
              window.open(
                `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`,
                '_blank',
                'noopener'
              );
            }}
            title="QR code (abre em nova aba via api.qrserver.com)"
            style={{ padding: '4px 10px', fontSize: '0.85rem' }}
          >
            🔲 QR
          </button>
          <button
            type="button"
            className="danger"
            onClick={revoke}
            style={{ padding: '4px 10px', fontSize: '0.85rem' }}
          >
            Revogar
          </button>
        </div>
      </div>
      <div
        className="muted"
        style={{ fontSize: '0.8rem', display: 'flex', gap: 12, flexWrap: 'wrap' }}
      >
        <span>
          {link.access_count}{' '}
          {link.access_count === 1 ? 'acesso' : 'acessos'}
        </span>
        <span>
          {daysLeft > 365 * 50
            ? 'Sem expiração'
            : daysLeft > 0
              ? `Expira em ${daysLeft} dia${daysLeft === 1 ? '' : 's'}`
              : 'Expira hoje'}
        </span>
        <span>
          Criado em{' '}
          {new Date(link.created_at).toLocaleDateString('pt-BR')}
        </span>
      </div>
      <code
        style={{
          fontSize: '0.75rem',
          padding: '4px 6px',
          background: 'var(--bg-elev-2)',
          borderRadius: 4,
          wordBreak: 'break-all',
          color: 'var(--muted)',
        }}
      >
        {url}
      </code>

      {/* Toggle marketplace público */}
      <div style={{ marginTop: 4, fontSize: '0.82rem' }}>
        {!editingPublic && (
          <>
            {link.is_public ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    padding: '2px 8px',
                    background: 'var(--primary-soft)',
                    color: 'var(--primary)',
                    borderRadius: 999,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  📚 Público
                </span>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setEditingPublic(true)}
                  style={{ padding: '2px 8px', fontSize: '0.78rem' }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => void togglePublic(false)}
                  disabled={savingPublic}
                  style={{ padding: '2px 8px', fontSize: '0.78rem' }}
                >
                  Tornar privado
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="ghost"
                onClick={() => setEditingPublic(true)}
                style={{ padding: '2px 8px', fontSize: '0.78rem' }}
              >
                📚 Publicar no marketplace
              </button>
            )}
          </>
        )}
        {editingPublic && (
          <div
            style={{
              marginTop: 8,
              padding: 10,
              background: 'var(--bg-elev-2)',
              borderRadius: 'var(--radius)',
            }}
          >
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do deck (ex: TJ-SP — Direito Civil)"
              maxLength={200}
              aria-label="Título do deck público"
              style={{ width: '100%', marginBottom: 6, fontSize: '0.85rem' }}
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição (opcional, max 2000 chars)"
              maxLength={2000}
              aria-label="Descrição"
              style={{
                width: '100%',
                marginBottom: 6,
                fontSize: '0.85rem',
                resize: 'vertical',
                minHeight: 60,
              }}
            />
            <div className="row gap" style={{ alignItems: 'center' }}>
              <button
                type="button"
                className="primary"
                onClick={() => void togglePublic(true)}
                disabled={savingPublic || !title.trim()}
                style={{ padding: '4px 12px', fontSize: '0.82rem' }}
              >
                {savingPublic ? 'Salvando…' : 'Publicar'}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setEditingPublic(false)}
                style={{ padding: '4px 8px', fontSize: '0.82rem' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
