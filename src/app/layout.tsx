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
import { XPToast } from '@/components/XPToast';
import { AchievementToast } from '@/components/AchievementToast';
import { BadgingHost } from '@/components/BadgingHost';
import { AchievementDetector } from '@/components/AchievementDetector';
import { AICoach } from '@/components/AICoach';
import { AppFooter } from '@/components/AppFooter';
import { NavigationProgress } from '@/components/NavigationProgress';
import { BFCacheGuard } from '@/components/BFCacheGuard';
import { ErrorLogger } from '@/components/ErrorLogger';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Estudo Simples',
    template: '%s · Estudo Simples',
  },
  description: 'Repetição espaçada para concursos públicos.',
  applicationName: 'Estudo Simples',
  manifest: '/manifest.json',
  // icons: definidos via Next 14 convention em app/icon.svg + app/apple-icon.svg
  // (Next gera <link> automático). Definir aqui também duplicava e em alguns
  // browsers gerava conflito (favicon não aparecia em localhost).
  // Mask-icon via tag manual no <head> mais abaixo (não há suporte direto
  // no metadata.icons.other em todos versions do Next 14).
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

  // JSON-LD schema.org pra SEO. SoftwareApplication descreve o app em
  // termos que Google/buscadores entendem. Não promete dados que não
  // existem (rating, price). Educational categoria reflete o uso real.
  const ldJson = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Estudo Simples',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web, iOS, Android',
    description:
      'Repetição espaçada (SRS) para concursos públicos brasileiros. Estude com SM-2 ou FSRS-6, importe questões reais, integre IA com sua chave (BYO).',
    inLanguage: 'pt-BR',
    url: 'https://app.estudosimples.com.br',
  };

  return (
    <html lang="pt-BR">
      <head>
        {/* Favicon explícito — Next 14 deveria gerar via app/icon.svg
            convention, mas em dev mode às vezes não serve. Link manual
            garante visual consistente entre localhost e produção. */}
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="mask-icon" href="/icon.svg" color="#22c55e" />
        {supabaseHost && (
          <>
            <link rel="preconnect" href={supabaseHost} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={supabaseHost} />
          </>
        )}
        <link rel="preconnect" href="https://js.stripe.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.stripe.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
        />
      </head>
      <body>
        <ServiceWorkerRegister />
        <ConfettiHost />
        <XPToast />
        <AchievementToast />
        <NavigationProgress />
        <BFCacheGuard />
        <ErrorLogger />
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
            <BadgingHost />
            <AchievementDetector />
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
            <AICoach />
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
