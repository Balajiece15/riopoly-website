'use client';

import { useCallback, useState } from 'react';

export default function CancelSubscriptionButton({ periodEndLabel }: { periodEndLabel?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = useCallback(async () => {
    const msg = periodEndLabel
      ? `Cancel your subscription? You'll keep full access until ${periodEndLabel}, then it won't renew.`
      : `Cancel your subscription? You'll keep access until the end of the current period.`;
    if (!window.confirm(msg)) return;

    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/subscriptions/cancel', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not cancel subscription');
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  }, [periodEndLabel]);

  return (
    <div>
      <button
        type="button"
        onClick={cancel}
        disabled={busy}
        style={{
          background: 'transparent',
          color: '#dc2626',
          border: '1px solid #fecaca',
          borderRadius: 8,
          padding: '8px 16px',
          fontWeight: 600,
          fontSize: 14,
          cursor: 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? 'Cancelling…' : 'Cancel subscription'}
      </button>
      {error && <p style={{ marginTop: 8, fontSize: 13, color: '#dc2626' }}>{error}</p>}
    </div>
  );
}
