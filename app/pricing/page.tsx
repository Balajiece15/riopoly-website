import type { CSSProperties } from 'react';
import Link from 'next/link';
import CheckoutButton from '@/components/CheckoutButton';
import {
  getOneTimePlans,
  getSubscriptionPlans,
  formatINR,
  AFA_THRESHOLD_PAISE,
  type PlanDef,
} from '@/lib/plans';

export const metadata = { title: 'RioPoly — Pricing' };

const card: CSSProperties = {
  background: '#121a33',
  border: '1px solid #1e2a4a',
  borderRadius: 16,
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 18,
};

function PlanCard({ plan }: { plan: PlanDef }) {
  const period = plan.billingPeriod === 'yearly' ? '/yr' : plan.billingPeriod === 'monthly' ? '/mo' : '';
  return (
    <div style={card}>
      <div>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{plan.displayName}</h3>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#94a3b8' }}>{plan.description}</p>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800 }}>
        {formatINR(plan.pricePaise)}
        <span style={{ fontSize: 14, fontWeight: 500, color: '#94a3b8' }}>{period}</span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6, flex: 1 }}>
        {plan.features.map((f) => (
          <li key={f} style={{ fontSize: 14, color: '#cbd5e1' }}>
            <span style={{ color: '#a5b4fc', marginRight: 8 }}>✓</span>
            {f}
          </li>
        ))}
      </ul>
      {plan.pricePaise >= AFA_THRESHOLD_PAISE && plan.kind === 'subscription' && (
        <p style={{ margin: 0, fontSize: 12, color: '#fbbf24' }}>
          Renewals require extra bank authentication (RBI e-Mandate, &gt; ₹15,000/cycle).
        </p>
      )}
      <CheckoutButton
        sku={plan.id}
        kind={plan.kind}
        label={plan.kind === 'subscription' ? 'Subscribe' : 'Buy now'}
      />
    </div>
  );
}

export default function PricingPage() {
  const oneTime = getOneTimePlans();
  const subs = getSubscriptionPlans();

  return (
    <main style={{ maxWidth: 1040, margin: '0 auto', padding: '64px 24px 96px' }}>
      <div style={{ marginBottom: 8 }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 40, color: '#94a3b8', fontSize: 14, textDecoration: 'none' }}>
          ← Back to home
        </a>
      </div>
      <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 6px' }}>Pricing</h1>
      <p style={{ color: '#94a3b8', margin: '0 0 12px' }}>
        Visualize. Propose. Close. All prices are GST-inclusive — the amount shown is what you pay.
        By purchasing you agree to our{' '}
        <Link href="/terms" style={{ color: '#818cf8' }}>
          Terms &amp; no-refund policy
        </Link>{' '}
        (cancel anytime; access continues until period end).
      </p>
      <p style={{ color: '#9fb0c9', margin: '0 0 36px', fontSize: 13 }}>
        You&apos;ll be asked to sign in with your email before payment.
      </p>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 16px' }}>Subscriptions</h2>
        <div style={grid}>
          {subs.map((p) => (
            <PlanCard key={p.id} plan={p} />
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 16px' }}>Project credits (one-time)</h2>
        <div style={grid}>
          {oneTime.map((p) => (
            <PlanCard key={p.id} plan={p} />
          ))}
        </div>
      </section>

      <p style={{ color: '#9fb0c9', fontSize: 12, marginTop: 40 }}>
        All payments are final and non-refundable. Subscriptions renew automatically until
        cancelled; cancel anytime and access continues until the end of the paid period. See our{' '}
        <Link href="/terms" style={{ color: '#818cf8' }}>
          Terms &amp; Refund Policy
        </Link>
        . GST invoice issued for every payment by GTANALYZE SOLUTIONS PRIVATE LIMITED, GSTIN
        33AALCG6598F1Z7.
      </p>
    </main>
  );
}
