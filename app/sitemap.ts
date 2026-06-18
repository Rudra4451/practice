import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/client';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Replace with production URL when ready
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://typrox.com';

  const routes = [
    '',
    '/typing',
    '/leaderboard',
    '/dashboard',
    '/login',
    '/profile',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1.0 : 0.8,
  }));

  try {
    const supabase = createClient();
    const { data: profiles } = await supabase
      .from('profiles')
      .select('username, updated_at')
      .limit(2000); // Cap at 2000 to keep sitemap builds lightweight

    if (profiles) {
      const profileRoutes = profiles.map((p) => ({
        url: `${baseUrl}/u/${p.username}`,
        lastModified: new Date(p.updated_at || Date.now()),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      }));
      return [...routes, ...profileRoutes];
    }
  } catch (err) {
    console.error('Failed to generate dynamic profiles in sitemap:', err);
  }

  return routes;
}
