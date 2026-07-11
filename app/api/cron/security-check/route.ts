import { NextResponse } from 'next/server';
import { enforceRlsOnPublicTables } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Daily self-healing security sweep (Vercel Cron — see vercel.json).
// Ensures Row-Level Security is enabled on EVERY public table, so a table added
// by a future migration can't sit publicly exposed via Supabase's PostgREST API.
//
// This endpoint only ENABLES RLS (a hardening, non-destructive action) so it is
// safe even if called by anyone. If CRON_SECRET is set, we still require it
// (Vercel sends `Authorization: Bearer $CRON_SECRET` for cron invocations).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  try {
    const { tables, fixed } = await enforceRlsOnPublicTables();
    if (fixed.length) {
      // Surfaces in Vercel logs so a regression is visible.
      console.warn(`[security] RLS self-healed on: ${fixed.join(', ')}`);
    }
    return NextResponse.json({
      ok: true,
      checked: tables.length,
      fixed,
      ts: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
