import type { CSSProperties } from 'react';
import Link from 'next/link';

export const metadata = { title: 'RioPoly — Terms, Refund & Cancellation Policy' };

const SUPPORT_EMAIL = 'Request@gotoanalyze.com';
const LAST_UPDATED = 'June 2026';

const wrap: CSSProperties = { maxWidth: 820, margin: '0 auto', padding: '56px 24px 96px', lineHeight: 1.7 };
const h2: CSSProperties = { fontSize: 20, fontWeight: 700, margin: '36px 0 10px' };
const p: CSSProperties = { color: '#cbd5e1', margin: '0 0 12px', fontSize: 15 };
const li: CSSProperties = { color: '#cbd5e1', fontSize: 15, marginBottom: 8 };

export default function TermsPage() {
  return (
    <main style={wrap}>
      <a href="/" style={{ color: '#94a3b8', fontSize: 14, textDecoration: 'none' }}>
        ← Back to home
      </a>

      <h1 style={{ fontSize: 30, fontWeight: 800, margin: '14px 0 4px' }}>
        Terms of Service &amp; Refund Policy
      </h1>
      <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 8px' }}>Last updated: {LAST_UPDATED}</p>

      <p style={p}>
        These terms govern your purchase and use of RioPoly, operated by{' '}
        <strong>GTANALYZE SOLUTIONS PRIVATE LIMITED</strong> (GSTIN{' '}
        <strong>33AALCG6598F1Z7</strong>), Tamil Nadu, India. By purchasing a plan or credits you
        agree to these terms.
      </p>

      {/* The clause that protects you most — keep it prominent. */}
      <div
        style={{
          background: '#121a33',
          border: '1px solid #6366f1',
          borderRadius: 12,
          padding: '18px 20px',
          margin: '20px 0',
        }}
      >
        <h2 style={{ ...h2, margin: '0 0 8px' }}>Refund &amp; Cancellation Policy</h2>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li style={li}>
            <strong>All sales are final — no refunds.</strong> Payments for subscriptions and
            one-time project credits are non-refundable.
          </li>
          <li style={li}>
            <strong>Cancel anytime.</strong> You may cancel a subscription whenever you like. Your
            access continues until the end of the billing period you have already paid for; it
            simply does not renew. No partial or pro-rated refunds are issued for unused time.
          </li>
          <li style={li}>
            <strong>One-time credits</strong> are non-refundable once purchased, and consumed
            credits cannot be reversed. Credit packs expire as stated at purchase.
          </li>
          <li style={li}>
            If a refund is granted at our sole discretion as a goodwill exception, it will be
            issued <strong>net of non-refundable payment-processing charges</strong> levied by our
            payment gateway, and the corresponding access/credits will be revoked.
          </li>
          <li style={li}>
            A free tier is available so you can fully evaluate RioPoly (watermarked exports, one
            saved project) before paying.
          </li>
        </ul>
      </div>

      <h2 style={h2}>Billing</h2>
      <p style={p}>
        Prices are listed in INR and are inclusive of 18% GST. The price shown at checkout is the
        total amount you pay — RioPoly absorbs payment-gateway fees. Subscriptions renew
        automatically at the end of each billing period until cancelled. Plans billed above
        ₹15,000 per cycle require an additional bank authentication step on each renewal, as
        mandated by RBI.
      </p>
      <p style={p}>
        A GST tax invoice is issued for every successful payment and is available for download from
        your <Link href="/billing" style={{ color: '#818cf8' }}>billing dashboard</Link>.
      </p>

      <h2 style={h2}>Failed renewals</h2>
      <p style={p}>
        If a subscription renewal payment fails, access is paused until payment succeeds. Repeated
        failures may end the subscription. You can re-subscribe at any time.
      </p>

      <h2 style={h2}>Acceptable use</h2>
      <p style={p}>
        You may use RioPoly to create paint visualizations and proposals for legitimate business
        purposes. You may not resell, reverse-engineer, or abuse the service. We may suspend
        accounts that violate these terms or applicable law, without refund.
      </p>

      <h2 style={h2}>Contact</h2>
      <p style={p}>
        Questions about billing, cancellations, or these terms:{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: '#818cf8' }}>
          {SUPPORT_EMAIL}
        </a>
        .
      </p>

      <p style={{ ...p, color: '#64748b', fontSize: 13, marginTop: 28 }}>
        GTANALYZE SOLUTIONS PRIVATE LIMITED · GSTIN 33AALCG6598F1Z7 · Tamil Nadu, India.
      </p>
    </main>
  );
}
