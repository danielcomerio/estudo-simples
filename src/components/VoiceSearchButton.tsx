'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from './Toast';

/**
 * Botão de busca por voz usando Web Speech API. Captura áudio do
 * microfone, transcreve em pt-BR, dispara `onTranscript` com o texto.
 *
 * Suporte: Chrome/Edge/Safari (webkit). Firefox NÃO suporta.
 * Permissão de microfone solicitada na primeira vez.
 *
 * No-op silencioso em browsers sem suporte (botão não aparece).
 */

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{
    0: { transcript: string };
    isFinal: boolean;
    length: number;
  }>;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: ((e: Event) => void) | null;
  onend: ((e: Event) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceSearchButton({
  onTranscript,
}: {
  onTranscript: (text: string) => void;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recogRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    setSupported(getRecognition() !== null);
  }, []);

  useEffect(
    () => () => {
      try {
        recogRef.current?.stop();
      } catch {}
    },
    []
  );

  if (!supported) return null;

  const start = () => {
    const Ctor = getRecognition();
    if (!Ctor) return;
    try {
      const r = new Ctor();
      r.continuous = false;
      r.interimResults = false;
      r.lang = 'pt-BR';
      r.onstart = () => setListening(true);
      r.onend = () => {
        setListening(false);
        recogRef.current = null;
      };
      r.onerror = (e) => {
        setListening(false);
        recogRef.current = null;
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          toast('Permissão de microfone negada', 'error');
        } else if (e.error === 'no-speech') {
          toast('Não captei nada — tente de novo', 'warn');
        } else {
          toast(`Erro: ${e.error}`, 'error');
        }
      };
      r.onresult = (event) => {
        const idx = event.resultIndex;
        const result = event.results[idx];
        if (result?.[0]?.transcript) {
          onTranscript(result[0].transcript.trim());
        }
      };
      recogRef.current = r;
      r.start();
    } catch (e) {
      toast(
        'Não consegui iniciar reconhecimento de voz: ' +
          (e instanceof Error ? e.message : 'erro'),
        'error'
      );
    }
  };

  const stop = () => {
    try {
      recogRef.current?.stop();
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      title={listening ? 'Parar' : 'Buscar por voz'}
      aria-label={listening ? 'Parar busca por voz' : 'Buscar por voz'}
      className="ghost icon"
      style={{
        color: listening ? 'var(--danger)' : undefined,
        padding: '6px 10px',
        position: 'relative',
      }}
    >
      {listening ? '🔴' : '🎤'}
      {listening && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 6,
            border: '2px solid var(--danger)',
            animation: 'voice-pulse 1.2s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
      )}
    </button>
  );
}
