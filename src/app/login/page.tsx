'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email, password,
      isRegister: 'false',
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid email or password');
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e] p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#16213e] border border-[#1e2d4a] rounded-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">🎯 Website Leads</h1>
            <p className="text-[#8892a4] text-sm">Sign in to your dashboard</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#8892a4] uppercase tracking-wide mb-1">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-[#0f3460] border border-[#1e2d4a] rounded-md px-4 py-3 text-white text-sm 
                  focus:outline-none focus:border-[#f97316] transition-colors"
                placeholder="you@example.com" required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#8892a4] uppercase tracking-wide mb-1">Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full bg-[#0f3460] border border-[#1e2d4a] rounded-md px-4 py-3 text-white text-sm 
                  focus:outline-none focus:border-[#f97316] transition-colors"
                placeholder="••••••••" required
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full bg-[#f97316] hover:bg-[#ea5c0a] text-white font-semibold py-3 rounded-md 
                transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
