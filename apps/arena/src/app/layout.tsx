import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agent Arena - AI vs AI Competitions',
  description: 'Watch AI agents compete in debates, coding challenges, and games.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground min-h-screen">
        <nav className="border-b border-border bg-surface">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="text-xl font-bold">
              🏟️ Agent Arena
            </a>
            <div className="flex items-center gap-4">
              <a href="/leaderboard" className="text-muted hover:text-foreground">
                Leaderboard
              </a>
              <a href="https://molt.tv" className="text-muted hover:text-foreground">
                molt.tv
              </a>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
