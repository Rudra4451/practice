import type { Metadata, Viewport } from 'next';
import {
  Inter,
  Space_Grotesk,
  JetBrains_Mono,
  IBM_Plex_Mono,
  Geist_Mono,
} from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { ToastContainer } from '@/components/ui/toast-container';
import { UsernameModal } from '@/components/auth/username-modal';
import { AuthProvider } from '@/components/providers/auth-provider';
import { getSiteUrl } from '@/lib/seo/site-url';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-ibm-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const siteUrl = getSiteUrl();

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0B0B0C' },
    { media: '(prefers-color-scheme: light)', color: '#F6F6F4' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'TyProX | Deliberate Typing Practice, Curriculum & Competitive Rankings',
    template: '%s · TyProX',
  },
  description:
    'Every keystroke makes you better. Improve your typing speed and accuracy with server-verified benchmarks, structured lessons, daily challenges, and Performance Lab analytics.',
  keywords: [
    'typing test',
    'typing curriculum',
    'WPM tracker',
    'typing speed',
    'deliberate practice',
    'competitive typing',
    'developer typing',
  ],
  openGraph: {
    title: 'TyProX | Every Keystroke Makes You Better',
    description:
      'Master typing speed, rhythm, and accuracy with structured lessons, weakness drills, daily challenges, and verified global leaderboards.',
    type: 'website',
    siteName: 'TyProX',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TyProX | Every Keystroke Makes You Better',
    description:
      'Master typing speed, rhythm, and accuracy with structured lessons, weakness drills, daily challenges, and verified global leaderboards.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-typing-font="jetbrains-mono"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${ibmPlexMono.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var raw = localStorage.getItem('user-store');
                var root = document.documentElement;
                if (raw) {
                  var parsed = JSON.parse(raw);
                  var prefs = parsed && parsed.state && parsed.state.preferences;
                  var theme = prefs && prefs.theme;
                  if (theme === 'light') {
                    root.classList.remove('dark');
                  } else if (theme === 'dark' || !theme) {
                    root.classList.add('dark');
                  }
                  var font = prefs && prefs.font_family;
                  if (font === 'jetbrains-mono' || font === 'ibm-plex-mono' || font === 'geist-mono') {
                    root.dataset.typingFont = font;
                  }
                } else {
                  root.classList.add('dark');
                  root.dataset.typingFont = 'jetbrains-mono';
                }
              } catch (_) {
                document.documentElement.classList.add('dark');
              }
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-text-primary antialiased">
        <AuthProvider>
          {children}
          <ToastContainer />
          <UsernameModal />
        </AuthProvider>
      </body>
    </html>
  );
}
