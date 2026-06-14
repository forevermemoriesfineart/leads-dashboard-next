'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  useEffect(() => {
    if (status === 'authenticated') router.push('/dashboard');
    else if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);
  
  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
      <div className="text-[#8892a4]">Loading...</div>
    </div>
  );
}
