import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Website Leads Dashboard",
  description: "AI-powered lead generation dashboard with multi-source search",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[#1a1a2e]">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
