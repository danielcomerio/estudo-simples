'use client';

/**
 * Gera PNG simples via Canvas API (sem dep externa). Útil pra "story
 * card" compartilhável (Instagram/X).
 *
 * Limitado: não renderiza HTML — só desenha texto + cores em layout
 * fixo. Pra capturar HTML complexo, precisaria html2canvas (~50KB).
 *
 * Uso:
 *   const url = generateProgressCard({
 *     title: 'Meu progresso',
 *     stats: [{ label: '%', value: '78' }, { label: 'questões', value: '342' }],
 *   });
 *   const a = document.createElement('a');
 *   a.href = url; a.download = 'progresso.png'; a.click();
 */

export type ProgressCardOpts = {
  title: string;
  subtitle?: string;
  stats: Array<{ label: string; value: string }>;
  footer?: string;
};

export function generateProgressCardPNG(opts: ProgressCardOpts): string | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  const W = 600;
  const H = 800;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background gradiente
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#22c55e');
  grad.addColorStop(1, '#0e7c3f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = 'white';
  ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  wrapText(ctx, opts.title, W / 2, 80, W - 80, 42);

  // Subtitle
  if (opts.subtitle) {
    ctx.font = '20px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(opts.subtitle, W / 2, 140);
  }

  // Stats grid
  const startY = 220;
  const cellH = 100;
  opts.stats.slice(0, 4).forEach((s, i) => {
    const y = startY + i * cellH;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(60, y, W - 120, cellH - 16);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 48px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(s.value, 80, y + 60);
    ctx.font = '20px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'right';
    ctx.fillText(s.label, W - 80, y + 60);
  });

  // Footer
  ctx.font = '18px system-ui';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'center';
  ctx.fillText(opts.footer ?? 'estudosimples.com.br', W / 2, H - 40);

  return canvas.toDataURL('image/png');
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number
): void {
  const words = text.split(' ');
  let line = '';
  let curY = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, curY);
      line = w;
      curY += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, curY);
}

/** Converte data:image URL em File pra Web Share API. */
export async function dataUrlToFile(dataUrl: string, filename = 'progresso.png'): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: 'image/png' });
}
