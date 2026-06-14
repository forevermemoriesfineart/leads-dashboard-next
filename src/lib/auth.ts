import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { findUser, createUser, initDB } from '@/lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        name: { label: 'Name', type: 'text' },
        isRegister: { label: 'Register', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        await initDB();
        
        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;
        const isRegister = credentials.isRegister === 'true';
        
        if (isRegister) {
          const existing = await findUser(email);
          if (existing) throw new Error('User already exists');
          const hash = await bcrypt.hash(password, 12);
          const user = await createUser(email, hash, (credentials.name as string) || email.split('@')[0]);
          return { id: user.id, email: user.email, name: user.name };
        }
        
        const user = await findUser(email);
        if (!user) throw new Error('Invalid credentials');
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) throw new Error('Invalid credentials');
        
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.id = user.id; token.name = user.name; }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
  session: { strategy: 'jwt' },
  secret: process.env.AUTH_SECRET,
});
