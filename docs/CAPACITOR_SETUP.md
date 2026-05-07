# Capacitor — passo-a-passo de setup

Pra publicar o Estudo Simples nas lojas Android (Google Play) e iOS
(App Store) usando o app web atual como shell.

## 1. Instalar dependências

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android @capacitor/ios
npm install @capacitor/splash-screen @capacitor/status-bar @capacitor/preferences
```

Pra geração automática de ícones e splash screens:

```bash
npm install -D @capacitor/assets
```

## 2. Adicionar plataformas

```bash
npx cap add android
npx cap add ios   # exige macOS + Xcode
```

Cria as pastas `android/` e `ios/` com projetos nativos. **Adicione ao .gitignore** se preferir não commitar (são gerados):

```
android/
ios/
```

Ou commite tudo se quer reproducibilidade total — recomendado.

## 3. Configurar capacitor.config.ts

Já está pronto na raiz. Pontos pra revisar antes do build:

- `appId`: `com.estudosimples.app` (formato bundle ID inverso). Mude se já tem outro reservado.
- `server.url`: aponta pra produção. Pra testar local, troque temporariamente.
- `appName`: como aparece embaixo do ícone no launcher.

## 4. Gerar ícones e splash

Crie em `assets/icon.png` (1024×1024) e `assets/splash.png` (2732×2732), depois:

```bash
npx capacitor-assets generate
```

Gera todas as variações pra Android e iOS automaticamente.

## 5. Sincronizar

```bash
npx cap sync
```

Roda **toda vez** que mudar `capacitor.config.ts`, `public/`, ou plugins.

## 6. Build local

### Android

```bash
npx cap open android
```

Abre Android Studio. Use **Build → Build Bundle(s) / APK(s) → Build APK(s)** pra teste em dispositivo, ou **Build Bundle** pra Play Store (.aab).

Assinatura:
1. Build → Generate Signed Bundle/APK
2. Crie/use keystore (guarde em local seguro — perda = fim de updates)
3. Gera `app-release.aab`

### iOS

```bash
npx cap open ios
```

Abre Xcode. Configure:
1. Signing & Capabilities → Team (Apple Developer Account, $99/ano)
2. Bundle Identifier: `com.estudosimples.app`
3. Product → Archive → Distribute App → App Store Connect

## 7. Submission

### Google Play Console
- Cria app, preenche metadados (descrição, screenshots, política de privacidade — temos `/privacidade`).
- Upload do `.aab`.
- Internal testing primeiro, depois production.
- Revisão automática + manual: ~3-7 dias.

### App Store Connect
- Cria app, idem metadados.
- Screenshots por device (iPhone 6.7", 6.5", 5.5"; iPad 12.9", 11").
- Privacy questionnaire — não coletamos PII desnecessária, mas precisa preencher.
- Review humana: 1-2 dias geralmente.

## 8. Testar no dispositivo (sem loja)

### Android
1. Conecta cabo USB, ativa USB debugging em Developer options.
2. Android Studio detecta o device → clica Run (▶).
3. APK é instalado direto.

### iOS
1. Conecta iPhone via cabo.
2. Xcode → seleciona o device no menu de target.
3. Trust the developer profile no iPhone (Settings → VPN & Device Mgmt).
4. Clica Run (▶) no Xcode.

## 9. Updates

App Capacitor carrega `server.url`, então **updates de UI/conteúdo são automáticos** quando você publica nova versão do site web. Só precisa subir nova versão na loja se mudar:
- Plugins nativos (push, file system, etc).
- Permissões.
- Versão do Capacitor.
- Strings/ícones do shell.

## 10. Push notifications (próximo passo)

Plugin: `@capacitor/push-notifications`. Backend: Firebase Cloud Messaging (Android) + APNS (iOS, exige Apple Developer enrollment).

Setup separado em `docs/PUSH_SETUP.md` (não criado ainda).

## Custos

| Item | Custo |
|------|-------|
| Apple Developer | USD 99/ano |
| Google Play Console | USD 25 (uma vez) |
| Build infra (GitHub Actions macOS pra iOS) | ~USD 50-100/ano se 2-3 builds/mês |
| FCM (push) | Free tier ilimitado |
| APNS | Incluído no Apple Developer |

**Total ano 1**: ~USD 150-250.

## Troubleshooting

- **Build Android falha em "Could not resolve all artifacts"**: rode `cd android && ./gradlew --refresh-dependencies` ou abra Android Studio e deixe ele baixar.
- **iOS Build falha em signing**: confira Team selecionado e Bundle ID match com o registrado no Apple Developer.
- **App branco depois de abrir**: provavelmente `server.url` errada ou domínio sem HTTPS. Use `npx cap run android --livereload` pra debug.
- **Service worker não funciona**: SW só funciona em https ou localhost. Capacitor usa `https://localhost` internamente — funciona ok.
