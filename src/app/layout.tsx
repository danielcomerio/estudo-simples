import type { Metadata, Viewport } from 'next';
import { createClient } from '@/lib/supabase/server';
import { StoreProvider } from '@/components/StoreProvider';
import { Topbar } from '@/components/Topbar';
import { ToastHost } from '@/components/Toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'Estudo Simples',
  description: 'Repetição espaçada para concursos públicos.',
  applicationName: 'Estudo Simples',
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

  return (
    <html lang="pt-BR">
      <body>
        {user ? (
          <StoreProvider userId={user.id} userEmail={user.email ?? null}>
            <Topbar email={user.email ?? null} />
            <main className="page">{children}</main>
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
