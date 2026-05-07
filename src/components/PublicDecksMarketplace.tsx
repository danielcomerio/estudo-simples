'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from './Toast';

type PublicDeck = {
  token: string;
  owner_display: string;
  title: string | null;
  description: string | null;
  category: string | null;
  question_count: number;
  created_at: string;
  access_count: number;
};

/**
 * Marketplace público de decks (Fase C4 — extensão de C2).
 * Lista decks que owners marcaram como `is_public=true`. Click → leva
 * pra /import/[token] (mesma rota de C2; user importa cópia pra si).
 *
 * Filtro de busca client-side simples + server-side via ?q=.
 */
export function PublicDecksMarketplace() {
  const [decks, setDecks] = useState<PublicDeck[] | null>(null);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = async (search: string) => {
    setLoading(true);
    try {
      const url = search
        ? `/api/decks-publicos?q=${encodeURIComponent(search)}`
        : '/api/decks-publicos';
      const res = await fetch(url);
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast('Erro carregando decks públicos.', 'error');
        setLoading(false);
        return;
      }
      setDecks((json as { decks: PublicDeck[] }).decks ?? []);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload('');
  }, []);

  return (
    <main className="page" style={{ maxWidth: 900 }}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ margin: '0 0 4px' }}>📚 Decks públicos</h1>
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          Decks compartilhados pela comunidade. Importe pra sua conta —
          cada questão vira cópia sua.
        </p>
      </header>

      <div className="row gap" style={{ marginBottom: 14 }}>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void reload(q);
          }}
          placeholder="Buscar por título ou descrição…"
          aria-label="Buscar decks públicos"
          style={{ flex: 1 }}
        />
        <button type="button" onClick={() => void reload(q)}>
          Buscar
        </button>
      </div>

      {loading && (
        <p className="muted" style={{ textAlign: 'center', marginTop: 20 }}>
          Carregando…
        </p>
      )}

      {!loading && decks?.length === 0 && (
        <div
          className="card"
          style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}
        >
          {q
            ? `Nenhum deck encontrado pra "${q}".`
            : 'Nenhum deck público disponível ainda. Seja o primeiro a publicar — vá em /banco, selecione questões, compartilhe e marque como público.'}
        </div>
      )}

      {!loading && decks && decks.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {decks.map((deck) => (
            <li key={deck.token} className="card" style={{ marginBottom: 10 }}>
              <div className="row between" style={{ gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <Link
                    href={`/import/${deck.token}`}
                    style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: 'var(--primary)',
                      textDecoration: 'none',
                    }}
                  >
                    {deck.title || 'Deck sem nome'}
                  </Link>
                  {deck.description && (
                    <p
                      className="muted"
                      style={{
                        fontSize: '0.85rem',
                        margin: '4px 0',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {deck.description}
                    </p>
                  )}
                  <div
                    className="muted"
                    style={{
                      fontSize: '0.78rem',
                      display: 'flex',
                      gap: 12,
                      flexWrap: 'wrap',
                      marginTop: 4,
                    }}
                  >
                    <span>📊 {deck.question_count} questões</span>
                    <span>👥 {deck.access_count} importações</span>
                    <span>👤 {deck.owner_display}</span>
                    {deck.category && (
                      <span
                        style={{
                          padding: '0 6px',
                          background: 'var(--bg-elev-2)',
                          borderRadius: 4,
                        }}
                      >
                        {deck.category}
                      </span>
                    )}
                  </div>
                </div>
                <Link href={`/import/${deck.token}`}>
                  <button type="button">📥 Ver e importar</button>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
