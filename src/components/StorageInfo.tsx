'use client';

import { useEffect, useState } from 'react';
import { useStore, selectActiveQuestions } from '@/lib/store';

/**
 * Mostra info sobre uso de armazenamento local. Útil pra user grande
 * (1k+ questões) saber se está se aproximando do limite. Inclui:
 *  - Total de questões
 *  - Estimate de IDB usage (via navigator.storage.estimate, se
 *    disponível)
 */
export function StorageInfo() {
  const questions = useStore(selectActiveQuestions);
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(
    null
  );

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return;
    navigator.storage
      .estimate()
      .then((e) => {
        if (typeof e.usage === 'number' && typeof e.quota === 'number') {
          setEstimate({ usage: e.usage, quota: e.quota });
        }
      })
      .catch(() => {
        // unsupported; deixa null
      });
  }, []);

  const fmtMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(1) + ' MB';

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px' }}>📊 Uso de armazenamento</h2>
      <ul
        className="muted"
        style={{
          margin: 0,
          paddingLeft: 18,
          fontSize: '0.88rem',
          lineHeight: 1.7,
        }}
      >
        <li>
          Questões ativas: <strong>{questions.length}</strong>
        </li>
        {estimate && (
          <>
            <li>
              IDB local: <strong>{fmtMB(estimate.usage)}</strong> de{' '}
              {fmtMB(estimate.quota)} disponíveis (
              {Math.round((estimate.usage / estimate.quota) * 100)}%)
            </li>
            {estimate.usage / estimate.quota > 0.8 && (
              <li style={{ color: 'var(--warn, #d97706)' }}>
                ⚠️ Acima de 80% do quota — considere fazer backup.
              </li>
            )}
          </>
        )}
        {!estimate && (
          <li>Estimate de quota não disponível neste navegador.</li>
        )}
      </ul>
    </div>
  );
}
