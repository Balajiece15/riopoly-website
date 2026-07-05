import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'RioPoly — Billing',
  description: 'Premium 3D visualization & proposal software for interior professionals.',
  icons: { icon: '/assets/riopoly-mark.svg', apple: '/assets/riopoly-mark.svg' },
};

function SiteHeader() {
  const linkStyle = { color: '#cbd5e1', textDecoration: 'none', fontSize: 14, fontWeight: 500 };
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '14px 24px',
        background: 'rgba(11,16,32,0.85)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #1e2a4a',
      }}
    >
      {/* Home and the 3D Studio are static assets served via rewrite, not RSC
          routes — use plain <a> so Next.js doesn't attempt (and fail) an RSC prefetch. */}
      <a
        href="/"
        style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#fff' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/riopoly-mark.svg" alt="RioPoly" width={28} height={28} style={{ borderRadius: 6 }} />
        <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: 0.2 }}>RioPoly</span>
      </a>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <a href="/color-studio" style={linkStyle}>3D Studio</a>
        <Link href="/pricing" style={linkStyle}>Pricing</Link>
        <Link href="/billing" style={linkStyle}>Billing</Link>
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
