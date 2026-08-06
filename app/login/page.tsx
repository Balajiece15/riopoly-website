'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { isValidEmail } from '@/lib/validation';

const ERROR_MESSAGES: Record<string, string> = {
  EmailSignin: "We couldn't send the sign-in email. Please try again in a moment, or contact support@gotoanalyze.com if it persists.",
  Verification: 'That sign-in link has expired or was already used. Request a new one below.',
  Configuration: 'Sign-in is temporarily unavailable. Please try again shortly.',
  Default: 'Something went wrong while signing in. Please try again.',
};


function LoginInner() {
  const params = useSearchParams();
  const checkEmail = params.get('check') === 'email';
  const next = params.get('next') ?? '/billing';
  const errorCode = params.get('error');
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default : null;
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setInlineError('Please enter a valid email address (e.g. you@company.com).');
      return;
    }
    setInlineError(null);
    setSubmitting(true);
    // Stay on this page on failure so we can show the error inline.
    await signIn('email', { email: trimmed, callbackUrl: next, redirect: false })
      .then((res) => {
        if (res?.error) {
          window.location.href = `/login?error=${encodeURIComponent(res.error)}&next=${encodeURIComponent(next)}`;
          return;
        }
        window.location.href = '/login?check=email';
      })
      .catch(() => {
        setSubmitting(false);
        setInlineError('Network error — please check your connection and try again.');
      });
  }

  const shownError = inlineError ?? errorMessage;

  return (
    <main style={{ maxWidth: 420, margin: '96px auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>Sign in to RioPoly</h1>
      {shownError && (
        <p
          role="alert"
          style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(220,38,38,0.12)',
            border: '1px solid rgba(220,38,38,0.4)',
            color: '#fca5a5',
            fontSize: 14,
          }}
        >
          {shownError}
        </p>
      )}
      {checkEmail ? (
        <p style={{ color: '#94a3b8' }}>
          Check your inbox for a sign-in link. It expires in 15 minutes.
        </p>
      ) : (
        <form onSubmit={onSubmit} style={{ marginTop: 20 }}>
          <input
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (inlineError) setInlineError(null);
            }}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid #334155',
              background: '#0f172a',
              color: '#e2e8f0',
            }}
          />
          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: 12,
              width: '100%',
              padding: '12px 14px',
              borderRadius: 8,
              border: 'none',
              fontWeight: 600,
              color: '#fff',
              background: 'linear-gradient(135deg,#6366f1,#38bdf8)',
              cursor: 'pointer',
            }}
          >
            {submitting ? 'Sending link…' : 'Email me a sign-in link'}
          </button>
        </form>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
