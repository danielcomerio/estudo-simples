'use client';

import { useEffect, useRef, useState } from 'react';
import { getTheme, setTheme } from '@/lib/settings';
import { toast } from './Toast';

/**
 * Modal de ajuda listando todos os atalhos de teclado por contexto.
 * Aberto via botão "?" no Topbar ou tecla "?" global (quando não está
 * num input).
 */
export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const dlgRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      // Ctrl+Shift+L cicla tema (funciona mesmo dentro de inputs)
      if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault();
        const cur = getTheme();
        const next = cur === 'auto' ? 'light' : cur === 'light' ? 'dark' : 'auto';
        setTheme(next);
        toast(`Tema: ${next}`, 'success');
        return;
      }
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '?') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open && dlgRef.current && !dlgRef.current.open) {
      dlgRef.current.showModal();
    }
  }, [open]);

  const close = () => {
    if (dlgRef.current?.open) dlgRef.current.close();
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="ghost icon"
        onClick={() => setOpen(true)}
        title="Atalhos (?)"
        aria-label="Ver atalhos de teclado"
        style={{ fontSize: '1rem' }}
      >
        ?
      </button>
      {open && (
        <dialog
          ref={dlgRef}
          onClose={() => setOpen(false)}
          style={{
            maxWidth: 560,
            width: '95vw',
            padding: 0,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-elev)',
            color: 'var(--text)',
          }}
        >
          <div style={{ padding: 22 }}>
            <div className="row between" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Atalhos de teclado</h2>
              <button
                type="button"
                className="ghost icon"
                onClick={close}
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <Section title="Globais">
              <Row k="Ctrl+K" desc="Abre/fecha command palette" />
              <Row k="Ctrl+P" desc="Idem (alternativo)" />
              <Row k="Ctrl+I" desc="Vai pra /banco (atalho de import)" />
              <Row k="Ctrl+B" desc="Vai pra /banco" />
              <Row k="Ctrl+E" desc="Vai pra /estudar" />
              <Row k="Ctrl+Shift+F" desc="Busca global em todas as questões" />
              <Row k="Ctrl+Shift+L" desc="Cicla tema (auto / claro / escuro)" />
              <Row k="?" desc="Abre/fecha esta ajuda" />
              <Row k="G H/B/E/C/D/S/M/K/O" desc="Vim-jump: g + letra navega (h painel, b banco, e estudar, c cards, d discursivas, s stats, m simulado, k concursos, o opções)" />
            </Section>

            <Section title="/ (painel)">
              <Row k="P" desc="Começa sessão recomendada (se houver)" />
              <Row k="R" desc="Revisão pré-prova (30 questões variadas)" />
            </Section>

            <Section title="/banco">
              <Row k="/" desc="Foca a busca" />
              <Row k="j ou ↓" desc="Próxima questão (foca)" />
              <Row k="k ou ↑" desc="Anterior" />
              <Row k="g / G" desc="Pular pra primeira / última" />
              <Row k="Enter" desc="Editar questão focada (drawer)" />
              <Row k="Espaço" desc="Marcar/desmarcar checkbox da focada" />
              <Row k="x ou Delete" desc="Excluir focada (com confirm)" />
              <Row k="F" desc="Marcar/desmarcar como favorita (★)" />
              <Row k="V" desc="Alternar verificação da focada (verificada ↔ pendente)" />
              <Row k="R" desc="Estudar 1 questão aleatória do filtro atual" />
              <Row k="1–5" desc="Setar dificuldade da focada (1=fácil, 5=muito difícil)" />
              <Row k="Esc" desc="Remove foco" />
            </Section>

            <Section title="/estudar (objetivas)">
              <Row k="A-E" desc="Marcar alternativa correspondente" />
              <Row k="Espaço/Enter" desc="(active recall) Revelar alternativas escondidas" />
              <Row k="Tab" desc="Pular questão (skip soft, não conta)" />
              <Row k="1" desc="Após responder: De novo (q=0)" />
              <Row k="2" desc="Difícil (q=3)" />
              <Row k="3 ou Enter" desc="Bom (q=4)" />
              <Row k="4" desc="Fácil (q=5)" />
              <Row k="Shift+1–5" desc="Após responder: setar dificuldade da questão (1=fácil, 5=muito difícil)" />
              <Row k="Z" desc="Desfazer última resposta (até 6s)" />
              <Row k="F" desc="Modo foco (esconde topbar)" />
            </Section>

            <Section title="/cards (cloze + flashcard)">
              <Row k="Espaço ou Enter" desc="Revelar próxima lacuna / virar verso" />
              <Row k="Tab" desc="Pular card sem aplicar SRS" />
              <Row k="Esc" desc="Sair da sessão" />
              <Row k="1-4" desc="Após revelar: rate (igual /estudar)" />
              <Row k="Z" desc="Desfazer última rate (até 6s)" />
            </Section>

            <Section title="/simulado">
              <Row k="A-E" desc="Marcar alternativa" />
              <Row k="←/→" desc="Questão anterior/próxima" />
              <Row k="M" desc="Marcar/desmarcar pra revisar" />
            </Section>

            <Section title="/discursivas">
              <Row k="1" desc="De novo · 2 Difícil · 3 Bom · 4 Fácil" />
              <Row k="Z" desc="Desfazer última rate (até 6s)" />
            </Section>

            <Section title="QuestionEditDrawer">
              <Row k="Ctrl+S" desc="Salvar" />
              <Row k="Esc" desc="Fechar (cancela edição)" />
            </Section>

            <Section title="Command palette (Ctrl+K)">
              <Row k="↑/↓" desc="Navegar comandos" />
              <Row k="Enter" desc="Executar comando" />
              <Row k="Esc" desc="Fechar" />
            </Section>
          </div>
        </dialog>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h3
        style={{
          margin: '0 0 6px',
          fontSize: '0.9rem',
          color: 'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {title}
      </h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>{children}</ul>
    </div>
  );
}

function Row({ k, desc }: { k: string; desc: string }) {
  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 1fr',
        gap: 10,
        padding: '4px 0',
        fontSize: '0.88rem',
      }}
    >
      <kbd
        style={{
          background: 'var(--bg-elev-2)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '2px 6px',
          fontFamily: 'inherit',
          fontSize: '0.82rem',
          textAlign: 'center',
          alignSelf: 'start',
          width: 'fit-content',
        }}
      >
        {k}
      </kbd>
      <span>{desc}</span>
    </li>
  );
}
