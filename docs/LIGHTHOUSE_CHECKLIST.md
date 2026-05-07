# Lighthouse audit checklist

Pra rodar **antes de cada release relevante** em produção. Não substitui
testes, mas pega regressões de performance/a11y/SEO/PWA.

## Como rodar

1. Abre Chrome em **modo incógnito** em `https://app.estudosimples.com.br`.
2. F12 → Lighthouse tab.
3. Categorias: **Performance + Accessibility + Best Practices + SEO + PWA**.
4. Mode: **Navigation**.
5. Device: **Mobile** (mais restritivo; rodar Desktop depois pra
   comparar).
6. Throttling: **Slow 4G + 4× CPU slowdown** (default).
7. Click "Analyze page load".

## Targets

| Categoria | Target | Crítico se < |
|-----------|--------|---------------|
| Performance | 85+ | 70 |
| Accessibility | 95+ | 90 |
| Best Practices | 100 | 95 |
| SEO | 100 (public pages) | 90 |
| PWA | 100 | 100 (PWA é binário — install prompt funciona ou não) |

## Páginas a auditar

| Rota | Por quê | Notas |
|------|---------|-------|
| `/` (logado) | Painel principal | Anon → redirect /inicio |
| `/inicio` (anon) | Landing pública | SEO crítico |
| `/planos` (anon) | Conversão | SEO crítico |
| `/banco` (logado) | Page mais pesada do app | Tolera ~5pts performance a menos |
| `/estudar` (logado) | Engagement core | Performance importa |
| `/import/[token]` (anon) | Recepção de share | SEO importa |

## Issues comuns + fix

### Performance

- **Largest Contentful Paint > 2.5s**: revisar imagens (já são SVG inline ou lazy via QuestionImages). Em /stats, LazyMount cobre.
- **Total Blocking Time > 200ms**: provavelmente render pesado de lista grande. Banco usa paginação visual (100/vez).
- **Cumulative Layout Shift > 0.1**: imagens sem width/height. `<QuestionImages>` sempre seta dimensões.

### Accessibility

- **Form elements without labels**: cobrimos selects via aria-label. Inputs novos: sempre `<label>` ou `aria-label`.
- **Color contrast**: tema dark default já AA. Light + amoled também testados. High contrast tem AAA.
- **Heading order**: nunca pular níveis (h1 → h3). Verificar pages novas.
- **Image alt**: fotos decorativas usam `alt=""` + `aria-hidden`. Conteúdo usa alt descritivo.

### Best Practices

- **HTTPS**: Vercel default.
- **Console errors**: ErrorLogger captura em produção mas Lighthouse alerta no audit. Remove `console.log` deixados em desenvolvimento.
- **Deprecation warnings**: APIs do browser que mudaram. Atualizar bibliotecas.

### SEO

- **Meta description**: conferir que páginas têm `metadata.description` específico.
- **Crawlable**: robots.txt + sitemap.xml ok (`/robots.ts`, `/sitemap.ts`).
- **Structured data**: /inicio tem JSON-LD; outras páginas opcional.

### PWA

- **Web App Manifest**: ✓ public/manifest.json com id, ícones, shortcuts.
- **Service Worker**: ✓ public/sw.js registrado em produção.
- **Installable**: prompt funciona (testar com beforeinstallprompt fired).
- **Splash screen**: gerada pelo manifest theme_color + background_color.
- **Apple touch icon**: ✓ no metadata.icons.apple.

## Mozilla Observatory

Complemento ao Lighthouse pra security headers.

```
https://observatory.mozilla.org/analyze/app.estudosimples.com.br
```

Target: **A+** (após CSP aplicado em 2026-05).

## Webhint (opcional)

```
https://webhint.io/scanner/
```

Cobre alguns casos não pegos pelo Lighthouse (ex: `<html lang>`,
opengraph completo).

## CI integration (futuro)

Pra automatizar, adicionar GitHub Action:

```yaml
- uses: treosh/lighthouse-ci-action@v10
  with:
    urls: |
      https://app.estudosimples.com.br/inicio
      https://app.estudosimples.com.br/planos
    uploadArtifacts: true
```

Não implementado — rodar manual antes de releases por agora.
