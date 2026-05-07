'use client';

import { useEffect, useState } from 'react';

type ToastKind = 'success' | 'error' | 'warn' | '';
type ToastAction = { label: string; onClick: () => void };
type ToastItem = {
  id: number;
  msg: string;
  kind: ToastKind;
  ms: number;
  action?: ToastAction;
};

let counter = 0;
const listeners = new Set<(t: ToastItem) => void>();
// Buffer pra toasts disparados antes do ToastHost montar (ex.: sync que
// avisa duplicatas durante o boot do app — som senão se perdia).
const pending: ToastItem[] = [];

const DEFAULT_MS: Record<ToastKind, number> = {
  '': 3500,
  success: 3500,
  warn: 6000,
  error: 8000,
};

export function toast(
  msg: string,
  kind: ToastKind = '',
  ms?: number,
  action?: ToastAction
) {
  const item: ToastItem = {
    id: ++counter,
    msg,
    kind,
    // Toasts com ação ficam mais tempo (user precisa decidir)
    ms: ms ?? (action ? 8000 : DEFAULT_MS[kind] ?? 3500),
    action,
  };
  if (listeners.size === 0) {
    // Sem host montado — segura na fila e drena no primeiro listener
    pending.push(item);
    return;
  }
  listeners.forEach((l) => l(item));
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (item: ToastItem) => {
      setItems((cur) => [...cur, item]);
      if (item.ms > 0) {
        setTimeout(() => {
          setItems((cur) => cur.filter((i) => i.id !== item.id));
        }, item.ms);
      }
    };
    listeners.add(onToast);
    // Drena fila acumulada antes do mount
    if (pending.length) {
      const buffered = pending.splice(0, pending.length);
      buffered.forEach((t) => onToast(t));
    }
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  const dismiss = (id: number) => {
    setItems((cur) => cur.filter((i) => i.id !== id));
  };

  // 2 regiões aria-live separadas: polite (info/success) e assertive
  // (error/warn). Screen readers anunciam erros imediatamente; info
  // espera idle. Sem isso tudo virava polite e erros podiam ser perdidos
  // ou anunciados depois de algo importante.
  const polite = items.filter((t) => t.kind !== 'error' && t.kind !== 'warn');
  const assertive = items.filter(
    (t) => t.kind === 'error' || t.kind === 'warn'
  );

  const renderToast = (t: ToastItem) => (
    <div
      key={t.id}
      className={'toast ' + (t.kind || '')}
      onClick={() => dismiss(t.id)}
      role={t.kind === 'error' || t.kind === 'warn' ? 'alert' : 'status'}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
          e.preventDefault();
          dismiss(t.id);
        }
      }}
      aria-label={`${labelFor(t.kind)}: ${t.msg}. Pressione Enter ou Espaço para dispensar.`}
      title="Clique ou pressione Enter para dispensar"
      style={{ cursor: 'pointer' }}
    >
      <span aria-hidden style={{ fontSize: '1.1em', flexShrink: 0 }}>
        {iconFor(t.kind)}
      </span>
      <span style={{ flex: 1 }}>{t.msg}</span>
      {t.action && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            t.action!.onClick();
            dismiss(t.id);
          }}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid currentColor',
            color: 'inherit',
            padding: '3px 10px',
            borderRadius: 6,
            fontWeight: 600,
            fontSize: '0.85em',
            cursor: 'pointer',
            marginLeft: 8,
            whiteSpace: 'nowrap',
          }}
        >
          {t.action.label}
        </button>
      )}
      <span
        aria-hidden
        style={{
          opacity: 0.6,
          fontSize: '0.85em',
          marginLeft: 10,
          fontWeight: 600,
        }}
      >
        ×
      </span>
    </div>
  );

  return (
    <>
      <div
        className="toast-stack"
        aria-live="polite"
        aria-atomic="false"
        role="region"
        aria-label="Notificações"
      >
        {polite.map(renderToast)}
      </div>
      <div
        className="toast-stack toast-stack-assertive"
        aria-live="assertive"
        aria-atomic="false"
        role="region"
        aria-label="Alertas"
      >
        {assertive.map(renderToast)}
      </div>
    </>
  );
}

function labelFor(kind: ToastKind): string {
  if (kind === 'success') return 'Sucesso';
  if (kind === 'error') return 'Erro';
  if (kind === 'warn') return 'Atenção';
  return 'Informação';
}

function iconFor(kind: ToastKind): string {
  if (kind === 'success') return '✓';
  if (kind === 'error') return '⚠';
  if (kind === 'warn') return '⚠';
  return 'ℹ';
}
