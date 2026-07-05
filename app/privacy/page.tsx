import type { CSSProperties } from 'react';
import Link from 'next/link';

export const metadata = { title: 'RioPoly — Privacy Policy' };

const SUPPORT_EMAIL = 'Request@gotoanalyze.com';
const LAST_UPDATED = 'June 2026';

const wrap: CSSProperties = { maxWidth: 820, margin: '0 auto', padding: '56px 24px 96px', lineHeight: 1.7 };
const h2: CSSProperties = { fontSize: 20, fontWeight: 700, margin: '36px 0 10px' };
const p: CSSProperties = { color: '#cbd5e1', margin: '0 0 12px', fontSize: 15 };
const li: CSSProperties = { color: '#cbd5e1', fontSize: 15, marginBottom: 8 };

export default function PrivacyPage() {
  return (
    <main style={wrap}>
      <a href="/" style={{ color: '#94a3b8', fontSize: 14, textDecoration: 'none' }}>
        ← Back to home
      </a>

      <h1 style={{ fontSize: 30, fontWeight: 800, margin: '14px 0 4px' }}>Privacy Policy</h1>
      <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 8px' }}>Last updated: {LAST_UPDATED}</p>

      <p style={p}>
        This policy explains how <strong>GTANALYZE SOLUTIONS PRIVATE LIMITED</strong> (GSTIN{' '}
        <strong>33AALCG6598F1Z7</strong>), operator of RioPoly, collects and uses your information.
        We keep it simple: we collect only what we need to run the service and never sell your data.
      </p>

      <h2 style={h2}>Information we collect</h2>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li style={li}>
          <strong>Contact details</strong> you submit through our demo/enquiry form (name, phone,
          email, and message).
        </li>
        <li style={li}>
          <strong>Account information</strong> — the email address you use to sign in.
        </li>
        <li style={li}>
          <strong>Billing information</strong> — plan and payment records needed to issue GST
          invoices. Card and bank details are handled entirely by our payment gateway (Razorpay);
          we never see or store your full card details.
        </li>
        <li style={li}>
          <strong>Content you create</strong> — projects, colour schemes, and files you save in the
          3D Studio.
        </li>
        <li style={li}>
          <strong>Basic usage data</strong> needed to keep the service secure and working.
        </li>
      </ul>

      <h2 style={h2}>How we use it</h2>
      <p style={p}>
        To provide and improve RioPoly, respond to your enquiries, process payments, issue tax
        invoices, and send essential service emails (such as sign-in links and receipts). We do not
        sell your personal information to third parties.
      </p>

      <h2 style={h2}>Who we share it with</h2>
      <p style={p}>
        Only trusted service providers who help us operate: our payment gateway (Razorpay),
        email/hosting/database providers, and authorities where required by law. Each processes your
        data only to provide their service to us.
      </p>

      <h2 style={h2}>Data retention &amp; security</h2>
      <p style={p}>
        We retain account, billing, and invoice records for as long as required for the service and
        to meet tax and legal obligations. We apply reasonable safeguards to protect your data,
        though no method of transmission or storage is completely secure.
      </p>

      <h2 style={h2}>Your choices</h2>
      <p style={p}>
        You can request access to, correction of, or deletion of your personal data (subject to
        records we must legally keep). Email us and we&apos;ll help.
      </p>

      <h2 style={h2}>Contact</h2>
      <p style={p}>
        Questions about privacy or your data:{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: '#818cf8' }}>
          {SUPPORT_EMAIL}
        </a>
        . See also our{' '}
        <Link href="/terms" style={{ color: '#818cf8' }}>
          Terms &amp; Refund Policy
        </Link>
        .
      </p>

      <p style={{ ...p, color: '#64748b', fontSize: 13, marginTop: 28 }}>
        GTANALYZE SOLUTIONS PRIVATE LIMITED · GSTIN 33AALCG6598F1Z7 · Tamil Nadu, India.
      </p>
    </main>
  );
}
