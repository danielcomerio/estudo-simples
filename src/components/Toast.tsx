'use client';

import { useEffect, useState } from 'react';

type ToastKind = 'success' | 'error' | 'warn' | '';
type ToastItem = { id: number; msg: string; kind: ToastKind };

let counter = 0;
const listeners = new Set<(t: ToastItem) => void>();

export function toast(msg: string, kind: ToastKind = '', _ms = 3500) {
  const item: ToastItem = { id: ++counter, msg, kind };
  listeners.forEach((l) => l(item));
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (item: ToastItem) => {
      setItems((cur) => [...cur, item]);
      setTimeout(() => {
        setItems((cur) => cur.filter((i) => i.id !== item.id));
      }, 3500);
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  return (
    <div className="toast-stack" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={'toast ' + (t.kind || '')}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
