import type { Metadata, Viewport } from 'next';
import { Inria_Serif } from 'next/font/google';
import '@/styles/globals.css';

const inria = Inria_Serif({
  // 400 for headings (and italic emphasis), 700 for the wordmark.
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-inria',
});

const DESCRIPTION =
  'doctor.ai is an AI doctor you can call on WhatsApp. Tell it what is wrong, show it on video, and leave knowing your next step.';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

// The share image and icons come from app/opengraph-image.png, app/icon.png and app/apple-icon.png.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'doctor.ai: a doctor on WhatsApp', template: '%s · doctor.ai' },
  description: DESCRIPTION,
  applicationName: 'doctor.ai',
  openGraph: {
    type: 'website',
    siteName: 'doctor.ai',
    title: 'doctor.ai: a doctor on WhatsApp',
    description: DESCRIPTION,
  },
  twitter: { card: 'summary_large_image' },
};

// Every page has a white header, so the browser chrome matches it.
export const viewport: Viewport = {
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inria.variable} font-sans antialiased`}>
      <body>{children}</body>
    </html>
  );
}
