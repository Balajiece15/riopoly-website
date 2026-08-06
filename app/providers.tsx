'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

// Auth in this app is entirely server-side (getServerSession); no component uses
// the client useSession() hook. So we disable the background session polling and
// window-focus refetch — they add no value here and their in-flight requests can
// abort during navigation, logging a harmless next-auth CLIENT_FETCH_ERROR.
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      {children}
    </SessionProvider>
  );
}
