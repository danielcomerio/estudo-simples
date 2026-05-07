'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMyPlan } from '@/lib/use-plan';
import { canShareDecks } from '@/lib/billing';
import { toast } from './Toast';
import { confirmDialog } from './ConfirmDialog';

/**
 * Página /decks — gestão dos decks compartilhados ao vivo (Fase C3).
 *
 * Mostra:
 *  - Decks próprios (que o user criou e compartilha) com lista de
 *    grants (quem recebeu acesso). Revogar libera snapshot Fase C2
 *    pro grantee continuar tendo acesso readonly do estado final.
 *  - Decks recebidos (outros owners compartilharam comigo) — read-only
 *    no MVP. Mostra owner + count de questões + status do grant.
 *
 * Gate Pro/Master via canShareDecks. Free/Estudante vê upsell.
 */
type OwnDeck = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type ReceivedGrant = {
  id: string;
  deck_id: string;
  owner_user_id: string;
  permission: 'read' | 'read_write';
  created_at: string;
  revoked_at: string | null;
  frozen_share_token: string | null;
  live_decks: { name: string; description: string | null } | null;
};

type GrantOnDeck = {
  id: string;
  grantee_email: string;
  grantee_user_id: string | null;
  permission: 'read' | 'read_write';
  created_at: string;
  revoked_at: string | null;
  frozen_share_token: string | null;
};

export function DecksManager() {
  const { plan, loading: planLoading } = useMyPlan();
  const canShare = canShareDecks(plan);
  const [own, setOwn] = useState<OwnDeck[]>([]);
  const [received, setReceived] = useState<ReceivedGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDeck, setExpandedDeck] = useState<string | null>(null);
  const [grants, setGrants] = useState<Record<string, GrantOnDeck[]>>({});

  const reload = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/live-decks');
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        toast('Erro carregando decks', 'error');
        setLoading(false);
        return;
      }
      setOwn((json as { own: OwnDeck[] }).own ?? []);
      setReceived((json as { received: ReceivedGrant[] }).received ?? []);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro de rede', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const loadGrants = async (deckId: string) => {
    if (grants[deckId]) return; // já carregado
    try {
      const res = await fetch(`/api/live-decks/${deckId}/grants`);
      const json = await res.json().catch(() => null);
      if (!res.ok) return;
      setGrants((prev) => ({
        ...prev,
        [deckId]: (json as { grants: GrantOnDeck[] }).grants ?? [],
      }));
    } catch {}
  };

  const toggleExpand = (deckId: string) => {
    if (expandedDeck === deckId) {
      setExpandedDeck(null);
    } else {
      setExpandedDeck(deckId);
      void loadGrants(deckId);
    }
  };

  if (planLoading || loading) {
    return (
      <main className="page" style={{ maxWidth: 900 }}>
        <h1>Decks compartilhados</h1>
        <p className="muted">Carregando…</p>
      </main>
    );
  }

  if (!canShare) {
    return (
      <main className="page" style={{ maxWidth: 720 }}>
        <h1>Decks compartilhados</h1>
        <div className="card" style={{ marginTop: 16 }}>
          <p>
            Compartilhar bancos de questões ao vivo entre usuários é
            uma feature exclusiva do plano <strong>Pro</strong>.
          </p>
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            Pro permite criar decks selecionando questões do seu banco
            e dar acesso a colegas por email. Eles veem em tempo real
            (read-only). Quando você revoga, o estado final fica
            preservado pra eles continuarem estudando.
          </p>
          <Link href="/planos">
            <button type="button" className="primary">
              Ver planos →
            </button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page" style={{ maxWidth: 900 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ margin: '0 0 4px' }}>Decks compartilhados</h1>
          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            Gerencie acessos ao vivo a subconjuntos das suas questões.
            Pra criar novos, vá em /banco, selecione e use “Compartilhar”.
          </p>
        </div>
        <Link href="/banco">
          <button type="button">+ Criar a partir de /banco</button>
        </Link>
      </header>

      <section style={{ marginTop: 14 }}>
        <h2 style={{ fontSize: '1.1rem' }}>Meus decks ({own.length})</h2>
        {own.length === 0 ? (
          <div
            className="card"
            style={{ padding: 18, textAlign: 'center', color: 'var(--muted)' }}
          >
            Você ainda não criou nenhum deck ao vivo. Vá em{' '}
            <Link href="/banco" style={{ color: 'var(--primary)' }}>
              /banco
            </Link>
            , selecione algumas questões e use o botão Compartilhar pra
            gerar um link público (snapshot) ou pra criar um deck ao
            vivo aqui.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {own.map((deck) => (
              <li key={deck.id} className="card" style={{ marginBottom: 10 }}>
                <div
                  className="row between"
                  style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <strong>{deck.name}</strong>
                    {deck.description && (
                      <div
                        className="muted"
                        style={{ fontSize: '0.82rem', marginTop: 2 }}
                      >
                        {deck.description}
                      </div>
                    )}
                    <div
                      className="muted"
                      style={{ fontSize: '0.78rem', marginTop: 4 }}
                    >
                      Criado em{' '}
                      {new Date(deck.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleExpand(deck.id)}
                    aria-expanded={expandedDeck === deck.id}
                  >
                    {expandedDeck === deck.id ? 'Fechar' : 'Gerenciar acessos'}
                  </button>
                </div>

                {expandedDeck === deck.id && (
                  <DeckGrantsManager
                    deckId={deck.id}
                    grants={grants[deck.id] ?? []}
                    onChange={() => {
                      setGrants((g) => {
                        const copy = { ...g };
                        delete copy[deck.id];
                        return copy;
                      });
                      void loadGrants(deck.id);
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: '1.1rem' }}>
          Recebidos ({received.length})
        </h2>
        {received.length === 0 ? (
          <p
            className="muted"
            style={{ fontSize: '0.88rem', marginTop: 6 }}
          >
            Ninguém compartilhou um deck ao vivo com você ainda. Quando
            isso acontecer, aparecerá aqui.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {received.map((g) => (
              <li key={g.id} className="card" style={{ marginBottom: 10 }}>
                <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <strong>{g.live_decks?.name ?? '(deck sem nome)'}</strong>
                    {g.live_decks?.description && (
                      <div className="muted" style={{ fontSize: '0.82rem', marginTop: 2 }}>
                        {g.live_decks.description}
                      </div>
                    )}
                    <div className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                      {g.revoked_at ? (
                        <>
                          Acesso revogado em{' '}
                          {new Date(g.revoked_at).toLocaleDateString('pt-BR')}
                          {g.frozen_share_token && (
                            <>
                              {' · '}
                              <Link
                                href={`/import/${g.frozen_share_token}`}
                                style={{ color: 'var(--primary)' }}
                              >
                                Snapshot final
                              </Link>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          Acesso ativo desde{' '}
                          {new Date(g.created_at).toLocaleDateString('pt-BR')}
                          {' · '}{g.permission === 'read_write' ? 'leitura/edição' : 'só leitura'}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function DeckGrantsManager({
  deckId,
  grants,
  onChange,
}: {
  deckId: string;
  grants: GrantOnDeck[];
  onChange: () => void;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const grant = async () => {
    if (!email.trim() || !email.includes('@')) {
      toast('Informe um email válido.', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/live-decks/${deckId}/grants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = (json as { message?: string } | null)?.message ?? 'Erro';
        toast(msg, 'error');
        setBusy(false);
        return;
      }
      toast('Acesso concedido.', 'success');
      setEmail('');
      onChange();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro de rede', 'error');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (grantId: string, granteeEmail: string) => {
    const ok = await confirmDialog({
      title: 'Revogar acesso?',
      message: `Remover acesso de ${granteeEmail} a este deck? Um snapshot final do estado atual será preservado pra essa pessoa continuar com leitura.`,
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(
        `/api/live-decks/${deckId}/grants/${grantId}`,
        { method: 'DELETE' }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast((json as { message?: string } | null)?.message ?? 'Erro', 'error');
        return;
      }
      toast('Acesso revogado. Snapshot final preservado.', 'success');
      onChange();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error');
    }
  };

  const ativos = grants.filter((g) => !g.revoked_at);
  const revogados = grants.filter((g) => g.revoked_at);

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <h3 style={{ fontSize: '0.95rem', margin: '0 0 8px' }}>Conceder acesso</h3>
      <div className="row gap" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@dominio.com"
          aria-label="Email do destinatário"
          style={{ flex: 1, minWidth: 200 }}
        />
        <button
          type="button"
          className="primary"
          onClick={grant}
          disabled={busy || !email.trim()}
        >
          {busy ? 'Concedendo…' : 'Conceder'}
        </button>
      </div>
      <p className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
        Se o email ainda não tem conta, fica reservado e ativa quando a
        pessoa criar conta com esse mesmo email.
      </p>

      {ativos.length > 0 && (
        <>
          <h3 style={{ fontSize: '0.95rem', margin: '14px 0 6px' }}>
            Acessos ativos ({ativos.length})
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {ativos.map((g) => (
              <li
                key={g.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '0.88rem',
                }}
              >
                <span>
                  <code>{g.grantee_email}</code>
                  {!g.grantee_user_id && (
                    <span
                      className="muted"
                      style={{ marginLeft: 6, fontSize: '0.78rem' }}
                    >
                      (aguardando signup)
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => revoke(g.id, g.grantee_email)}
                  style={{ padding: '2px 8px', fontSize: '0.82rem' }}
                >
                  Revogar
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {revogados.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary className="muted" style={{ cursor: 'pointer', fontSize: '0.82rem' }}>
            Revogados ({revogados.length})
          </summary>
          <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', fontSize: '0.82rem' }}>
            {revogados.map((g) => (
              <li key={g.id} className="muted" style={{ padding: '3px 0' }}>
                <code>{g.grantee_email}</code> · revogado em{' '}
                {g.revoked_at &&
                  new Date(g.revoked_at).toLocaleDateString('pt-BR')}
                {g.frozen_share_token && (
                  <>
                    {' · '}
                    snapshot{' '}
                    <Link
                      href={`/import/${g.frozen_share_token}`}
                      style={{ color: 'var(--primary)' }}
                    >
                      visualizar
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
