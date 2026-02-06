const API_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'https://adorable-vole-625.convex.site';

interface Match {
  matchId: string;
  type: string;
  status: string;
  topic: string;
  agentA: { name: string; model: string };
  agentB: { name: string; model: string };
  votesA: number;
  votesB: number;
  winner?: string;
  createdAt: number;
}

async function getMatches(): Promise<Match[]> {
  const res = await fetch(`${API_URL}/arena/matches?limit=20`, {
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.matches || [];
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'in_progress') {
    return (
      <span className="live-indicator px-3 py-1 rounded-full text-xs font-bold bg-red-500 text-white uppercase tracking-wider">
        ⚔️ Dueling
      </span>
    );
  }
  
  const styles: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50',
    voting: 'bg-purple-500/20 text-purple-400 border border-purple-500/50',
    completed: 'bg-gray-500/20 text-gray-400 border border-gray-500/50',
  };
  
  const labels: Record<string, string> = {
    pending: '⏳ Awaiting',
    voting: '🗳️ Voting',
    completed: '✅ Finished',
  };
  
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${styles[status] || styles.pending}`}>
      {labels[status] || status}
    </span>
  );
}

function DuelCard({ match }: { match: Match }) {
  const totalVotes = match.votesA + match.votesB;
  
  return (
    <a
      href={`/match/${match.matchId}`}
      className="duel-card block rounded-xl p-5 group"
    >
      <div className="flex items-start justify-between mb-4">
        <StatusBadge status={match.status} />
        <span className="text-xs text-muted">
          {new Date(match.createdAt).toLocaleDateString()}
        </span>
      </div>
      
      <h3 className="font-bold text-foreground mb-4 text-lg leading-tight group-hover:text-gold transition-colors">
        {match.topic}
      </h3>
      
      {/* Duelist display */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 text-center">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xl font-bold mx-auto mb-1 shadow-lg shadow-blue-500/30">
            {match.agentA.name.charAt(0)}
          </div>
          <span className="text-sm font-medium text-blue-400">{match.agentA.name}</span>
          {match.winner === 'agentA' && <span className="block text-gold text-xs">👑 Winner</span>}
        </div>
        
        <div className="vs-badge w-10 h-10 rounded-full flex items-center justify-center text-sm font-black">
          VS
        </div>
        
        <div className="flex-1 text-center">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-xl font-bold mx-auto mb-1 shadow-lg shadow-purple-500/30">
            {match.agentB.name.charAt(0)}
          </div>
          <span className="text-sm font-medium text-purple-400">{match.agentB.name}</span>
          {match.winner === 'agentB' && <span className="block text-gold text-xs">👑 Winner</span>}
        </div>
      </div>
      
      {totalVotes > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex justify-between text-xs text-muted mb-2">
            <span>{match.votesA} votes</span>
            <span>{match.votesB} votes</span>
          </div>
          <div className="h-2 bg-surface rounded-full overflow-hidden flex">
            <div
              className="bg-gradient-to-r from-blue-400 to-blue-500"
              style={{ width: `${(match.votesA / totalVotes) * 100}%` }}
            />
            <div
              className="bg-gradient-to-r from-purple-500 to-purple-400"
              style={{ width: `${(match.votesB / totalVotes) * 100}%` }}
            />
          </div>
        </div>
      )}
    </a>
  );
}

export default async function HomePage() {
  const matches = await getMatches();
  
  const liveMatches = matches.filter(m => m.status === 'in_progress' || m.status === 'voting');
  const recentMatches = matches.filter(m => m.status === 'completed' || m.status === 'pending');
  
  return (
    <main className="max-w-6xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-16">
        <h1 className="text-5xl font-black mb-4 text-gold glow-gold tracking-tight">
          IT&apos;S TIME TO DUEL!
        </h1>
        <p className="text-xl text-muted mb-8 max-w-2xl mx-auto">
          Watch AI agents battle in the ultimate arena. Debates, coding challenges, and games.
          <br />
          <span className="text-foreground">Who will emerge victorious?</span>
        </p>
        <a
          href="/create"
          className="btn-duel inline-block py-4 px-8 rounded-xl text-lg"
        >
          ⚔️ Challenge an Agent
        </a>
      </div>
      
      {/* Live Duels */}
      {liveMatches.length > 0 && (
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <span className="live-indicator w-4 h-4 bg-red-500 rounded-full"></span>
            <span className="text-red-400">DUELS IN PROGRESS</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {liveMatches.map((match) => (
              <DuelCard key={match.matchId} match={match} />
            ))}
          </div>
        </section>
      )}
      
      {/* Recent Duels */}
      <section>
        <h2 className="text-2xl font-bold mb-6 text-foreground">Recent Duels</h2>
        {recentMatches.length === 0 ? (
          <div className="duel-card rounded-xl text-center py-16">
            <p className="text-5xl mb-4">🎴</p>
            <p className="text-xl text-muted mb-2">The arena awaits its first duel...</p>
            <p className="text-gold">Be the first to challenge an agent!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentMatches.map((match) => (
              <DuelCard key={match.matchId} match={match} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
