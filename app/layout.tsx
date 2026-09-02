import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import Providers from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'RioPoly — Billing',
  description: 'Premium 3D visualization & proposal software for interior professionals.',
  icons: { icon: '/assets/riopoly-mark.svg', apple: '/assets/riopoly-mark.svg' },
};

// Explicit viewport with safe-area support (notched devices).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b1020',
};

function SiteHeader() {
  return (
    <header className="site-header">
      {/* Home and the 3D Studio are static assets served via rewrite, not RSC
          routes — use plain <a> so Next.js doesn't attempt (and fail) an RSC prefetch. */}
      <a href="/" className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/riopoly-mark.svg" alt="RioPoly" width={28} height={28} style={{ borderRadius: 6 }} />
        <span className="brand-text">RioPoly</span>
      </a>
      <nav aria-label="Primary">
        <a href="/color-studio">3D Studio</a>
        <Link href="/pricing">Pricing</Link>
        <Link href="/billing">Billing</Link>
      </nav>
    </header>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'Inter, system-ui, Arial, sans-serif',
          background: '#0b1020',
          color: '#e2e8f0',
        }}
      >
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
