'use client';

import { useState } from 'react';
import { MicButton } from './MicButton';

/**
 * Captura voz e tenta extrair letra (A/B/C/D/E). Quando user fala
 * "letra A" ou "alternativa B" ou só "C", devolve o letra normalizada
 * via callback. Usado no QuestionRunner pra resposta hands-free.
 *
 * Heurística: pega o primeiro caractere alfabético uppercase entre A-E.
 * Aceita também palavras "alfa, beta..." se necessário no futuro.
 */
function extractLetra(text: string): string | null {
  if (!text) return null;
  const t = text.toUpperCase().trim();
  // Padrões esperados:
  //   "LETRA A", "ALTERNATIVA B", "OPÇÃO C", "É O D", só "E"
  const m = t.match(/\b([A-E])\b/);
  if (m) return m[1];
  // Spoken: "ALFA", "BETA", "GAMA", "DELTA", "ÉPSILON"?
  const wordMap: Record<string, string> = {
    ALFA: 'A',
    BETA: 'B',
    GAMA: 'C',
    GAMMA: 'C',
    DELTA: 'D',
    EPSILON: 'E',
    ÉPSILON: 'E',
  };
  for (const w of Object.keys(wordMap)) {
    if (t.includes(w)) return wordMap[w];
  }
  return null;
}

/** Detecta comando textual além de letras. */
function extractCommand(text: string): 'next' | 'skip' | 'explain' | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/\b(próxima|proxima|next|continua)\b/.test(t)) return 'next';
  if (/\b(pular|skip|passa)\b/.test(t)) return 'skip';
  if (/\b(explica|explicar|explique)\b/.test(t)) return 'explain';
  return null;
}

export function VoiceAnswerButton({
  onLetra,
  onCommand,
}: {
  onLetra: (l: string) => void;
  onCommand?: (c: 'next' | 'skip' | 'explain') => void;
}) {
  const [last, setLast] = useState('');

  return (
    <div className="row gap" style={{ alignItems: 'center', marginTop: 6 }}>
      <MicButton
        size="sm"
        title="Diga a letra (A-E) ou comando: próxima/pular/explica"
        onTranscript={(text) => {
          setLast(text);
          const cmd = extractCommand(text);
          if (cmd && onCommand) {
            onCommand(cmd);
            return;
          }
          const letra = extractLetra(text);
          if (letra) onLetra(letra);
        }}
      />
      {last && (
        <span className="muted" style={{ fontSize: '0.78rem' }}>
          Ouvi: "{last}"
        </span>
      )}
    </div>
  );
}
