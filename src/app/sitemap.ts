import type { MetadataRoute } from 'next';

/**
 * /sitemap.xml — gera entry pra cada página pública. Páginas internas
 * (banco, estudar etc) ficam fora porque exigem auth e não devem ser
 * indexadas.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://estudo-simples.vercel.app';
  const lastModified = new Date();
  return [
    { url: `${base}/inicio`, lastModified, priority: 1.0, changeFrequency: 'weekly' },
    { url: `${base}/planos`, lastModified, priority: 0.9, changeFrequency: 'monthly' },
    { url: `${base}/manual`, lastModified, priority: 0.6, changeFrequency: 'weekly' },
    { url: `${base}/privacidade`, lastModified, priority: 0.3, changeFrequency: 'yearly' },
    { url: `${base}/termos`, lastModified, priority: 0.3, changeFrequency: 'yearly' },
    { url: `${base}/login`, lastModified, priority: 0.5, changeFrequency: 'yearly' },
    { url: `${base}/signup`, lastModified, priority: 0.5, changeFrequency: 'yearly' },
  ];
}
