'use client';

import { useCallback, useState, type CSSProperties } from 'react';

type PlanKind = 'one_time' | 'subscription';

interface CheckoutButtonProps {
  sku: string;
  kind: PlanKind;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

interface RazorpayOptions {
  key: string;
  name: string;
  description?: string;
  order_id?: string;
  subscription_id?: string;
  prefill?: { email?: string; name?: string; contact?: string };
  theme?: { color?: string };
  handler?: (response: unknown) => void;
  modal?: { ondismiss?: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const DEFAULT_BTN_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 10,
  background: '#4f46e5',
  color: '#fff',
  border: 'none',
  padding: '12px 22px',
  minHeight: 44,
  fontWeight: 600,
  fontSize: 15,
  cursor: 'pointer',
  width: '100%',
};

export default function CheckoutButton({ sku, kind, label, className, style }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const endpoint =
        kind === 'subscription' ? '/api/subscriptions/create' : '/api/orders/create';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku }),
      });

      if (res.status === 401) {
        // Not signed in — send to login, then back to checkout.
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `Could not start checkout (HTTP ${res.status})`);

      const ok = await loadRazorpay();
      if (!ok || !window.Razorpay) throw new Error('Failed to load Razorpay Checkout');

      const options: RazorpayOptions = {
        key: data.keyId,
        name: data.name,
        description: data.description,
        prefill: data.prefill,
        theme: { color: '#6366f1' },
        // Source of truth for fulfillment is the webhook, not this callback.
        // Here we just route the user to a "confirming" state.
        handler: () => {
          window.location.href = '/billing?status=processing';
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      };

      if (data.type === 'subscription') {
        options.subscription_id = data.subscriptionId;
      } else {
        options.order_id = data.orderId;
      }

      new window.Razorpay(options).open();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setLoading(false);
    }
  }, [sku, kind]);

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className={className}
        style={className ? style : { ...DEFAULT_BTN_STYLE, opacity: loading ? 0.6 : 1, ...style }}
      >
        {loading ? 'Starting…' : label ?? 'Buy now'}
      </button>
      {error && <p style={{ marginTop: 8, fontSize: 13, color: '#dc2626' }}>{error}</p>}
    </div>
  );
}
