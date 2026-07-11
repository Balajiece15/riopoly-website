/*
 * Enable Row-Level Security on every table in the `public` schema (manual run).
 *
 * The same logic runs automatically every day via the /api/cron/security-check
 * endpoint (see vercel.json). Use this script for an immediate, on-demand pass —
 * e.g. right after a migration that adds a new table, so you don't wait for the
 * daily cron. Idempotent and safe to re-run.
 *
 * Run:  npx tsx scripts/enable-rls.ts
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { enforceRlsOnPublicTables } from '../lib/security';

async function main() {
  const before = await prisma.user.count();
  console.log(`DB reachable. Users: ${before}\n`);

  const { tables, fixed } = await enforceRlsOnPublicTables();
  console.log(`Public tables (${tables.length}): ${tables.join(', ')}\n`);
  if (fixed.length) {
    for (const t of fixed) console.log(`  RLS enabled → ${t}`);
  } else {
    console.log('  All tables already had RLS enabled (nothing to fix).');
  }

  // Verify + confirm the app still reads (Prisma bypasses RLS as owner).
  const status = await prisma.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`
    SELECT c.relname, c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname;
  `;
  console.log('\nVerification:');
  for (const s of status) console.log(`  ${s.relrowsecurity ? '✅' : '❌'} ${s.relname}`);
  const stillOff = status.filter((s) => !s.relrowsecurity);

  const after = await prisma.user.count();
  console.log(`\nApp still reads DB via Prisma. Users: ${after}`);

  if (stillOff.length) {
    console.error(`\n❌ RLS still OFF on: ${stillOff.map((s) => s.relname).join(', ')}`);
    process.exit(1);
  }
  console.log('\n✅ All public tables have RLS enabled. Anon/PostgREST access is denied.');
}

main()
  .catch((e) => {
    console.error('FAILED:', e?.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
