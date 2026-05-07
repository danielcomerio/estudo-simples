// @ts-expect-error - @capacitor/cli será instalado quando setup for executado
//   (ver docs/CAPACITOR_SETUP.md). Type-only import; sem capacitor instalado,
//   tsc reclama do módulo. Em build de produção web, este arquivo nem é
//   incluído — só é usado pelo CLI Capacitor.
import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wrap pra Estudo Simples (Fase mobile).
 *
 * Modelo: shell nativo que carrega a URL de produção do app web. Sem
 * `output: 'export'` (Next App Router não suporta com Server Actions
 * + cookies). Em troca: requer internet pra primeiro load — service
 * worker cobre offline depois.
 *
 * Build flow:
 *   npm install @capacitor/core @capacitor/cli
 *   npm install @capacitor/android @capacitor/ios
 *   npx cap add android
 *   npx cap add ios
 *   npx cap sync       # após mudanças aqui ou em /public
 *   npx cap open android   # abre Android Studio
 *   npx cap open ios       # abre Xcode (macOS only)
 *
 * Secrets / env: NÃO há env vars no app mobile — backend é o mesmo
 * server web (Supabase + Stripe). Capacitor só renderiza o site.
 *
 * Ver docs/MOBILE_ANALYSIS.md pra contexto completo.
 */
const config: CapacitorConfig = {
  appId: 'com.estudosimples.app',
  appName: 'Estudo Simples',
  webDir: 'public', // unused (server.url aponta pra produção)
  server: {
    // Em produção: aponta pro app web. App nativo carrega isso direto.
    // Pra testar localmente: troca por http://10.0.2.2:3000 (emulador
    // Android) ou IP da rede (dispositivo físico).
    url: 'https://app.estudosimples.com.br',
    cleartext: false,
    androidScheme: 'https',
    iosScheme: 'https',
  },
  android: {
    backgroundColor: '#0b1220',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false, // true só em dev
  },
  ios: {
    backgroundColor: '#0b1220',
    contentInset: 'automatic',
    limitsNavigationsToAppBoundDomains: true,
    // App-Bound domains: define em ios/App/App/Info.plist
    //   WKAppBoundDomains: ["app.estudosimples.com.br"]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0b1220',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      // Imagem default: assets/splash.png 2732×2732 (cobre todos os
      // devices). Gerada via @capacitor/assets ou manualmente.
    },
  },
};

export default config;
