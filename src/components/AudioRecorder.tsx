'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from './Toast';

/**
 * Gravador de áudio simples (MediaRecorder API). Útil pra discursivas
 * praticarem oratoriamente — gravar resposta falada e ouvir depois
 * antes de revelar o espelho.
 *
 * Áudio fica em blob URL — não persiste após sessão. Privacidade
 * total: nunca sai do navegador.
 *
 * Suporte: Chrome/Firefox/Safari/Edge modernos. Fallback no-op
 * em navegadores antigos.
 */
export function AudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === 'recording') {
        try {
          recorderRef.current.stop();
        } catch {}
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const supported =
    typeof window !== 'undefined' &&
    'MediaRecorder' in window &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  if (!supported) return null;

  const start = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: chunksRef.current[0]?.type || 'audio/webm',
        });
        // Revoga URL anterior pra não vazar memória
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        // Para todos os tracks pra liberar mic
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setDuration(0);
      intervalRef.current = setInterval(() => {
        setDuration(
          Math.floor((Date.now() - startTimeRef.current) / 1000)
        );
      }, 250);
      setRecording(true);
    } catch (e) {
      toast(
        'Permissão de microfone negada — habilite nas configurações do navegador',
        'error'
      );
      console.error(e);
    }
  };

  const stop = () => {
    const r = recorderRef.current;
    if (!r) return;
    if (r.state === 'recording') r.stop();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRecording(false);
    recorderRef.current = null;
  };

  const reset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDuration(0);
  };

  const fmtDur = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
      }}
    >
      <div
        className="row gap"
        style={{ alignItems: 'center', flexWrap: 'wrap' }}
      >
        {!recording && !audioUrl && (
          <button
            type="button"
            className="ghost"
            onClick={() => void start()}
            title="Praticar oratoriamente — grava só localmente, não sai do navegador"
            style={{ padding: '6px 12px' }}
          >
            🎙 Gravar resposta falada
          </button>
        )}
        {recording && (
          <>
            <span
              style={{
                color: 'var(--danger)',
                fontWeight: 500,
                fontVariantNumeric: 'tabular-nums',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--danger)',
                  animation: 'pulse 1.2s infinite',
                }}
              />
              {fmtDur(duration)}
            </span>
            <button
              type="button"
              className="danger"
              onClick={stop}
              style={{ padding: '6px 12px' }}
            >
              ⏹ Parar
            </button>
          </>
        )}
        {!recording && audioUrl && (
          <>
            <audio
              src={audioUrl}
              controls
              style={{ flex: '1 1 200px', maxWidth: '100%', minWidth: 200 }}
              preload="metadata"
            />
            <button
              type="button"
              className="ghost"
              onClick={reset}
              title="Apagar gravação e gravar de novo"
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            >
              🔄 Re-gravar
            </button>
          </>
        )}
      </div>
      <p
        className="muted"
        style={{ margin: '8px 0 0', fontSize: '0.78rem' }}
      >
        Áudio fica só neste navegador, não sai daqui. Não persiste após
        fechar a sessão.
      </p>
    </div>
  );
}
