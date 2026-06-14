import { auth } from '@/lib/auth';
import { getLeads, upsertLeads, updateLead, deleteLead, initDB } from '@/lib/db';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  
  await initDB();
  const { searchParams } = new URL(req.url);
  const leads = await getLeads(session.user.id, {
    status: searchParams.get('status') || undefined,
    industry: searchParams.get('industry') || undefined,
    minScore: parseInt(searchParams.get('min_score') || '0'),
    search: searchParams.get('search') || '',
    sort: searchParams.get('sort') || 'created',
    limit: 500,
  });
  
  return Response.json({ leads, total: leads.length });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  
  await initDB();
  const body = await req.json();
  
  if (Array.isArray(body)) {
    await upsertLeads(body, session.user.id);
    return Response.json({ status: 'saved', count: body.length });
  }
  
  // Single lead update
  if (body.id && body._action === 'update') {
    await updateLead(body.id, body, session.user.id);
    return Response.json({ status: 'updated' });
  }
  
  if (body.id && body._action === 'delete') {
    await deleteLead(body.id, session.user.id);
    return Response.json({ status: 'deleted' });
  }
  
  return Response.json({ error: 'Invalid request' }, { status: 400 });
}
