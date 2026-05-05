'use client';

import { useState } from 'react';
import { confirmDialog } from './ConfirmDialog';
import { toast } from './Toast';

/**
 * Seção de "deletar conta" em /configuracoes. Exigências:
 *  - Confirmação dupla (dialog + digitar email)
 *  - Endpoint server-side cancela Stripe + apaga auth.users (cascade)
 *  - Em caso de sucesso, navega pra /login
 */
export function DeleteAccountSection({ email }: { email: string | null }) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (!email) {
      toast('E-mail não disponível', 'error');
      return;
    }
    const ok1 = await confirmDialog({
      title: 'Excluir minha conta',
      message:
        'Esta ação é IRREVERSÍVEL. Vai apagar permanentemente: conta, questões, histórico de revisões, simulados, concursos, anotações. Backups são removidos em até 7 dias.',
      danger: true,
    });
    if (!ok1) return;

    // Confirmação dupla: digitar o email
    const typed = window.prompt(
      `Pra confirmar, digite seu email exatamente:\n${email}`
    );
    if (!typed || typed.trim() !== email) {
      toast('Email não conferiu — exclusão cancelada.', 'warn');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: email }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast(
          json?.error === 'confirm_email_mismatch'
            ? 'Confirmação falhou.'
            : 'Erro ao excluir. Tente de novo ou contate suporte.',
          'error'
        );
        setBusy(false);
        return;
      }
      // Limpa local e força login
      try {
        localStorage.clear();
        sessionStorage.clear();
        if (typeof indexedDB !== 'undefined') {
          indexedDB.deleteDatabase('estudo-simples');
        }
      } catch {}
      // Logout via cookie clear vai acontecer no redirect
      window.location.href = '/login?deleted=1';
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro de rede', 'error');
      setBusy(false);
    }
  };

  return (
    <div
      className="card"
      style={{
        background: 'var(--danger-soft, rgba(239,68,68,0.05))',
        border: '1px solid var(--danger, #ef4444)',
      }}
    >
      <h2 style={{ margin: '0 0 8px', color: 'var(--danger, #ef4444)' }}>
        Zona de risco
      </h2>
      <p
        className="muted"
        style={{ marginTop: 0, fontSize: '0.88rem', marginBottom: 12 }}
      >
        Excluir sua conta apaga permanentemente todos os seus dados. Conforme
        LGPD art. 18, este é o caminho oficial pra solicitar deleção. Cancela
        assinatura Pro automaticamente (se ativa).
      </p>
      <button
        type="button"
        className="danger"
        onClick={onClick}
        disabled={busy || !email}
      >
        {busy ? 'Excluindo…' : '🗑 Excluir minha conta permanentemente'}
      </button>
    </div>
  );
}
