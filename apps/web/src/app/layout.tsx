import localFont from 'next/font/local';
import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { PostHogProvider } from '@/components/posthog-provider';
import './globals.css';

const outfit = localFont({
  src: './fonts/Outfit-Variable.ttf',
  weight: '100 900',
  variable: '--font-outfit',
  display: 'swap',
});

const dmMono = localFont({
  src: [
    { path: './fonts/DMMono-Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/DMMono-Medium.ttf', weight: '500', style: 'normal' },
  ],
  variable: '--font-dm-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LendSync — Lending operations, clearly managed',
  description:
    'Multi-tenant lending management: applications, collections, repayments, and reports. Start a 14-day free trial.',
  icons: {
    icon: [{ url: '/logo.png', type: 'image/png' }],
    apple: [{ url: '/apple-icon.png', type: 'image/png' }],
  },
};

const themeScript = `(function(){try{var t=localStorage.getItem('lms_theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}var d=document.documentElement;d.classList.toggle('dark',t==='dark');d.style.colorScheme=t;}catch(e){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${outfit.variable} ${dmMono.variable} font-sans`}>
        <PostHogProvider>
          {children}
          <Toaster richColors position="top-right" />
        </PostHogProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
