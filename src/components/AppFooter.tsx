'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Footer compacto pro app autenticado. Aparece em rotas de leitura/
 * navegação (Painel, /banco, /stats, /conquistas, /configuracoes,
 * /concursos, /disciplinas) e some em rotas de sessão pra não
 * atrapalhar foco (/estudar, /cards, /discursivas, /simulado).
 *
 * Não tem nada autenticado-específico. Mesmos links do PublicFooter
 * mas com layout discreto pra não competir com conteúdo.
 */

const HIDDEN_ON = [
  '/estudar',
  '/cards',
  '/discursivas',
  '/simulado',
];

export function AppFooter() {
  const pathname = usePathname();
  if (!pathname) return null;
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const year = new Date().getFullYear();

  return (
    <footer
      className="app-footer"
      style={{
        marginTop: 24,
        paddingTop: 16,
        borderTop: '1px solid var(--border)',
        color: 'var(--muted)',
        fontSize: '0.82rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 14,
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          padding: '8px 0',
        }}
      >
        <Link href="/sobre" className="app-footer-link">
          Sobre
        </Link>
        <Link href="/manual" className="app-footer-link">
          Manual
        </Link>
        <Link href="/conquistas" className="app-footer-link">
          Conquistas
        </Link>
        <Link href="/roadmap" className="app-footer-link">
          Roadmap
        </Link>
        <Link href="/contato" className="app-footer-link">
          Contato
        </Link>
        <Link href="/privacidade" className="app-footer-link">
          Privacidade
        </Link>
        <Link href="/termos" className="app-footer-link">
          Termos
        </Link>
      </div>
      <div
        style={{
          textAlign: 'center',
          fontSize: '0.78rem',
          opacity: 0.7,
          paddingBottom: 12,
        }}
      >
        © {year} Estudo Simples · Repetição espaçada para concursos
      </div>
    </footer>
  );
}
