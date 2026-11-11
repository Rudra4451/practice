import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo/site-url';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/auth/', '/dashboard'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
