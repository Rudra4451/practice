import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ToastContainer } from "@/components/ui/toast-container";
import { UsernameModal } from "@/components/auth/username-modal";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: {
    default: "TyProX — Free Typing Test, WPM Tracker & Competitive Leaderboards",
    template: "%s · TyProX",
  },
  description:
    "Improve your typing speed, track WPM, analyze performance, compete on leaderboards, and master every keystroke with TyProX.",
  keywords: [
    "typing test",
    "WPM",
    "typing speed",
    "typing practice",
    "monkeytype alternative",
    "competitive typing",
    "developer typing",
  ],
  openGraph: {
    title: "TyProX — Free Typing Test, WPM Tracker & Competitive Leaderboards",
    description:
      "Improve your typing speed, track WPM, analyze performance, compete on leaderboards, and master every keystroke with TyProX.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TyProX — Free Typing Test, WPM Tracker & Competitive Leaderboards",
    description:
      "Improve your typing speed, track WPM, analyze performance, compete on leaderboards, and master every keystroke with TyProX.",
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
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const pref = localStorage.getItem('user-store');
                if (pref) {
                  const parsed = JSON.parse(pref);
                  const theme = parsed.state?.preferences?.theme;
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                     document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } else {
                  // Default to dark mode if no preference is saved
                  document.documentElement.classList.add('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-text-primary antialiased">
        {children}
        <ToastContainer />
        <UsernameModal />
      </body>
    </html>
  );
}
