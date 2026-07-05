import { test as setup, expect } from '@playwright/test';
import 'dotenv/config';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';

const authFile = path.join(__dirname, '.auth', 'user.json');
const TEST_EMAIL = 'request@gotoanalyze.com';

// Match the cookie to the target: production (https) uses NextAuth's secure
// __Secure- prefixed cookie; local dev uses the plain name.
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const { protocol, hostname } = new URL(BASE_URL);
const IS_HTTPS = protocol === 'https:';
const COOKIE_NAME = IS_HTTPS ? '__Secure-next-auth.session-token' : 'next-auth.session-token';

// Seed a real NextAuth database session for the existing user, then persist the
// session cookie as Playwright storage state. This authenticates the browser
// without going through the email magic-link (which isn't sent in dev).
setup('authenticate', async () => {
  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  expect(user, `Test user ${TEST_EMAIL} must exist — sign in once via the app first.`).toBeTruthy();

  const sessionToken = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 3600 * 1000);
  await prisma.session.create({ data: { sessionToken, userId: user!.id, expires } });

  const storageState = {
    cookies: [
      {
        name: COOKIE_NAME,
        value: sessionToken,
        domain: hostname,
        path: '/',
        expires: Math.floor(expires.getTime() / 1000),
        httpOnly: true,
        secure: IS_HTTPS,
        sameSite: 'Lax' as const,
      },
    ],
    origins: [],
  };

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  fs.writeFileSync(authFile, JSON.stringify(storageState, null, 2));
  await prisma.$disconnect();
});
