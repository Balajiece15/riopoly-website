/**
 * Discover the Supabase connection-pooler region by trying to connect.
 * Uses the existing DB password; prints the working pooler DATABASE_URL.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const REF = 'oxumdcsqbftxoprmdlug';
const PWD_ENC = encodeURIComponent('Statebalaji19$');

const REGIONS = [
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
];

function poolerUrl(region: string): string {
  return `postgresql://postgres.${REF}:${PWD_ENC}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`;
}

async function tryRegion(region: string): Promise<boolean> {
  const url = poolerUrl(region);
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    console.log(`\n✅ WORKING REGION: ${region}`);
    console.log(`DATABASE_URL=${url}`);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message.split('\n')[0] : String(e);
    console.log(`  ✗ ${region}: ${msg.slice(0, 80)}`);
    return false;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

async function main() {
  console.log('Probing Supabase pooler regions...');
  for (const region of REGIONS) {
    if (await tryRegion(region)) return;
  }
  console.log('\n❌ No region matched. The pooler string must be copied from Supabase dashboard.');
}

main();
