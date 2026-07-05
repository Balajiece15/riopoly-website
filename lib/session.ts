import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
}

/** Returns the signed-in user (with DB id) or null. Server-only. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}
