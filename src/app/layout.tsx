import type { Metadata, Viewport } from 'next';
import '@fontsource/pirata-one/latin.css';
import '@fontsource/pirata-one/latin-ext.css';
import '@fontsource/share-tech-mono/latin.css';
import '@fontsource/jetbrains-mono/latin-ext-400.css';
import './globals.css';
import CommunityFooter from '@/components/ui/CommunityFooter';
import { getAppOrigin } from '@/lib/config';

export const metadata: Metadata = {
  metadataBase: new URL(getAppOrigin()),
  title: 'Siber Köy: Veri Vampirleri | OMÜ Siber Güvenlik Topluluğu',
  description: 'OMÜ Siber Güvenlik Topluluğu’nun siber güvenlik temalı Vampir Köylü etkinliği.',
  applicationName: 'Siber Köy · OMÜ Siber',
  openGraph: {
    title: 'Siber Köy: Veri Vampirleri',
    description: 'OMÜ Siber Güvenlik Topluluğu’nun siber güvenlik temalı Vampir Köylü etkinliği.',
    siteName: 'OMÜ Siber Güvenlik Topluluğu',
    images: [{ url: '/brand/omusiber.png', width: 581, height: 640, alt: 'OMÜ Siber Güvenlik Topluluğu' }],
    locale: 'tr_TR',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a16',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-night-950 text-night-200 antialiased">
        {children}
        <CommunityFooter />
      </body>
    </html>
  );
}
