/*
 * Enable Row-Level Security on every table in the `public` schema.
 *
 * Why: Supabase exposes a PostgREST API over `public`, gated by RLS + the anon
 * key. Our app NEVER uses that API — it uses Prisma over the direct Postgres
 * connection (table-owner `postgres` role) and Storage via the service-role key,
 * both of which BYPASS RLS. So enabling RLS with NO permissive policies denies
 * all anon/authenticated (PostgREST) access while the app keeps full access.
 *
 * Idempotent and safe to re-run.  Run:  npx tsx scripts/enable-rls.ts
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma';

async function main() {
  const before = await prisma.user.count();
  console.log(`DB reachable. Users before: ${before}\n`);

  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
  `;
  console.log(`Public tables (${tables.length}): ${tables.map((t) => t.tablename).join(', ')}\n`);

  for (const { tablename } of tables) {
    const ident = `"${tablename.replace(/"/g, '""')}"`;
    await prisma.$executeRawUnsafe(`ALTER TABLE public.${ident} ENABLE ROW LEVEL SECURITY;`);
    console.log(`  RLS enabled → ${tablename}`);
  }

  const status = await prisma.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`
    SELECT c.relname, c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname;
  `;
  console.log('\nVerification:');
  for (const s of status) console.log(`  ${s.relrowsecurity ? '✅' : '❌'} ${s.relname}`);
  const missing = status.filter((s) => !s.relrowsecurity);

  const after = await prisma.user.count();
  console.log(`\nApp still reads DB via Prisma (owner bypasses RLS). Users after: ${after}`);

  if (missing.length) {
    console.error(`\n❌ RLS still OFF on: ${missing.map((s) => s.relname).join(', ')}`);
    process.exit(1);
  }
  console.log('\n✅ All public tables have RLS enabled. Anon/PostgREST access is denied by default.');
}

main()
  .catch((e) => {
    console.error('FAILED:', e?.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
