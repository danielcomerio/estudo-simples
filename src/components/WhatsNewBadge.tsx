'use client';

import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import {
  WHATS_NEW,
  hasUnseenChanges,
  markVersionSeen,
} from '@/lib/whats-new';

export function WhatsNewBadge() {
  const [hasNew, setHasNew] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setHasNew(hasUnseenChanges());
  }, []);

  function handleOpen() {
    setOpen(true);
    markVersionSeen();
    setHasNew(false);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        title="Novidades do app"
        aria-label="Novidades"
        style={{
          position: 'relative',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 6,
          fontSize: '1.1rem',
          lineHeight: 1,
          color: 'var(--text)',
        }}
      >
        🎁
        {hasNew && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#ef4444',
              boxShadow: '0 0 0 2px var(--bg)',
            }}
          />
        )}
      </button>
      {open && <WhatsNewModal onClose={() => setOpen(false)} />}
    </>
  );
}

function WhatsNewModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} ariaLabel="Novidades" maxWidth={540}>
      <div className="row between" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>🎁 Novidades</h2>
        <button onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </div>
      {WHATS_NEW.map((entry) => (
        <div key={entry.version} style={{ marginBottom: 18 }}>
          <h3
            style={{
              margin: '0 0 4px',
              fontSize: '0.95rem',
              color: 'var(--primary)',
            }}
          >
            {entry.version} · {entry.date}
          </h3>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
            {entry.highlights.map((h, i) => (
              <li key={i} style={{ fontSize: '0.9rem' }}>
                {h}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p
        className="muted"
        style={{ fontSize: '0.78rem', marginTop: 14, marginBottom: 0 }}
      >
        Histórico completo em CHANGELOG.md no repositório.
      </p>
    </Modal>
  );
}
