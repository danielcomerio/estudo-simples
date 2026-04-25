'use client';

import { useEffect, useRef, useState } from 'react';

type ConfirmRequest = {
  title: string;
  message: string;
  resolve: (v: boolean) => void;
  danger?: boolean;
};

let request: ((r: ConfirmRequest) => void) | null = null;

export function confirmDialog(opts: {
  title: string;
  message: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!request) {
      // fallback: alerta nativo (improvável, mas blindado)
      resolve(window.confirm(opts.message));
      return;
    }
    request({ ...opts, resolve });
  });
}

export function ConfirmHost() {
  const dlgRef = useRef<HTMLDialogElement>(null);
  const [cur, setCur] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    request = (r) => {
      setCur(r);
      // showModal ocorre no efeito abaixo após o DOM ter o dialog
    };
    return () => {
      request = null;
    };
  }, []);

  useEffect(() => {
    if (cur && dlgRef.current && !dlgRef.current.open) {
      try {
        dlgRef.current.showModal();
      } catch {
        // browsers sem suporte: resolve falso e segue
        cur.resolve(false);
        setCur(null);
      }
    }
  }, [cur]);

  const close = (ok: boolean) => {
    cur?.resolve(ok);
    if (dlgRef.current?.open) dlgRef.current.close();
    setCur(null);
  };

  return (
    <dialog ref={dlgRef} onClose={() => close(false)}>
      <h3>{cur?.title || 'Confirmar'}</h3>
      <p>{cur?.message || ''}</p>
      <div className="row gap right">
        <button type="button" onClick={() => close(false)}>
          Cancelar
        </button>
        <button
          type="button"
          className={cur?.danger ? 'danger' : 'primary'}
          onClick={() => close(true)}
          autoFocus
        >
          Confirmar
        </button>
      </div>
    </dialog>
  );
}
