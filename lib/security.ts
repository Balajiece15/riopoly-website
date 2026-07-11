import { prisma } from './prisma';

export interface RlsResult {
  /** All base tables in the public schema. */
  tables: string[];
  /** Tables that were missing RLS before this run (and were fixed). */
  fixed: string[];
  /** True if every public table has RLS enabled after this run. */
  allEnabled: boolean;
}

/**
 * Enforce Row-Level Security on every table in the `public` schema.
 *
 * Supabase exposes a public PostgREST API over `public`, gated only by RLS +
 * the anon key. Our app never uses that API — it connects via Prisma as the
 * table-owner `postgres` role and via the Storage service-role key, both of
 * which BYPASS RLS. Enabling RLS with NO permissive policies therefore denies
 * all anon/PostgREST access while the app is unaffected.
 *
 * Idempotent and self-healing: safe to run on a schedule. Only ever ENABLES
 * RLS (a purely hardening, non-destructive action) — never disables it.
 */
export async function enforceRlsOnPublicTables(): Promise<RlsResult> {
  const rows = await prisma.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`
    SELECT c.relname, c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname;
  `;

  const tables = rows.map((r) => r.relname);
  const missing = rows.filter((r) => !r.relrowsecurity).map((r) => r.relname);

  for (const t of missing) {
    const ident = `"${t.replace(/"/g, '""')}"`;
    await prisma.$executeRawUnsafe(`ALTER TABLE public.${ident} ENABLE ROW LEVEL SECURITY;`);
  }

  return { tables, fixed: missing, allEnabled: true };
}
