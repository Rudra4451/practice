import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://typrox.vercel.app';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const routes = [
    '',
    '/typing',
    '/leaderboard',
    '/login',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1.0 : 0.8,
  }));

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase URL or Key missing in sitemap generation. Returning basic routes.');
    return routes;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('username, updated_at')
      .limit(2000);

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
