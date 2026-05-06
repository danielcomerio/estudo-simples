import katex from 'katex';

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback (não cripto): suficiente como id local
  return (
    'q_' +
    Date.now().toString(36) +
    '_' +
    Math.random().toString(36).slice(2, 11)
  );
}

export function escapeHtml(s: unknown): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renderiza string em HTML, em ordem:
 *  1. Blocos ```...``` viram <pre> (escapados)
 *  2. Resto vira escapeHtml + \n -> <br>
 *
 * Versão leve, sem KaTeX. Use renderRichText pra detecção automática
 * de math.
 */
/**
 * Aplica markdown básico em uma string já escapada (sem tags HTML
 * "vivas"). Suporta:
 *  - **bold** → <strong>
 *  - *italic* (não confunde com **) → <em>
 *  - `code` inline → <code>
 *  - linhas iniciadas com "- " ou "* " → <li> agrupadas em <ul>
 *
 * Mantém-se conservador pra não bagunçar enunciados que usam asteriscos
 * literalmente (ex: 5 * 3 = 15 — não vira itálico porque tem espaço dos
 * dois lados antes/depois do delimitador interno).
 */
function applyBasicMarkdown(escaped: string): string {
  let out = escaped;
  // Code inline (antes de bold/italic pra não conflitar)
  out = out.replace(/`([^`\n<]+?)`/g, '<code>$1</code>');
  // Bold: **text**
  out = out.replace(/\*\*([^*<\n]+?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text* (não em conjunto com **). Requer não-espaço antes do *.
  out = out.replace(/(^|[^*])\*([^*<\n\s][^*<\n]*?)\*(?!\*)/g, '$1<em>$2</em>');
  return out;
}

export function renderTextWithCode(s: unknown): string {
  if (s == null) return '';
  const parts = String(s).split(/```([\s\S]*?)```/g);
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      const escaped = escapeHtml(parts[i]).replace(/\n/g, '<br>');
      out += applyBasicMarkdown(escaped);
    } else {
      const inner = parts[i].replace(/^[a-z]*\n/i, '');
      out += `<pre>${escapeHtml(inner)}</pre>`;
    }
  }
  return out;
}

/**
 * Detecta se uma string contém marcadores de LaTeX. Útil pra decidir
 * se vale carregar KaTeX (caro) — se a questão não tem math, usa o
 * renderer simples.
 *
 * Reconhece: $...$ inline e $$...$$ display.
 */
export function hasMath(s: unknown): boolean {
  if (s == null) return false;
  const text = String(s);
  if (/\$\$[\s\S]+?\$\$/.test(text)) return true;
  if (/(?<!\\)\$[^\s$][^\n$]*?(?<!\\)\$/.test(text)) return true;
  return false;
}

/**
 * Renderiza string com code blocks + LaTeX (KaTeX) + line breaks.
 * Erros de parse de LaTeX viram texto literal escapado em vez de
 * quebrar a página (KaTeX `throwOnError: false`).
 */
export function renderTextWithCodeAndMath(s: unknown): string {
  if (s == null) return '';
  const text = String(s);

  // Extrai code blocks primeiro (placeholder), depois math, processa o resto
  const codeBlocks: string[] = [];
  const withCodePlaceholders = text.replace(/```([\s\S]*?)```/g, (_m, inner) => {
    const cleaned = String(inner).replace(/^[a-z]*\n/i, '');
    codeBlocks.push(`<pre>${escapeHtml(cleaned)}</pre>`);
    return ` CODE${codeBlocks.length - 1} `;
  });

  const mathBlocks: string[] = [];
  const renderMath = (latex: string, displayMode: boolean): string => {
    try {
      return katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
        output: 'html',
        strict: 'ignore',
      });
    } catch {
      return escapeHtml(
        (displayMode ? '$$' : '$') + latex + (displayMode ? '$$' : '$')
      );
    }
  };

  const withDisplayMath = withCodePlaceholders.replace(
    /\$\$([\s\S]+?)\$\$/g,
    (_m, latex) => {
      mathBlocks.push(renderMath(latex, true));
      return ` MATH${mathBlocks.length - 1} `;
    }
  );

  const withInlineMath = withDisplayMath.replace(
    /(?<!\\)\$([^\n$]+?)(?<!\\)\$/g,
    (_m, latex) => {
      mathBlocks.push(renderMath(latex, false));
      return ` MATH${mathBlocks.length - 1} `;
    }
  );

  let out = escapeHtml(withInlineMath).replace(/\n/g, '<br>');
  out = applyBasicMarkdown(out);
  out = out.replace(/ CODE(\d+) /g, (_m, idx) => codeBlocks[Number(idx)]);
  out = out.replace(/ MATH(\d+) /g, (_m, idx) => mathBlocks[Number(idx)]);
  return out;
}

/**
 * Helper: usa o renderer com math se a string tiver LaTeX, senão usa
 * o leve. Pra components só importarem uma função.
 */
export function renderRichText(s: unknown): string {
  return hasMath(s) ? renderTextWithCodeAndMath(s) : renderTextWithCode(s);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Intercala items de diferentes grupos pra evitar blocos longos do
 * mesmo grupo. Round-robin ponderado: distribui proporcionalmente
 * ao tamanho de cada grupo, mas mistura.
 *
 * Ex: [P,P,P,P,P,D,D] (5 PT + 2 Dir) com keyFn=disciplina →
 * algo como [P,D,P,P,D,P,P] (Ds distribuídos no meio dos Ps).
 *
 * Pesquisa em educação (Kornell & Bjork 2008, Rohrer 2012) mostra
 * que interleaving de tópicos similares melhora retenção e
 * discriminação versus blocked practice.
 *
 * Mantém ordem RELATIVA dentro de cada grupo (importante pra modos
 * SRS — questões mais vencidas continuam vindo primeiro dentro do
 * grupo).
 */
export function interleaveByGroup<T>(items: T[], keyFn: (item: T) => string): T[] {
  if (items.length <= 1) return items.slice();
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = keyFn(item);
    const arr = groups.get(k);
    if (arr) arr.push(item);
    else groups.set(k, [item]);
  }
  if (groups.size <= 1) return items.slice();

  // Round-robin: a cada passada, pega 1 item de cada grupo.
  // Quando um grupo esvazia, é removido da rotação.
  const queues: T[][] = Array.from(groups.values());
  const out: T[] = [];
  while (queues.length > 0) {
    for (let i = 0; i < queues.length; ) {
      const q = queues[i];
      out.push(q.shift()!);
      if (q.length === 0) {
        queues.splice(i, 1);
      } else {
        i++;
      }
    }
  }
  return out;
}

/**
 * Mistura o pool pra evitar K+ itens difíceis consecutivos. Cognitive
 * load research (Sweller, 1988): blocos longos de alta dificuldade
 * causam fadiga mental e retenção pior. Intercalar fácil/médio/difícil
 * é a base de "desirable difficulty" (Bjork).
 *
 * Implementação: passa pelo array, se detectar K difíceis seguidas,
 * troca a próxima posição com a primeira não-difícil disponível à frente.
 * Estável: questões mantém ordem relativa quando possível.
 *
 * `getDifficulty` retorna 1-5 (1=fácil, 5=difícil). Considera "difícil"
 * se >= 4. Bom default pra K é 3 (3+ difíceis em sequência = pause).
 */
export function mixDifficulty<T>(
  items: T[],
  getDifficulty: (item: T) => number,
  k = 3
): T[] {
  if (items.length <= k) return items.slice();
  const out = items.slice();
  const isHard = (item: T) => getDifficulty(item) >= 4;
  let consec = 0;
  for (let i = 0; i < out.length; i++) {
    if (isHard(out[i])) {
      consec++;
      if (consec >= k) {
        // Procura o próximo não-difícil
        let swap = -1;
        for (let j = i + 1; j < out.length; j++) {
          if (!isHard(out[j])) {
            swap = j;
            break;
          }
        }
        if (swap >= 0) {
          [out[i], out[swap]] = [out[swap], out[i]];
          consec = 0; // out[i] agora é não-difícil
        }
      }
    } else {
      consec = 0;
    }
  }
  return out;
}

export function debounce<T extends (...args: never[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let h: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (h) clearTimeout(h);
    h = setTimeout(() => fn(...args), ms);
  };
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
