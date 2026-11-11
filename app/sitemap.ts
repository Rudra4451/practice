import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { CURRICULUM_LESSONS } from '@/constants/curriculum';
import { getSiteUrl } from '@/lib/seo/site-url';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const now = new Date();
  const coreRoutes = [
    '',
    '/typing',
    '/learn',
    '/daily',
    '/leaderboard',
    '/login',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1.0 : 0.8,
  }));

  const lessonRoutes = CURRICULUM_LESSONS.map((lesson) => ({
    url: `${baseUrl}/learn/${lesson.slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  const routes = [...coreRoutes, ...lessonRoutes];

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase URL or Key missing in sitemap generation. Returning static routes.');
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
        url: `${baseUrl}/u/${encodeURIComponent(p.username)}`,
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
