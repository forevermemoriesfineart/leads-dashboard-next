import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export async function query(queryString: string, params: any[] = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(queryString, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function initDB() {
  await query(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT DEFAULT '',
      company TEXT NOT NULL,
      title TEXT NOT NULL,
      industry TEXT DEFAULT '',
      location TEXT DEFAULT '',
      company_size TEXT DEFAULT '',
      revenue TEXT DEFAULT '',
      score INTEGER DEFAULT 50,
      score_label TEXT DEFAULT 'cool',
      status TEXT DEFAULT 'New',
      verified BOOLEAN DEFAULT true,
      source TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_contact TIMESTAMPTZ,
      search_query TEXT DEFAULT '',
      user_id TEXT NOT NULL DEFAULT 'default'
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_user ON leads(user_id);
    CREATE INDEX IF NOT EXISTS idx_leads_industry ON leads(industry);
    CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score);
  `);
}

export async function getLeads(userId: string, filters: any = {}) {
  const conditions = ['user_id = $1'];
  const params: any[] = [userId];
  let i = 2;

  if (filters.status) { conditions.push(`status = $${i++}`); params.push(filters.status); }
  if (filters.industry) { conditions.push(`industry = $${i++}`); params.push(filters.industry); }
  if (filters.minScore > 0) { conditions.push(`score >= $${i++}`); params.push(filters.minScore); }
  if (filters.search) {
    conditions.push(`(first_name ILIKE $${i} OR last_name ILIKE $${i} OR email ILIKE $${i} OR company ILIKE $${i})`);
    params.push(`%${filters.search}%`); i++;
  }

  const orderMap: any = { score: 'score DESC', name: 'first_name ASC', company: 'company ASC', created: 'created_at DESC' };
  const order = orderMap[filters.sort] || 'created_at DESC';

  return query(
    `SELECT * FROM leads WHERE ${conditions.join(' AND ')} ORDER BY ${order} LIMIT $${i}`,
    [...params, filters.limit || 500]
  );
}

export async function upsertLeads(leads: any[], userId: string) {
  for (const lead of leads) {
    await query(`
      INSERT INTO leads (id, first_name, last_name, email, phone, company, title, industry, location, company_size, revenue, score, score_label, status, verified, source, notes, created_at, search_query, user_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      ON CONFLICT (id) DO UPDATE SET
        first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, email = EXCLUDED.email,
        phone = EXCLUDED.phone, company = EXCLUDED.company, title = EXCLUDED.title,
        revenue = EXCLUDED.revenue, score = EXCLUDED.score, status = EXCLUDED.status,
        notes = EXCLUDED.notes, last_contact = EXCLUDED.last_contact
    `, [
      lead.id, lead.firstName || lead.first_name, lead.lastName || lead.last_name,
      lead.email, lead.phone || '', lead.company, lead.title,
      lead.industry, lead.location, lead.companySize || lead.company_size || '',
      lead.revenue || '', lead.score || 50, lead.scoreLabel || lead.score_label || 'cool',
      lead.status || 'New', lead.verified !== false,
      lead.source || '', lead.notes || '', lead.created || new Date().toISOString(),
      lead.search_query || '', userId
    ]);
  }
}

export async function updateLead(id: string, updates: any, userId: string) {
  const allowed = ['status', 'notes', 'phone', 'revenue', 'score', 'score_label', 'verified'];
  const filtered: any = {};
  for (const k of allowed) {
    if (k in updates) filtered[k] = updates[k];
  }
  if (Object.keys(filtered).length === 0) return;
  
  filtered.last_contact = new Date().toISOString();
  
  const sets = Object.keys(filtered).map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = Object.values(filtered);
  values.push(id, userId);
  
  await query(
    `UPDATE leads SET ${sets} WHERE id = $${values.length - 1} AND user_id = $${values.length}`,
    values
  );
}

export async function deleteLead(id: string, userId: string) {
  await query('DELETE FROM leads WHERE id = $1 AND user_id = $2', [id, userId]);
}

export async function getStats(userId: string) {
  const results = await query(`
    SELECT 
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE verified = true)::int as verified,
      COUNT(*) FILTER (WHERE score >= 80)::int as hot,
      COUNT(*) FILTER (WHERE status = 'Won')::int as won,
      COUNT(*) FILTER (WHERE status = 'New')::int as new_count,
      COUNT(*) FILTER (WHERE revenue != '')::int as with_revenue,
      COUNT(*) FILTER (WHERE phone != '')::int as with_phone
    FROM leads WHERE user_id = $1
  `, [userId]);
  
  return results[0] || { total: 0, verified: 0, hot: 0, won: 0, new_count: 0, with_revenue: 0, with_phone: 0 };
}

export async function findUser(email: string) {
  const results = await query('SELECT * FROM users WHERE email = $1', [email]);
  return results[0] || null;
}

export async function createUser(email: string, passwordHash: string, name: string) {
  const id = 'usr-' + Date.now();
  await query(
    'INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4)',
    [id, email, passwordHash, name]
  );
  return { id, email, name };
}
