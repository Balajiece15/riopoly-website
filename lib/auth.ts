import type { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import EmailProvider from 'next-auth/providers/email';
import { Resend } from 'resend';
import { prisma } from './prisma';

const EMAIL_FROM = process.env.EMAIL_FROM ?? 'RioPoly <onboarding@resend.dev>';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'database' },
  pages: {
    signIn: '/login',
    verifyRequest: '/login?check=email',
  },
  providers: [
    EmailProvider({
      from: EMAIL_FROM,
      maxAge: 15 * 60, // magic link valid 15 minutes
      async sendVerificationRequest({ identifier, url }) {
        // In dev without a verified Resend domain, fall back to console.
        if (process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY) {
          console.log(`\n[auth] Magic sign-in link for ${identifier}:\n${url}\n`);
          return;
        }
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: EMAIL_FROM,
          to: identifier,
          subject: 'Your RioPoly sign-in link',
          html: `
            <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto">
              <h2 style="color:#312e81">Sign in to RioPoly</h2>
              <p>Click the button below to sign in. This link expires in 15 minutes.</p>
              <p><a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#38bdf8);color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Sign in to RioPoly</a></p>
              <p style="color:#64748b;font-size:13px">If you didn't request this, you can ignore this email.</p>
            </div>`,
        });
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};
