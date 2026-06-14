import { auth } from '@/lib/auth';
import { getStats, initDB } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  
  await initDB();
  const stats = await getStats(session.user.id);
  
  const total = parseInt(stats.total) || 0;
  const verified = parseInt(stats.verified) || 0;
  const won = parseInt(stats.won) || 0;
  
  return Response.json({
    total,
    verified,
    hot: parseInt(stats.hot) || 0,
    won,
    new_count: parseInt(stats.new_count) || 0,
    with_revenue: parseInt(stats.with_revenue) || 0,
    with_phone: parseInt(stats.with_phone) || 0,
    verification_rate: total > 0 ? Math.round((verified / total) * 100) : 0,
    conversion_rate: total > 0 ? Math.round((won / total) * 100) : 0,
  });
}
