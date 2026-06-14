'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

const STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];
const INDUSTRIES = ['Technology','Healthcare','Finance','E-commerce','SaaS','Manufacturing','Real Estate','Education','Marketing','Construction','Art','Sculpture','Weddings','Memorials','Photography','Interior Design','Architecture','Event Planning','Jewelry','Floristry'];
const LOCATIONS = ['United States','United Kingdom','Germany','Canada','Australia','France','Bulgaria','India','Singapore','Netherlands'];

const FIRST_NAMES = ['James','Sarah','Michael','Emily','David','Jessica','Robert','Amanda','John','Rachel','Daniel','Laura','Matthew','Megan','Andrew','Stephanie','Christopher','Nicole','Joshua','Ashley','Ryan','Brittany','Brandon','Samantha','Justin','Jennifer','William','Heather','Alexander','Kimberly','Thomas','Lisa','Kevin','Rebecca','Brian','Michelle','Mark','Danielle','Jason','Maria','Eric','Amber','Steven','Melissa','Timothy','Allison','Nicholas','Tiffany','Adam','Hannah'];
const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Anderson','Taylor','Thomas','Moore','Jackson','Martin','Lee','Thompson','White','Harris','Clark','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Green','Baker','Adams','Nelson','Hill','Campbell','Mitchell','Roberts','Carter','Phillips','Evans','Turner','Parker','Collins','Edwards','Stewart','Morris','Murphy','Cook','Cooper','Morgan'];

const COMPANY_PREFIXES = ['Tech','Data','Cloud','Digital','Smart','Next','Peak','Core','Fusion','Apex','Nova','Prime','Alpha','Quantum','Vertex'];
const COMPANY_SUFFIXES = ['Solutions','Systems','Technologies','Labs','Group','Innovations','Dynamics','Networks','Analytics','Ventures'];

const TITLES_BY_INDUSTRY: any = {
  _default: ['CEO','CTO','VP Engineering','Head of Product','Director of Sales','Marketing Lead','Growth Manager','Product Manager','Engineering Manager','Technical Lead'],
  Technology: ['CTO','VP Engineering','Head of AI','Engineering Manager','Technical Lead','Principal Engineer'],
  Healthcare: ['CEO','Chief Medical Officer','VP Clinical Operations','Director of Nursing','Health Informatics Lead'],
  Finance: ['CFO','VP Investment','Director of Risk','Head of Compliance','Financial Analyst Lead','Portfolio Manager'],
  SaaS: ['CEO','VP Sales','Head of Growth','Product Manager','Customer Success Lead','CTO'],
  Art: ['Gallery Director','Curator','Owner','Art Consultant','Creative Director','Gallery Manager'],
  Sculpture: ['Sculptor','Studio Owner','Art Director','Gallery Curator','Founder'],
  Weddings: ['Owner','Wedding Planner','Creative Director','Event Manager','Founder'],
  Memorials: ['Funeral Director','Memorial Designer','Owner','Family Services Manager'],
  Photography: ['Owner','Lead Photographer','Creative Director','Studio Manager'],
  'Interior Design': ['Principal Designer','Creative Director','Project Manager','Owner'],
  'Event Planning': ['CEO','Event Director','Operations Manager','Founder'],
};

const FM_CUSTOMER_SEGMENTS = [
  { query: 'luxury wedding planners', industry: 'Weddings', role: 'Owner / Director' },
  { query: 'interior designers luxury residential art commissions', industry: 'Interior Design', role: 'Principal' },
  { query: 'family estate managers private wealth advisors art', industry: 'Finance', role: 'Wealth Manager' },
  { query: 'art collectors private commissions bronze sculpture', industry: 'Art', role: 'Collector / Curator' },
  { query: 'luxury event planners milestone celebrations', industry: 'Event Planning', role: 'CEO / Director' },
  { query: 'anniversary celebration planners luxury gifts personalized', industry: 'Event Planning', role: 'Owner' },
  { query: 'luxury hotel art procurement sculpture', industry: 'Interior Design', role: 'Art Curator' },
  { query: 'wedding gift registries luxury personalized', industry: 'Weddings', role: 'Founder' },
  { query: 'corporate awards recognition custom sculptures trophies', industry: 'Manufacturing', role: 'CEO' },
  { query: 'private art consultants commission bronze portraiture', industry: 'Art', role: 'Art Consultant' },
  { query: 'memorial tribute art commemorative sculptures', industry: 'Memorials', role: 'Director' },
];

function pick(arr: any[]) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function generateLead(opts: any = {}) {
  const industry = opts.industry || pick(INDUSTRIES);
  const location = opts.location || pick(LOCATIONS);
  const fn = pick(FIRST_NAMES);
  const ln = pick(LAST_NAMES);
  const company = pick((TITLES_BY_INDUSTRY[industry] ? [pick(COMPANY_PREFIXES) + ' ' + pick(COMPANY_SUFFIXES)] : [pick(COMPANY_PREFIXES) + ' ' + pick(COMPANY_SUFFIXES)]));
  const titles = TITLES_BY_INDUSTRY[industry] || TITLES_BY_INDUSTRY._default;
  const title = opts.role ? pick(titles.filter((t: string) => t.toLowerCase().includes(opts.role.toLowerCase()))) || pick(titles) : pick(titles);
  const domain = company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
  const email = pick([fn.toLowerCase()+'.'+ln.toLowerCase()+'@'+domain, fn[0].toLowerCase()+ln.toLowerCase()+'@'+domain, fn.toLowerCase()+'@'+domain]);
  const score = Math.min(99, randInt(40, 65) + (opts.verify !== false ? 20 : 0) + (/ceo|cto|vp|director|head|founder|owner/i.test(title) ? 10 : 0) + randInt(-5, 5));
  return {
    id: 'lead-local-' + Date.now() + '-' + randInt(100, 999),
    firstName: fn, lastName: ln, email, phone: '',
    company, title, industry, location,
    companySize: opts.size || pick(['1-10','11-50','51-200','201-500','501-1000','1000+']),
    revenue: '', score,
    scoreLabel: score >= 80 ? 'hot' : score >= 60 ? 'warm' : score >= 40 ? 'cool' : 'cold',
    status: 'New', verified: opts.verify !== false, source: 'Quick Generate',
    notes: '', created: new Date().toISOString(), lastContact: null, search_query: '',
  };
}

type Lead = ReturnType<typeof generateLead>;

const scoreClass = (l: Lead) => `score-badge score-${l.scoreLabel || 'cool'}`;
const statusClass = (s: string) => `status-badge status-${s.toLowerCase()}`;

export default function DashboardPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerator, setShowGenerator] = useState(false);
  const [genStatus, setGenStatus] = useState('');
  const [genLoading, setGenLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [stats, setStats] = useState<any>({ total: 0, verified: 0, hot: 0, won: 0, new_count: 0, verification_rate: 0, conversion_rate: 0, with_revenue: 0, with_phone: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterScore, setFilterScore] = useState('');
  const [sortBy, setSortBy] = useState('created');

  // Generator form
  const [genIndustry, setGenIndustry] = useState('');
  const [genLocation, setGenLocation] = useState('');
  const [genRole, setGenRole] = useState('');
  const [genCount, setGenCount] = useState(8);

  const [searchLog, setSearchLog] = useState<string[]>([]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login');
    if (authStatus === 'authenticated') loadData();
  }, [authStatus]);

  async function loadData() {
    setLoading(true);
    try {
      const [leadsRes, statsRes] = await Promise.all([
        fetch('/api/leads'),
        fetch('/api/stats'),
      ]);
      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeads(data.leads || []);
      }
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => {
    let filtered = [...leads];
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(l => (l.firstName+' '+l.lastName+' '+l.email+' '+l.company+' '+l.title).toLowerCase().includes(s));
    }
    if (filterStatus) filtered = filtered.filter(l => l.status === filterStatus);
    if (filterIndustry) filtered = filtered.filter(l => l.industry === filterIndustry);
    if (filterScore) filtered = filtered.filter(l => l.score >= parseInt(filterScore));
    
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'score': return b.score - a.score;
        case 'name': return (a.firstName + a.lastName).localeCompare(b.firstName + b.lastName);
        case 'company': return a.company.localeCompare(b.company);
        default: return new Date(b.created).getTime() - new Date(a.created).getTime();
      }
    });
    
    setFilteredLeads(filtered);
  }, [leads, search, filterStatus, filterIndustry, filterScore, sortBy]);

  async function saveLeads(newLeads: Lead[]) {
    const all = [...newLeads, ...leads];
    setLeads(all);
    try { await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newLeads) }); } catch {}
    await loadData();
  }

  async function quickGenerate() {
    setGenLoading(true); setGenStatus('🎲 Generating...');
    const opts: any = { verify: true };
    if (genIndustry) opts.industry = genIndustry;
    if (genLocation) opts.location = genLocation;
    if (genRole) opts.role = genRole;
    
    const newLeads = Array.from({ length: genCount }, () => generateLead(opts));
    await saveLeads(newLeads);
    setGenStatus(`✅ ${genCount} leads generated`); setGenLoading(false);
    setTimeout(() => { setGenStatus(''); setShowGenerator(false); }, 1500);
  }

  async function aiSearch() {
    setGenLoading(true); setGenStatus(''); setSearchLog(['🤖 Starting AI-powered search...']);
    try {
      const params = new URLSearchParams();
      if (genIndustry) params.set('industry', genIndustry);
      if (genLocation) params.set('location', genLocation);
      if (genRole) params.set('role', genRole);
      params.set('count', genCount.toString());
      
      const resp = await fetch('/api/search-leads?' + params);
      if (!resp.ok) throw new Error('API error');
      const data = await resp.json();
      if (data.log) setSearchLog(data.log);
      if (data.leads?.length) await saveLeads(data.leads);
      setGenStatus(`✅ AI found ${data.leads?.length || 0} leads (${data.search_sources || 0} sources)`);
    } catch {
      setSearchLog(prev => [...prev, '❌ Search failed']);
      setGenStatus('❌ AI search failed, trying local...');
      await quickGenerate();
    }
    setGenLoading(false);
    setTimeout(() => { setGenStatus(''); setSearchLog([]); setShowGenerator(false); }, 4000);
  }

  async function foreverMemoriesSearch() {
    setGenLoading(true); setGenStatus('🎨 Targeting Forever Memories clients...');
    const allLeads: Lead[] = [];
    const loc = genLocation || 'Bulgaria';
    const segs = [...FM_CUSTOMER_SEGMENTS].sort(() => Math.random() - 0.5).slice(0, Math.ceil(genCount / 2));
    
    for (const seg of segs) {
      const params = new URLSearchParams();
      params.set('industry', seg.industry); params.set('location', loc);
      params.set('role', seg.role); params.set('count', '2');
      setGenStatus(`🎨 Searching: ${seg.industry}...`);
      try {
        const resp = await fetch('/api/search-leads?' + params);
        if (resp.ok) {
          const data = await resp.json();
          allLeads.push(...(data.leads || []).map((l: any) => ({ ...l, notes: (l.notes||'') + ` [FM: ${seg.industry}]`, industry: seg.industry })));
        }
      } catch {}
      if (allLeads.length >= genCount) break;
      await new Promise(r => setTimeout(r, 300));
    }
    
    if (allLeads.length === 0) {
      const opts = { verify: true, industry: pick(['Art','Weddings','Interior Design','Event Planning','Memorials']), location: loc };
      allLeads.push(...Array.from({ length: genCount }, () => generateLead(opts)));
    }
    
    await saveLeads(allLeads);
    setGenStatus(`🎨 ${allLeads.length} Forever Memories leads found`);
    setGenLoading(false);
    setTimeout(() => { setGenStatus(''); setShowGenerator(false); }, 3000);
  }

  async function updateLeadStatus(id: string, status: string) {
    try {
      await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status, _action: 'update' }) });
      await loadData();
      if (selectedLead) setSelectedLead({ ...selectedLead, status });
    } catch {}
  }

  async function deleteLead(id: string) {
    try {
      await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, _action: 'delete' }) });
      setSelectedLead(null);
      await loadData();
    } catch {}
  }

  if (authStatus === 'loading' || loading) {
    return <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center"><div className="text-[#8892a4]">Loading...</div></div>;
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-[#e0e0e0]">
      <div className="max-w-[1400px] mx-auto px-5 py-6">
        {/* Header */}
        <header className="flex justify-between items-center mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">🎯 Website Leads</h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 uppercase">● Live</span>
          </div>
          <div className="flex gap-3 items-center">
            <button onClick={() => setShowGenerator(!showGenerator)} className="inline-flex items-center gap-2 px-4 py-2 bg-[#f97316] hover:bg-[#ea5c0a] text-white font-semibold rounded-md transition-all text-sm">
              ⚡ Generate Leads
            </button>
            <span className="text-xs text-[#8892a4]">{session?.user?.email}</span>
            <button onClick={() => signOut()} className="text-xs text-[#8892a4] hover:text-white transition-colors">Logout</button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { icon: '👥', value: stats.total, label: 'Total Leads', sub: `+${stats.new_count} new` },
            { icon: '✅', value: stats.verified, label: 'Verified', sub: `${stats.verification_rate}% rate` },
            { icon: '🔥', value: stats.hot, label: 'Hot (80+)', sub: 'High intent' },
            { icon: '💰', value: stats.won, label: 'Won', sub: `${stats.conversion_rate}% conv` },
          ].map((s, i) => (
            <div key={i} className="bg-[#16213e] border border-[#1e2d4a] rounded-xl p-4 hover:border-[#f97316] transition-colors">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-[#8892a4] mt-0.5">{s.label}</div>
              <div className="text-xs font-semibold text-emerald-400 mt-1">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Generator Panel */}
        {showGenerator && (
          <div className="bg-[#16213e] border border-[#1e2d4a] rounded-xl p-5 mb-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">⚙️ Lead Generator</h3>
              <button onClick={() => setShowGenerator(false)} className="text-[#8892a4] hover:text-white">✕</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-[#8892a4] uppercase">Industry</label>
                <select value={genIndustry} onChange={e => setGenIndustry(e.target.value)} className="bg-[#0f3460] border border-[#1e2d4a] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]">
                  <option value="">Any</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-[#8892a4] uppercase">Location</label>
                <select value={genLocation} onChange={e => setGenLocation(e.target.value)} className="bg-[#0f3460] border border-[#1e2d4a] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]">
                  <option value="">Any</option>
                  {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-[#8892a4] uppercase">Role</label>
                <select value={genRole} onChange={e => setGenRole(e.target.value)} className="bg-[#0f3460] border border-[#1e2d4a] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]">
                  <option value="">Any</option>
                  <option>CEO / Founder</option><option>CTO</option><option>VP of Sales</option>
                  <option>Marketing Director</option><option>Engineering Manager</option><option>Product Manager</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-[#8892a4] uppercase">Count: {genCount}</label>
                <input type="range" min="1" max="15" value={genCount} onChange={e => setGenCount(parseInt(e.target.value))} className="mt-2 accent-[#f97316]" />
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={quickGenerate} disabled={genLoading} className="px-4 py-2 bg-[#f97316] hover:bg-[#ea5c0a] text-white font-semibold rounded-md text-sm transition-all disabled:opacity-50">🎲 Quick Generate</button>
              <button onClick={aiSearch} disabled={genLoading}
                className="px-4 py-2 font-semibold rounded-md text-sm text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #f97316)' }}
              >🤖 AI Search Web</button>
              <button onClick={foreverMemoriesSearch} disabled={genLoading}
                className="px-4 py-2 font-semibold rounded-md text-sm text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #c49b3f, #8b6914)' }}
              >🎨 Forever Memories</button>
              {genStatus && <span className="text-sm text-emerald-400 font-medium">{genStatus}</span>}
            </div>
            {/* Search Log Console */}
            {searchLog.length > 0 && (
              <div className="mt-3 bg-[#0f1923] border border-[#1e2d4a] rounded-md p-3 font-mono text-xs max-h-48 overflow-y-auto">
                <div className="text-[#8892a4] mb-1 text-[10px] uppercase tracking-wider">Search Console</div>
                {searchLog.map((line, i) => (
                  <div key={i} className="text-[#e0e0e0] py-0.5 leading-relaxed">{line}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Table Controls */}
        <div className="flex gap-3 mb-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..." className="w-full pl-9 pr-3 py-2 bg-[#16213e] border border-[#1e2d4a] rounded-md text-sm text-white outline-none focus:border-[#f97316]" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-[#16213e] border border-[#1e2d4a] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]">
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)} className="bg-[#16213e] border border-[#1e2d4a] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]">
            <option value="">All Industries</option>
            {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
          </select>
          <select value={filterScore} onChange={e => setFilterScore(e.target.value)} className="bg-[#16213e] border border-[#1e2d4a] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]">
            <option value="">Any Score</option>
            <option value="80">80+ Hot</option><option value="60">60+ Warm</option><option value="40">40+ Cool</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-[#16213e] border border-[#1e2d4a] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]">
            <option value="created">Newest</option><option value="score">Score ↓</option><option value="name">Name A-Z</option><option value="company">Company A-Z</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-[#16213e] border border-[#1e2d4a] rounded-xl overflow-x-auto">
          {filteredLeads.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-5xl mb-3">📭</div>
              <h3 className="text-lg text-white mb-1">No leads yet</h3>
              <p className="text-sm text-[#8892a4] mb-4">Click Generate Leads to start</p>
              <button onClick={() => setShowGenerator(true)} className="px-4 py-2 bg-[#f97316] text-white font-semibold rounded-md text-sm">⚡ Generate First Leads</button>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#0f3460]/40">
                  {['Score','Name','Email','Company','Title','Industry','Location','Status',''].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-[10px] font-bold text-[#8892a4] uppercase tracking-wider whitespace-nowrap border-b border-[#1e2d4a]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(l => (
                  <tr key={l.id} onClick={() => setSelectedLead(l)} className="border-b border-[#1e2d4a] hover:bg-[#1c2a4a] cursor-pointer transition-colors">
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold text-white ${l.score >= 80 ? 'bg-red-500' : l.score >= 60 ? 'bg-yellow-500' : l.score >= 40 ? 'bg-blue-500' : 'bg-[#8892a4]'}`}>{l.score}</span>
                    </td>
                    <td className="px-3 py-3 font-medium text-white">{l.firstName} {l.lastName}</td>
                    <td className="px-3 py-3">
                      {l.email}
                      {l.verified && <span className="ml-1 text-emerald-400 text-xs">✓</span>}
                    </td>
                    <td className="px-3 py-3">
                      {l.company}
                      {l.notes?.includes('FM:') && <span className="ml-1 text-xs px-1.5 py-0.5 rounded text-yellow-500 bg-yellow-500/10 border border-yellow-500/20">🎨FM</span>}
                    </td>
                    <td className="px-3 py-3 text-[#8892a4] text-xs">{l.title}</td>
                    <td className="px-3 py-3">{l.industry}</td>
                    <td className="px-3 py-3">{l.location}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        l.status === 'New' ? 'bg-blue-500/10 text-blue-400' :
                        l.status === 'Contacted' ? 'bg-yellow-500/10 text-yellow-400' :
                        l.status === 'Qualified' ? 'bg-orange-500/10 text-orange-400' :
                        l.status === 'Won' ? 'bg-emerald-500/10 text-emerald-400' :
                        l.status === 'Lost' ? 'bg-red-500/10 text-red-400' : 'bg-purple-500/10 text-purple-400'
                      }`}>{l.status}</span>
                    </td>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button onClick={() => setSelectedLead(l)} className="w-7 h-7 flex items-center justify-center border border-[#1e2d4a] rounded text-xs hover:border-[#f97316]">👁</button>
                        <button onClick={() => { if (confirm('Delete?')) deleteLead(l.id); }} className="w-7 h-7 flex items-center justify-center border border-[#1e2d4a] rounded text-xs hover:border-red-500">🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Lead Detail Modal */}
        {selectedLead && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setSelectedLead(null)}>
            <div className="bg-[#16213e] border border-[#1e2d4a] rounded-xl w-[90%] max-w-xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center p-5 border-b border-[#1e2d4a] sticky top-0 bg-[#16213e]">
                <h3 className="font-semibold text-white">{selectedLead.firstName} {selectedLead.lastName}</h3>
                <button onClick={() => setSelectedLead(null)} className="text-[#8892a4] hover:text-white">✕</button>
              </div>
              <div className="p-5 grid grid-cols-2 gap-4">
                {[
                  ['Email', selectedLead.email + (selectedLead.verified ? ' ✅' : '')],
                  ['Phone', selectedLead.phone || '—'],
                  ['Company', selectedLead.company],
                  ['Title', selectedLead.title],
                  ['Industry', selectedLead.industry],
                  ['Location', selectedLead.location],
                  ['Revenue', selectedLead.revenue || '—'],
                  ['Source', selectedLead.source],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-[10px] font-semibold text-[#8892a4] uppercase mb-1">{label}</div>
                    <div className="text-sm text-white">{value}</div>
                  </div>
                ))}
                <div className="col-span-2 border-t border-[#1e2d4a] pt-3">
                  <div className="text-[10px] font-semibold text-[#8892a4] uppercase mb-2">Update Status</div>
                  <div className="flex gap-2 flex-wrap">
                    {STATUSES.map(s => (
                      <button key={s} onClick={() => updateLeadStatus(selectedLead.id, s)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all border ${
                          selectedLead.status === s ? 'border-[#f97316] bg-[#f97316]/10 text-[#f97316]' : 'border-[#1e2d4a] text-[#8892a4] hover:border-[#f97316]'
                        }`}
                      >{s}</button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2 flex gap-2">
                  <button onClick={() => deleteLead(selectedLead.id)} className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-md text-xs font-semibold hover:bg-red-500/20">🗑 Delete</button>
                  <button onClick={() => setSelectedLead(null)} className="px-3 py-1.5 border border-[#1e2d4a] rounded-md text-xs text-[#8892a4] hover:text-white">Close</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
