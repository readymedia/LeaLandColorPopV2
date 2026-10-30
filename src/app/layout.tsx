import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import '@fontsource-variable/nunito';
import '@fontsource-variable/baloo-2';
import '@digdir/designsystemet-css';
import '../styles/theme/lealand.css';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'LeaLand FargePop',
  description: 'Lag dine egne fargeleggingsbilder med magi – fargelegg på skjerm, tegn av på lysbord eller projiser på papir.',
  applicationName: 'LeaLand FargePop',
  appleWebApp: { capable: true, title: 'FargePop', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fbfaff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no" data-color-scheme="light" data-color="accent">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
