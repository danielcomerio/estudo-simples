'use client';

import { useEffect, useRef, useState } from 'react';
import type { Question } from '@/lib/types';

/**
 * Modo podcast: TTS lê N questões em sequência (enunciado → resposta →
 * explicação → próxima). Pra estudar caminhando, dirigindo, etc.
 *
 * Estado UI: 4 modos
 *  - idle: botão "Iniciar podcast"
 *  - playing: tocando, botões pausar/parar/skip
 *  - paused
 *  - done: terminou
 *
 * Não usa audio file — usa Web Speech Synthesis com voz pt-BR.
 */
function cleanForTTS(text: string): string {
  return text
    .replace(/\$\$[\s\S]*?\$\$/g, '')
    .replace(/\$[^$]*?\$/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*?`/g, '')
    .replace(/[*_~]+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function PodcastModeButton({
  questions,
  label = '🎧 Modo podcast',
}: {
  questions: Question[];
  label?: string;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<'idle' | 'playing' | 'paused' | 'done'>(
    'idle'
  );
  const [idx, setIdx] = useState(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' && 'speechSynthesis' in window
    );
  }, []);

  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, []);

  if (supported === false) return null;

  const start = () => {
    if (questions.length === 0) return;
    setPhase('playing');
    setIdx(0);
    speakQuestion(0);
  };

  const speakQuestion = (i: number) => {
    if (i >= questions.length) {
      setPhase('done');
      return;
    }
    const q = questions[i];
    const p = q.payload as {
      enunciado?: string;
      frente?: string;
      verso?: string;
      texto?: string;
      explicacao?: string;
      explicacao_geral?: string;
      alternativas?: Array<{ letra: string; texto: string; correta?: boolean }>;
    };
    const lines: string[] = [];
    lines.push(`Questão ${i + 1} de ${questions.length}.`);
    if (p.enunciado) lines.push(p.enunciado);
    else if (p.frente) lines.push(p.frente);
    else if (p.texto) lines.push(p.texto);
    if (Array.isArray(p.alternativas)) {
      for (const a of p.alternativas) lines.push(`Letra ${a.letra}: ${a.texto}`);
      const cor = p.alternativas.find((a) => a.correta);
      if (cor) lines.push(`Resposta correta: letra ${cor.letra}.`);
    }
    if (p.verso) lines.push(`Resposta: ${p.verso}`);
    if (p.explicacao_geral) lines.push(p.explicacao_geral);
    else if (p.explicacao) lines.push(p.explicacao);

    const utter = new SpeechSynthesisUtterance(cleanForTTS(lines.join('. ')));
    utter.lang = 'pt-BR';
    utter.rate = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const ptBr = voices.find((v) => v.lang.startsWith('pt'));
    if (ptBr) utter.voice = ptBr;
    utter.onend = () => {
      setIdx(i + 1);
      speakQuestion(i + 1);
    };
    utter.onerror = () => {
      setPhase('idle');
    };
    utteranceRef.current = utter;
    window.speechSynthesis.speak(utter);
  };

  const pause = () => {
    window.speechSynthesis.pause();
    setPhase('paused');
  };
  const resume = () => {
    window.speechSynthesis.resume();
    setPhase('playing');
  };
  const stop = () => {
    window.speechSynthesis.cancel();
    setPhase('idle');
    setIdx(0);
  };
  const skip = () => {
    window.speechSynthesis.cancel();
    speakQuestion(idx + 1);
  };

  if (phase === 'idle') {
    return (
      <button
        type="button"
        onClick={start}
        title={`Lê ${questions.length} questões em voz alta. Pra estudar hands-free.`}
        style={{ padding: '6px 12px', fontSize: '0.85rem' }}
        disabled={questions.length === 0}
      >
        {label} ({questions.length})
      </button>
    );
  }

  if (phase === 'done') {
    return (
      <button
        type="button"
        onClick={start}
        style={{ padding: '6px 12px', fontSize: '0.85rem' }}
      >
        🎧 Repetir podcast
      </button>
    );
  }

  return (
    <div className="row gap" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
      <span className="muted" style={{ fontSize: '0.85rem' }}>
        🎧 {idx + 1}/{questions.length}
      </span>
      {phase === 'playing' ? (
        <button type="button" className="ghost" onClick={pause} style={{ padding: '4px 10px', fontSize: '0.82rem' }}>
          ⏸ Pausar
        </button>
      ) : (
        <button type="button" className="primary" onClick={resume} style={{ padding: '4px 10px', fontSize: '0.82rem' }}>
          ▶ Resumir
        </button>
      )}
      <button type="button" className="ghost" onClick={skip} style={{ padding: '4px 10px', fontSize: '0.82rem' }}>
        ⏭ Próxima
      </button>
      <button type="button" className="ghost" onClick={stop} style={{ padding: '4px 10px', fontSize: '0.82rem' }}>
        ⏹ Parar
      </button>
    </div>
  );
}
