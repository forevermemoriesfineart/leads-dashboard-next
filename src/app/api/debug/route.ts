import { initDB } from '@/lib/db';

export async function GET() {
  const checks: any = {
    auth_secret: !!process.env.AUTH_SECRET ? 'set' : 'MISSING',
    database_url: !!process.env.DATABASE_URL ? 'set' : 'MISSING',
    ai_api_key: process.env.AI_API_KEY ? 'set (env)' : 'using fallback',
  };

  // Test DB connection
  try {
    await initDB();
    checks.db_connected = true;
  } catch (e: any) {
    checks.db_connected = false;
    checks.db_error = e.message?.slice(0, 100);
  }

  return Response.json(checks);
}
