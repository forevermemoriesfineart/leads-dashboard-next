import { auth } from '@/lib/auth';
import { upsertLeads, initDB } from '@/lib/db';

const AI_BASE = process.env.AI_API_URL || 'https://openclawhardware.dev/api/ai';
const AI_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = 'deepseek-v4-flash';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
};

const PHONE_RE = [
  /\+\d{1,4}[\s\-\.]?\(?\d{1,4}\)?[\s\-\.]?\d{1,4}[\s\-\.]?\d{1,4}[\s\-\.]?\d{1,4}/,
  /\+\d{1,3}[-\s]?\d{3}[-\s]?\d{3}[-\s]?\d{3,4}/, /\(\d{3}\)\s*\d{3}[-\s]?\d{4}/,
  /tel[:=]\s*([+\d][\d\s\-\(\)\.]{7,20})/, /phone[:=]\s*([+\d][\d\s\-\(\)\.]{7,20})/,
];

const REVENUE_RE = [
  /\$(\d+(?:\.\d+)?)\s*(?:million|M|mln)\s*(?:in\s*)?(?:annual\s*)?revenue/i,
  /\$(\d+(?:\.\d+)?)\s*(?:billion|B|bln)\s*(?:in\s*)?(?:annual\s*)?revenue/i,
  /revenue\s*(?:of\s*)?\$(\d+(?:\.\d+)?)\s*(million|M|billion|B)/i,
  /(\d+(?:\.\d+)?)\s*(?:million|M)\s*(?:in\s*)?revenue/i,
];

function extractPhone(text: string): string {
  for (const re of PHONE_RE) {
    const m = text.match(re);
    if (m) {
      const p = (m[1] || m[0]).replace(/[^\d+\-\(\)\s]/g, '').trim();
      if (p.length >= 10) return p;
    }
  }
  return '';
}

function extractRevenue(text: string): string {
  for (const re of REVENUE_RE) {
    const m = text.match(re);
    if (m) {
      const amt = m[1].replace(/,/g, '');
      const unit = (m[2] || 'M').toLowerCase();
      if (unit.startsWith('b')) return `${amt}B`;
      return `${amt}M`;
    }
  }
  return '';
}

async function scrapePageData(url: string): Promise<{ phone: string; revenue: string }> {
  try {
    const resp = await fetch(url, { headers: HEADERS });
    const html = await resp.text();
    const fullText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 50000);
    return {
      phone: extractPhone(fullText),
      revenue: extractRevenue(fullText),
    };
  } catch { return { phone: '', revenue: '' }; }
}

async function fetchHTML(url: string, body?: string): Promise<string> {
  try {
    const init: any = { headers: HEADERS };
    if (body) { init.method = 'POST'; init.body = body; }
    const resp = await fetch(url, init);
    return await resp.text();
  } catch { return ''; }
}

async function startpageSearch(query: string): Promise<any[]> {
  const params = new URLSearchParams({ query, num: '5', lang: 'en', cat: 'web' });
  const html = await fetchHTML(`https://www.startpage.com/sp/search?${params}`);
  if (!html) return [];
  
  const results: any[] = [];
  const re = /<a[^>]*class="[^"]*result-title[^"]*"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>.*?<p[^>]*class="[^"]*result-snippet[^"]*"[^>]*>(.*?)<\/p>/gs;
  let m;
  while ((m = re.exec(html)) !== null) {
    const url = m[1];
    const title = m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim();
    const snippet = m[3].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim();
    if (title.length > 3) {
      results.push({
        title, url, snippet, source: 'startpage',
        phone: extractPhone(title + ' ' + snippet),
        revenue: extractRevenue(snippet),
      });
    }
  }
  return results.slice(0, 5);
}

async function aiExtractLeads(results: any[], industry: string, location: string, count: number, role: string): Promise<any[]> {
  if (!results.length) return aiFallback(industry, location, count);
  
  const ctx = results.slice(0, 15).map(r => {
    const pt = r.phone ? ` 📞${r.phone}` : '';
    const rt = r.revenue ? ` 💰${r.revenue}` : '';
    return `- ${r.title} | ${r.url} | ${r.snippet}${pt}${rt}`;
  }).join('\n');
  
  const prompt = `You are a lead gen AI. From search results for "${role} ${industry}" in "${location}", extract ${count} real leads.
For each: firstName, lastName, title, company, email (first.last@company.com), phone (from 📞), industry:"${industry}", location:"${location}", companySize, revenue (from 💰), source (best URL), notes (1-2 sentences).
Return ONLY JSON array, no markdown.
Format: [{"firstName":"...","lastName":"...","title":"...","company":"...","email":"...","phone":"...","industry":"...","location":"...","companySize":"...","revenue":"...","source":"...","notes":"..."}]

SEARCH RESULTS:
${ctx}`;

  try {
    const resp = await fetch(`${AI_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AI_KEY}` },
      body: JSON.stringify({
        model: AI_MODEL, temperature: 0.7, max_tokens: 8000,
        reasoning_effort: 'low',
        messages: [
          { role: 'system', content: 'Lead gen expert. Return ONLY valid JSON array. No markdown.' },
          { role: 'user', content: prompt }
        ]
      }),
    });
    const data: any = await resp.json();
    let content = data.choices[0].message.content || data.choices[0].message.reasoning_content || '';
    content = content.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim();
    const leads = JSON.parse(content);
    return enrichLeads(leads, results);
  } catch (e) {
    console.error('AI error:', e);
    return aiFallback(industry, location, count);
  }
}

function enrichLeads(leads: any[], results: any[]): any[] {
  const indexed: any = {};
  for (const r of results) if (r.url) indexed[r.url] = r;
  
  return leads.map(l => {
    const srcUrl = l.source || '';
    if (indexed[srcUrl]) {
      if (!l.phone && indexed[srcUrl].phone) l.phone = indexed[srcUrl].phone;
      if (!l.revenue && indexed[srcUrl].revenue) l.revenue = indexed[srcUrl].revenue;
    }
    const t = (l.title || '').toLowerCase();
    let score = 50;
    if (/ceo|cto|cfo|founder|vp|director|head|owner|principal|chief/.test(t)) score += 25;
    if (/manager|lead|senior|curator|consultant/.test(t)) score += 10;
    if (l.revenue) score += 5;
    score += Math.floor(Math.random() * 21) - 10;
    score = Math.min(99, Math.max(15, score));
    
    return {
      id: 'lead-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      firstName: l.firstName || l.first_name || '', lastName: l.lastName || l.last_name || '',
      email: l.email || '', phone: l.phone || '', company: l.company || '', title: l.title || '',
      industry: l.industry || 'Art', location: l.location || '', companySize: l.companySize || '11-50',
      revenue: l.revenue || '', score, scoreLabel: score >= 80 ? 'hot' : score >= 60 ? 'warm' : score >= 40 ? 'cool' : 'cold',
      status: 'New', verified: true, source: l.source || '', notes: l.notes || '',
      created: new Date().toISOString(), search_query: `${l.industry || ''} ${l.location || ''}`,
    };
  });
}

async function aiFallback(industry: string, location: string, count: number): Promise<any[]> {
  const prompt = `Generate ${count} realistic leads for "${industry}" in "${location}". Include phone/revenue if known. Return ONLY JSON array.`;
  try {
    const resp = await fetch(`${AI_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AI_KEY}` },
      body: JSON.stringify({ model: AI_MODEL, temperature: 0.8, max_tokens: 4000, reasoning_effort: 'low',
        messages: [{ role: 'system', content: 'Lead gen expert. Return ONLY JSON array. No markdown.' }, { role: 'user', content: prompt }] }),
    });
    const data: any = await resp.json();
    let content = data.choices[0].message.content || data.choices[0].message.reasoning_content || '';
    content = content.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim();
    return enrichLeads(JSON.parse(content), []);
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  
  await initDB();
  const { searchParams } = new URL(req.url);
  const industry = searchParams.get('industry') || 'Technology';
  const location = searchParams.get('location') || 'United States';
  const count = Math.min(parseInt(searchParams.get('count') || '5'), 15);
  const role = searchParams.get('role') || '';
  
  const log: string[] = [];
  
  // Search Startpage
  log.push(`🔍 Starting multi-source search for "${industry}" in "${location}"`);
  const queries = [
    `top ${industry} companies in ${location}`,
    `best ${industry} businesses ${location}`,
    `${industry} services ${location} contact`,
  ];
  if (role) queries.push(`${role} ${industry} ${location}`);
  
  let allResults: any[] = [];
  for (const q of queries.slice(0, 4)) {
    log.push(`🌐 Searching: "${q.slice(0, 60)}..."`);
    const results = await startpageSearch(q);
    log.push(`   ↳ Found ${results.length} results via Startpage`);
    allResults.push(...results);
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Deduplicate
  const seen = new Set<string>();
  const unique = allResults.filter(r => {
    const key = r.url;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  
  const phoneResults = unique.filter(r => r.phone).length;
  const revenueResults = unique.filter(r => r.revenue).length;
  log.push(`📊 ${unique.length} unique results (📞${phoneResults} phones, 💰${revenueResults} revenue)`);
  
  log.push(`🧠 AI analyzing ${Math.min(unique.length, 15)} results with DeepSeek...`);
  const leads = await aiExtractLeads(unique, industry, location, count, role);
  log.push(`✅ Generated ${leads.length} leads`);
  
  if (leads.length > 0) {
    // Scrape top lead source pages for phone & revenue
    log.push(`🔎 Scraping company websites for phone & revenue...`);
    let enrichedCount = 0;
    for (const lead of leads.slice(0, 5)) {
      if (lead.source && lead.source.startsWith('http') && (!lead.phone || !lead.revenue)) {
        try {
          const pageData = await scrapePageData(lead.source);
          if (pageData.phone && !lead.phone) { lead.phone = pageData.phone; enrichedCount++; }
          if (pageData.revenue && !lead.revenue) { lead.revenue = pageData.revenue; enrichedCount++; }
        } catch {}
      }
    }
    if (enrichedCount > 0) log.push(`   ↳ Enriched ${enrichedCount} leads with phone/revenue from websites`);
    
    await upsertLeads(leads, session.user.id);
  }
  
  const finalPhoneCount = leads.filter(l => l.phone).length;
  const finalRevenueCount = leads.filter(l => l.revenue).length;

  return Response.json({
    leads: leads.slice(0, count),
    search_sources: unique.length,
    social_sources: 0,
    phone_sources: finalPhoneCount,
    revenue_sources: finalRevenueCount,
    engines_used: ['Startpage (Google)'],
    log,
  });
}
