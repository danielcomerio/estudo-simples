import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { StoreProvider } from '@/components/StoreProvider';
import { Topbar } from '@/components/Topbar';
import { ToastHost } from '@/components/Toast';
import { OfflineBanner } from '@/components/OfflineBanner';
import { GlobalDropZone } from '@/components/GlobalDropZone';
import { PomodoroTimer } from '@/components/PomodoroTimer';
import { OnboardingTour } from '@/components/OnboardingTour';
import './globals.css';

export const metadata: Metadata = {
  title: 'Estudo Simples',
  description: 'Repetição espaçada para concursos públicos.',
  applicationName: 'Estudo Simples',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Estudo Simples',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Visitante: cookie es-guest=1 (server action enterAsGuest seta).
  // Dados ficam só no navegador; sync é no-op.
  const cookieStore = await cookies();
  const isGuest = !user && cookieStore.get('es-guest')?.value === '1';
  const effectiveUserId = user?.id ?? (isGuest ? 'guest' : null);
  const effectiveEmail = user?.email ?? (isGuest ? null : null);

  return (
    <html lang="pt-BR">
      <body>
        {effectiveUserId ? (
          <StoreProvider
            userId={effectiveUserId}
            userEmail={effectiveEmail ?? null}
            isGuest={isGuest}
          >
            <a href="#main-content" className="skip-link">
              Pular para o conteúdo
            </a>
            <Topbar email={effectiveEmail ?? null} isGuest={isGuest} />
            <OfflineBanner />
            <GlobalDropZone />
            <PomodoroTimer />
            <OnboardingTour />
            <main id="main-content" className="page">
              {children}
            </main>
            <ToastHost />
          </StoreProvider>
        ) : (
          <>
            {children}
            <ToastHost />
          </>
        )}
      </body>
    </html>
  );
}
