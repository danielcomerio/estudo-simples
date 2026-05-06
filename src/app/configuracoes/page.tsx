import Link from 'next/link';
import { AlgorithmSection } from '@/components/AlgorithmSection';
import { BackupSection } from '@/components/BackupSection';
import { ThemeSection } from '@/components/ThemeSection';
import { DailyGoalSection } from '@/components/DailyGoalSection';
import { NotificationsSection } from '@/components/NotificationsSection';
import { AccessibilitySection } from '@/components/AccessibilitySection';
import { SoundsSection } from '@/components/SoundsSection';
import { PlatformSeedSection } from '@/components/PlatformSeedSection';
import { StorageInfo } from '@/components/StorageInfo';
import { BillingSection } from '@/components/BillingSection';
import { DeleteAccountSection } from '@/components/DeleteAccountSection';
import { createClient } from '@/lib/supabase/server';

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? null;
  return (
    <>
      <div className="card">
        <h1 style={{ margin: '0 0 8px' }}>Configurações</h1>
        <p className="muted" style={{ margin: 0 }}>
          Preferências da sua conta. Cadastros (concursos, disciplinas,
          tópicos) ficam em páginas dedicadas.
        </p>
      </div>

      <BillingSection />

      <AlgorithmSection />

      <DailyGoalSection />

      <ThemeSection />

      <NotificationsSection />

      <SoundsSection />

      <AccessibilitySection />

      <PlatformSeedSection />

      <StorageInfo />

      <BackupSection />

      <div className="card">
        <h2 style={{ margin: '0 0 8px' }}>Cadastros</h2>
        <div className="row gap wrap">
          <Link href="/concursos" className="ghost" style={{ padding: '6px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            Concursos →
          </Link>
          <Link href="/disciplinas" className="ghost" style={{ padding: '6px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            Disciplinas →
          </Link>
        </div>
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 8px' }}>Sobre o app</h2>
        <p style={{ margin: '0 0 8px', fontSize: '0.92rem' }}>
          <strong>Estudo Simples</strong> · repetição espaçada para concursos.
        </p>
        <ul
          className="muted"
          style={{ fontSize: '0.85rem', paddingLeft: 18, margin: 0, lineHeight: 1.6 }}
        >
          <li>Algoritmos: SM-2 (default) e FSRS-6 (opt-in).</li>
          <li>Offline-first via IndexedDB; sync com Supabase quando online.</li>
          <li>
            Atalhos: <kbd>?</kbd> abre lista completa.
          </li>
          <li>
            Tipos suportados: objetiva, discursiva, cloze, flashcard.
          </li>
        </ul>
        <div className="row gap wrap" style={{ marginTop: 12 }}>
          <Link
            href="/manual"
            className="ghost"
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}
          >
            📖 Manual completo →
          </Link>
          <Link
            href="/privacidade"
            className="ghost"
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}
          >
            🔒 Privacidade
          </Link>
          <Link
            href="/termos"
            className="ghost"
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}
          >
            📋 Termos
          </Link>
        </div>
      </div>

      {email && <DeleteAccountSection email={email} />}
    </>
  );
}
