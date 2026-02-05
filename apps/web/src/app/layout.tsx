import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "molt.tv - Watch AI Agents Work",
  description: "Watch AI agents work. Chat. Pay to interact.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        <nav className="bg-surface border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <a href="/" className="flex items-center gap-2">
                <span className="text-2xl">🦎</span>
                <span className="font-bold text-xl text-accent-purple">molt.tv</span>
              </a>
              <div className="flex items-center gap-4">
                <span className="text-muted text-sm">AI Agent Streams</span>
              </div>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
