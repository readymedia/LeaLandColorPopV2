import type { MetadataRoute } from 'next';

/** Installerbar på iPad/nettbrett (Legg til på Hjem-skjerm) → fullskjerm uten nettleserrammer. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LeaLand FargePop',
    short_name: 'FargePop',
    description: 'Lag, fargelegg og tegn av dine egne magiske tegninger.',
    start_url: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#fbfaff',
    theme_color: '#6b4eff',
    lang: 'no',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
