'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from './Toast';

const STORAGE_KEY = 'estudo-simples:pending-import';

/**
 * Captura drop de arquivos JSON em qualquer página. Em /banco a
 * ImportZone tem sua própria área e prevalece — aqui só interceptamos
 * as outras rotas.
 *
 * Fluxo: drop → lê arquivos como texto → serializa em sessionStorage
 * → navega pra /banco. ImportZone observa essa chave e dispara o
 * preview multi-file.
 */
export function GlobalDropZone() {
  const pathname = usePathname();
  const router = useRouter();
  const [over, setOver] = useState(false);
  const isBanco = pathname?.startsWith('/banco');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isBanco) return; // deixa ImportZone tratar localmente

    const isFileDrag = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes('Files');

    const onOver = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      setOver(true);
    };
    const onLeave = (e: DragEvent) => {
      // Só desliga quando arrastar pra fora da window inteira
      if (
        e.clientX <= 0 ||
        e.clientY <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
      ) {
        setOver(false);
      }
    };
    const onDrop = async (e: DragEvent) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      setOver(false);
      const arr = Array.from(e.dataTransfer.files).filter(
        (f) =>
          f.name.toLowerCase().endsWith('.json') || /json/i.test(f.type)
      );
      if (!arr.length) {
        toast('Solte um ou mais arquivos .json', 'warn');
        return;
      }
      try {
        const contents = await Promise.all(
          arr.map(async (f) => ({ name: f.name, text: await f.text() }))
        );
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(contents));
        toast(
          `Levando ${contents.length} arquivo(s) pro /banco…`,
          'success'
        );
        router.push('/banco');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast('Falha ao ler arquivos: ' + msg, 'error');
      }
    };

    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [isBanco, router]);

  if (!over || isBanco) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        background: 'rgba(34, 197, 94, 0.10)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          padding: 26,
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-elev)',
          border: '2px dashed var(--primary)',
          textAlign: 'center',
          boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: 6 }}>📥</div>
        <strong style={{ fontSize: '1.1rem' }}>
          Solte pra importar no /banco
        </strong>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.9rem' }}>
          Aceita .json (autoral ou real)
        </p>
      </div>
    </div>
  );
}
