'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Botão de microfone com SpeechRecognition (Web Speech API).
 *
 * Captura voz em pt-BR, transcreve, e devolve o texto via onTranscript.
 * Append-friendly: chama onTranscript com o texto FINAL (post-pause)
 * e onInterim com transcript parcial enquanto fala (caller decide
 * se mostra ao vivo).
 *
 * Não suportado em todos browsers (Safari iOS é parcial). Quando não
 * suportado, retorna null (sem botão).
 *
 * Uso:
 *   <MicButton onTranscript={(text) => setInput((cur) => cur + ' ' + text)} />
 */
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: { new (): SpeechRecognitionLike };
    webkitSpeechRecognition?: { new (): SpeechRecognitionLike };
  }
}

function getSR(): { new (): SpeechRecognitionLike } | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function MicButton({
  onTranscript,
  onInterim,
  size = 'sm',
  title = 'Ditar com microfone',
  continuous = false,
}: {
  onTranscript: (text: string) => void;
  onInterim?: (text: string) => void;
  size?: 'sm' | 'md';
  title?: string;
  /** Continuous=true mantém escutando após pausa. Bom pra ditado longo
   *  (redação). False pra mensagens curtas (chat). */
  continuous?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(!!getSR());
  }, []);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  if (!supported) return null;

  const start = () => {
    const SR = getSR();
    if (!SR) return;
    try {
      const rec = new SR();
      rec.lang = 'pt-BR';
      rec.continuous = continuous;
      rec.interimResults = !!onInterim;
      let finalAcc = '';
      rec.onresult = (ev) => {
        const len = ev.results.length;
        let interim = '';
        for (let i = 0; i < len; i++) {
          const r = ev.results[i];
          const t = r[0]?.transcript ?? '';
          if (r.isFinal) finalAcc += (finalAcc ? ' ' : '') + t.trim();
          else interim += t;
        }
        if (interim && onInterim) onInterim(interim.trim());
      };
      rec.onerror = (ev) => {
        // Erros comuns: "no-speech" (silêncio), "aborted" (user cancelou),
        // "not-allowed" (permissão negada). Tratamos só silenciosamente.
        if (ev.error === 'not-allowed') {
          alert(
            'Microfone bloqueado. Habilite a permissão nas configurações do navegador.'
          );
        }
      };
      rec.onend = () => {
        if (finalAcc.trim()) onTranscript(finalAcc.trim());
        setRecording(false);
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setRecording(false);
    }
  };

  const stop = () => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setRecording(false);
  };

  const padding = size === 'sm' ? '4px 8px' : '8px 12px';
  const fontSize = size === 'sm' ? '0.85rem' : '0.95rem';

  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      title={recording ? 'Parar gravação' : title}
      aria-pressed={recording}
      style={{
        padding,
        fontSize,
        background: recording ? 'var(--danger)' : 'var(--bg-elev-2)',
        color: recording ? 'white' : 'var(--text)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {recording ? '⏹' : '🎤'}
    </button>
  );
}
