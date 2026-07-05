import type { CSSProperties } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { getBillingSummary } from '@/lib/billing';
import { formatINR } from '@/lib/plans';
import CancelSubscriptionButton from '@/components/CancelSubscriptionButton';

export const metadata = { title: 'RioPoly — Billing' };
export const dynamic = 'force-dynamic';

const fmtDate = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(d) : '—';

const card: CSSProperties = {
  background: '#121a33',
  border: '1px solid #1e2a4a',
  borderRadius: 16,
  padding: 24,
  marginBottom: 20,
};

const cta: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 10,
  background: '#6366f1',
  color: '#fff',
  padding: '10px 18px',
  fontWeight: 600,
  fontSize: 14,
  textDecoration: 'none',
};

const ctaGhost: CSSProperties = { ...cta, background: 'transparent', border: '1px solid #334155', color: '#e2e8f0' };

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/billing');

  const { creditBalance, unlimited, subscription, orders } = await getBillingSummary(user.id);
  const processing = searchParams?.status === 'processing';

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '56px 24px 96px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0 }}>Billing</h1>
          <p style={{ color: '#94a3b8', margin: '6px 0 0', fontSize: 14 }}>{user.email}</p>
        </div>
        <Link href="/pricing" style={cta}>
          Upgrade / Buy credits
        </Link>
      </header>

      {processing && (
        <div
          style={{
            ...card,
            marginBottom: 20,
            background: '#1a2547',
            borderColor: '#6366f1',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 18 }}>⏳</span>
          <span style={{ fontSize: 14, color: '#cbd5e1' }}>
            Payment received — we&apos;re confirming it. Your access &amp; invoice appear here within a moment.
          </span>
        </div>
      )}

      {/* Access summary */}
      <section style={card}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Your access
        </h2>
        {unlimited ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                background: '#6366f1',
                color: '#fff',
                padding: '4px 12px',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Unlimited
            </span>
            <span style={{ color: '#cbd5e1', fontSize: 14 }}>
              Unlimited projects via your active subscription.
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 15 }}>
            <strong style={{ fontSize: 28, fontWeight: 800 }}>{creditBalance}</strong>{' '}
            <span style={{ color: '#94a3b8' }}>project credit{creditBalance === 1 ? '' : 's'} available</span>
            {creditBalance === 0 && (
              <p style={{ color: '#94a3b8', fontSize: 14, margin: '10px 0 0' }}>
                You&apos;re on the free tier (1 saved project, watermarked exports).{' '}
                <Link href="/pricing" style={{ color: '#818cf8' }}>
                  Buy credits or subscribe →
                </Link>
              </p>
            )}
          </div>
        )}
      </section>

      {/* Subscription */}
      {subscription && (
        <section style={card}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Subscription
          </h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{subscription.plan.displayName}</div>
              <div style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>
                {formatINR(subscription.plan.pricePaise)} ·{' '}
                {subscription.cancelAtCycleEnd
                  ? `Cancels on ${fmtDate(subscription.currentEnd)}`
                  : `Renews on ${fmtDate(subscription.currentEnd)}`}
              </div>
              <div style={{ marginTop: 8 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: subscription.cancelAtCycleEnd ? '#3f2937' : '#14331f',
                    color: subscription.cancelAtCycleEnd ? '#fca5a5' : '#86efac',
                  }}
                >
                  {subscription.cancelAtCycleEnd ? 'Cancelling at period end' : `Status: ${subscription.status}`}
                </span>
              </div>
            </div>
            {!subscription.cancelAtCycleEnd && (
              <CancelSubscriptionButton periodEndLabel={fmtDate(subscription.currentEnd)} />
            )}
          </div>
        </section>
      )}

      {/* Order history */}
      <section style={card}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Order history
        </h2>
        {orders.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>
            No orders yet.{' '}
            <Link href="/pricing" style={{ color: '#818cf8' }}>
              View pricing →
            </Link>
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#94a3b8', fontSize: 12, textTransform: 'uppercase' }}>
                  <th style={{ padding: '8px 8px 8px 0' }}>Date</th>
                  <th style={{ padding: 8 }}>Item</th>
                  <th style={{ padding: 8 }}>Amount</th>
                  <th style={{ padding: 8 }}>Status</th>
                  <th style={{ padding: 8 }}>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} style={{ borderTop: '1px solid #1e2a4a' }}>
                    <td style={{ padding: '12px 8px 12px 0', whiteSpace: 'nowrap' }}>{fmtDate(o.createdAt)}</td>
                    <td style={{ padding: 12 }}>
                      {o.plan.displayName}
                      {o.kind === 'subscription_cycle' && (
                        <span style={{ color: '#94a3b8', fontSize: 12 }}> · renewal</span>
                      )}
                    </td>
                    <td style={{ padding: 12, whiteSpace: 'nowrap' }}>{formatINR(o.amountPaise)}</td>
                    <td style={{ padding: 12 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: o.status === 'refunded' ? '#fca5a5' : '#86efac',
                        }}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td style={{ padding: 12, whiteSpace: 'nowrap' }}>
                      {o.invoice ? (
                        o.invoice.pdfUrl ? (
                          <a
                            href={`/api/invoices/${o.invoice.id}`}
                            style={{ color: '#818cf8', textDecoration: 'none' }}
                          >
                            {o.invoice.invoiceNumber} ↓
                          </a>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 13 }}>
                            {o.invoice.invoiceNumber} (generating…)
                          </span>
                        )
                      ) : (
                        <span style={{ color: '#64748b' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <Link href="/pricing" style={cta}>
          Buy credits
        </Link>
        <Link href="/pricing" style={ctaGhost}>
          Upgrade plan
        </Link>
      </div>

      <p style={{ color: '#64748b', fontSize: 12, marginTop: 28 }}>
        No refunds. Cancel anytime; access continues until the end of your billing period. See our{' '}
        <Link href="/terms" style={{ color: '#818cf8' }}>
          Terms &amp; Refund Policy
        </Link>
        . Invoices issued by GTANALYZE SOLUTIONS PRIVATE LIMITED, GSTIN 33AALCG6598F1Z7.
      </p>
    </main>
  );
}
