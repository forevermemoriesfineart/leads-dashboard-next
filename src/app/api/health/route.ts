import { auth } from '@/lib/auth';
import { upsertLeads, initDB } from '@/lib/db';

export async function GET() {
  await initDB();
  return Response.json({ 
    status: 'ok', 
    service: 'leads-dashboard-next',
    engines: ['Startpage (Google)'],
    db: 'Neon PostgreSQL',
    deployed: true
  });
}
