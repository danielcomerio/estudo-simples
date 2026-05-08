'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Edital = {
  id: string;
  title: string;
  link: string;
  region: string | null;
  area: string | null;
  pub_date: string | null;
  fetched_at: string;
};

type Prefs = {
  regions: string[];
  areas: string[];
  enabled: boolean;
};

const REGION_LABEL: Record<string, string> = {
  BR: '🇧🇷 Federal',
};

/**
 * Card no Dashboard mostrando últimos editais ativos. Filtra pelas
 * preferências do user (se setadas). Sempre mostra link discreto pra
 * gerenciar prefs.
 *
 * Disclaimer: dados vêm de fonte externa (PCI Concursos), atualizados
 * 1×/dia via cron.
 */
export function EditaisCard() {
  const [items, setItems] = useState<Edital[] | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [hasPrefs, setHasPrefs] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Busca prefs primeiro pra montar query
      const prefsRes = await fetch('/api/editais/preferences')
        .then((r) => r.json())
        .catch(() => null);
      if (cancelled) return;
      const prefs = (prefsRes?.prefs ?? null) as Prefs | null;
      setEnabled(prefs?.enabled ?? true);
      setHasPrefs(
        !!(prefs && (prefs.regions.length > 0 || prefs.areas.length > 0))
      );

      if (prefs && prefs.enabled === false) {
        setItems([]);
        return;
      }

      const params = new URLSearchParams();
      if (prefs?.regions?.length) params.set('regions', prefs.regions.join(','));
      if (prefs?.areas?.length) params.set('areas', prefs.areas.join(','));
      params.set('limit', '5');

      const r = await fetch(`/api/editais/list?${params.toString()}`)
        .then((r) => r.json())
        .catch(() => null);
      if (cancelled) return;
      setItems((r?.items ?? []) as Edital[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (enabled === false) return null; // user desativou

  if (items === null) {
    return (
      <div className="card">
        <h2 style={{ margin: '0 0 8px' }}>📋 Editais ativos</h2>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Carregando…
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div
        className="row between"
        style={{ alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}
      >
        <h2 style={{ margin: 0 }}>📋 Editais ativos</h2>
        <Link
          href="/configuracoes#editais"
          className="muted"
          style={{ fontSize: '0.78rem' }}
        >
          {hasPrefs ? '⚙ ajustar filtros' : '⚙ filtrar por área/região'}
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
          {hasPrefs
            ? 'Nenhum edital corresponde aos seus filtros.'
            : 'Sem editais cacheados ainda. Aguarde o próximo refresh (1×/dia).'}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 8px' }}>
          {items.map((e) => (
            <li
              key={e.id}
              style={{
                padding: '8px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <a
                href={e.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '0.92rem',
                  color: 'var(--primary)',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                {e.title}
              </a>
              <div
                className="muted"
                style={{
                  fontSize: '0.74rem',
                  marginTop: 2,
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                {e.region && (
                  <span
                    style={{
                      padding: '0 6px',
                      background: 'var(--bg-elev-2)',
                      borderRadius: 3,
                    }}
                  >
                    {REGION_LABEL[e.region] ?? e.region}
                  </span>
                )}
                {e.area && (
                  <span
                    style={{
                      padding: '0 6px',
                      background: 'var(--bg-elev-2)',
                      borderRadius: 3,
                    }}
                  >
                    {e.area}
                  </span>
                )}
                {e.pub_date && (
                  <span>
                    {new Date(e.pub_date).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="muted" style={{ fontSize: '0.7rem', margin: '6px 0 0' }}>
        Fonte: PCI Concursos · cache atualizado 1×/dia
      </p>
    </div>
  );
}
