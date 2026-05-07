# Análise: migrar Estudo Simples pra mobile Android/iOS

Status: **análise** — sem implementação. Decisão pendente do user.

## TL;DR

- **PWA já funcional** (manifest + service worker em produção). Para muitos usuários, é "mobile o suficiente".
- **3 caminhos viáveis** pra distribuição em loja, em ordem de complexidade:
  1. **Capacitor** (Ionic) — wrappa o site Next como app nativo. ~1-2 semanas. Recomendado.
  2. **PWA Builder + Trusted Web Activities** — Google Play aceita PWA direto via Bubblewrap. ~3-5 dias. Mais simples mas só Android (iOS sem suporte oficial).
  3. **Reescrita em React Native + Expo** — app de fato nativo. 2-4 meses. Recomendado se Estudo Simples crescer pra ter equipe e demanda explícita por features OS-only.
- **Pra Estudo Simples hoje**: **PWA + Capacitor** atende sem rewrite. Reaproveita 95% do código atual. Push notifications, share target, install prompt — tudo funciona.

## Estado atual (PWA)

Já implementado:

- `public/manifest.json` (verificar)
- `ServiceWorkerRegister.tsx` componente
- `InstallPWAButton.tsx` (mostra prompt nativo `beforeinstallprompt`)
- `src/components/ShareTargetReceiver.tsx` (receber share Android)
- Viewport meta tags + theme-color por preferência OS
- Apple touch icon
- `apple-mobile-web-app-capable: yes`
- IndexedDB pra offline
- Background sync via service worker

Lacunas pra "feel" mobile:

- Sem splash screen Android (manifest.json `display: standalone` resolve parcialmente).
- Sem push notifications via Firebase / APNS (precisaria backend).
- Sem deep linking nativo (URLs funcionam mas não abrem o app instalado por padrão; PWA mais novo do iOS faz, Android idem).
- Sem haptic feedback (vibration API funciona mas é limitada).

## Opção 1: Capacitor (recomendado)

**O que é**: framework do Ionic que pega seu app web e gera projetos nativos Android/iOS que carregam o site (em produção: do servidor; em dev: localhost). Ponte JS↔nativa pra APIs do OS.

**Setup**:
```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Estudo Simples" com.estudosimples.app
npx cap add android
npx cap add ios
```

**Como funciona**:
- `npm run build` gera `out/` (precisa configurar Next pra `output: 'export'` ou usar SSR remoto).
- `npx cap copy` copia pros projetos nativos.
- Abre Android Studio / Xcode pra build do APK / IPA.

**Decisões de arquitetura pra Estudo Simples**:
- App **não pode ser estático** (Next 14 tem cookies, Server Actions, RSC). Solução: Capacitor aponta pra URL do app em produção (`server.url = "https://app.estudosimples.com.br"` no `capacitor.config.ts`). App vira "shell nativo" que carrega o site.
- Trade-off: precisa internet pra primeiro load. Cache do service worker cobre depois. Mais robusto: rebuild com `output: 'export'` se for migrar pra static (perde Server Actions; precisaria Edge Functions na Vercel).

**Vantagens**:
- Reaproveita 100% UI/UX, lógica, store IDB.
- Acesso a APIs nativas via plugins: `@capacitor/share`, `@capacitor/haptics`, `@capacitor/push-notifications`, `@capacitor/local-notifications`, `@capacitor/network`, `@capacitor/preferences`, etc.
- Pode publicar em ambas lojas com mesmo código.
- Distribuição via TWA também é compatível.

**Custos**:
- Apple Developer: USD 99/ano.
- Google Play Console: USD 25 (one-time).
- Build infra: pode usar GitHub Actions com runners macOS pra iOS (caro: ~USD 0.08/min, hora de build são uns 15-20min).

**Esforço**:
- Setup + ajustes: 2-4 dias.
- Configurar push notifications: 2-3 dias (Firebase Cloud Messaging + APNS).
- Polish (splash, ícones, store assets): 2-3 dias.
- Submission Apple (review 1-2 semanas) + Google (revisão automática + manual ~3-7 dias).
- **Total realista**: 2-3 semanas até Estudo Simples nas lojas.

## Opção 2: TWA (Trusted Web Activities) — só Android

**O que é**: Google permite empacotar PWA como app Android via Chrome wrapper. Apple não tem equivalente.

**Setup** com Bubblewrap:
```bash
npx @bubblewrap/cli init --manifest=https://app.estudosimples.com.br/manifest.json
npx @bubblewrap/cli build
```

Gera APK assinado pra upload no Play Console.

**Vantagens**:
- Setup em horas, não dias.
- Atualizações automáticas (PWA atualiza, app reflete).
- 100% mesma URL/codebase.

**Desvantagens**:
- Só Android.
- iOS users continuam só via PWA (instalar pelo Safari → Adicionar à Tela de Início).
- Limitações de push notifications (não tem FCM nativo direto).

**Quando faz sentido**: cobrir Android rápido. iOS via Capacitor depois se demanda crescer.

## Opção 3: React Native + Expo

**O que é**: rewrite total do app em React Native. App de fato nativo.

**Esforço**:
- 2-4 meses pra paridade com app web (UI rewrite + reusar lib/* do TS).
- Aprendizado de paradigmas mobile (navigation stack, gestures, native dialogs).

**Quando faz sentido**:
- Demanda explícita por feature OS-only que Capacitor não dá bem (camera complexa, ARKit, widgets de home screen).
- App tem >10k MAU mobile e UX nativa precisa ser perfeita.
- Equipe iOS/Android disponível pra manter código nativo.

**Não faz sentido pra Estudo Simples agora**: feature set é text-heavy + storage-heavy. PWA + Capacitor entrega 95% da UX nativa com 5% do esforço.

## Recomendação final

1. **Imediato (1 semana)**: garantir PWA está 100% (audit Lighthouse PWA, atualizar manifest com all icon sizes, verificar share target funcionando, splash screen via `display: standalone`).
2. **Curto prazo (2-3 semanas)**: empacotar com Capacitor, publicar em Play e App Store. App vira shell que carrega o site (`server.url = production URL`).
3. **Médio prazo**: adicionar push notifications via FCM/APNS pra revisões vencendo (huge feature pra app de SRS).
4. **Longo prazo**: avaliar React Native só se crescer e usuário mobile virar 50%+ da base.

## Riscos e considerações

- **Apple App Review**: Apple gosta de apps "nativos". Há histórico de rejeição de "wrapper apps" que são só web. Capacitor sobrevive ao review se: tem features mobile-specific (push, share, install), UX é claramente otimizada pra mobile (já é, tem `MobileBottomNav`).
- **Atualizações de OS**: Capacitor atualiza WebView usado. Compatibilidade ampla (iOS 13+, Android 7+).
- **Service Worker**: já funcionando, mas em Capacitor o SW roda no contexto Capacitor — algumas APIs (como background sync) podem comportar diferente.
- **Auth com Supabase**: cookie-based auth funciona em Capacitor. OAuth precisaria deep link (capacitor:// scheme).

## Custo estimado total (1 ano)

- Apple Developer: USD 99
- Google Play: USD 25 (uma vez)
- Cloud build (GitHub Actions): ~USD 50-100/ano se 2-3 builds/mês iOS
- Push notification infra: free tier FCM cobre indefinidamente
- **Total**: ~USD 200-300 no primeiro ano.

ROI: difícil prever sem dados de demanda mobile. Pra concursandos brasileiros, presença em loja é sinal de credibilidade — vale o investimento mesmo que conversion seja modesto inicialmente.
