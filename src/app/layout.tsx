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
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { MobileFAB } from '@/components/MobileFAB';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { ConfettiHost } from '@/components/ConfettiHost';
import { AppFooter } from '@/components/AppFooter';
import { NavigationProgress } from '@/components/NavigationProgress';
import { BFCacheGuard } from '@/components/BFCacheGuard';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Estudo Simples',
    template: '%s · Estudo Simples',
  },
  description: 'Repetição espaçada para concursos públicos.',
  applicationName: 'Estudo Simples',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/icon.svg', sizes: '180x180', type: 'image/svg+xml' },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/icon-maskable.svg',
        color: '#22c55e',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: 'Estudo Simples',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#22c55e' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
  ],
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

  // Resource hints: pre-connect pros domínios externos críticos pra
  // economizar DNS + TLS handshake antes da primeira chamada real.
  const supabaseHost = (() => {
    try {
      return process.env.NEXT_PUBLIC_SUPABASE_URL
        ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
        : null;
    } catch {
      return null;
    }
  })();

  return (
    <html lang="pt-BR">
      <head>
        {supabaseHost && (
          <>
            <link rel="preconnect" href={supabaseHost} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={supabaseHost} />
          </>
        )}
        <link rel="preconnect" href="https://js.stripe.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.stripe.com" />
      </head>
      <body>
        <ServiceWorkerRegister />
        <ConfettiHost />
        <NavigationProgress />
        <BFCacheGuard />
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
              <AppFooter />
            </main>
            <MobileFAB />
            <MobileBottomNav />
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
