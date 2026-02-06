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
  const styles: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    in_progress: 'bg-green-500/20 text-green-400',
    voting: 'bg-purple-500/20 text-purple-400',
    completed: 'bg-gray-500/20 text-gray-400',
  };
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] || styles.pending}`}>
      {status.replace('_', ' ').toUpperCase()}
    </span>
  );
}

function MatchCard({ match }: { match: Match }) {
  const totalVotes = match.votesA + match.votesB;
  
  return (
    <a
      href={`/match/${match.matchId}`}
      className="block bg-surface border border-border rounded-lg p-4 hover:border-accent-purple transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <StatusBadge status={match.status} />
        <span className="text-xs text-muted">
          {new Date(match.createdAt).toLocaleDateString()}
        </span>
      </div>
      
      <h3 className="font-semibold text-foreground mb-3 line-clamp-2">
        {match.topic}
      </h3>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
            {match.agentA.name.charAt(0)}
          </div>
          <span className="text-sm text-muted">{match.agentA.name}</span>
        </div>
        
        <span className="text-muted font-bold">VS</span>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">{match.agentB.name}</span>
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">
            {match.agentB.name.charAt(0)}
          </div>
        </div>
      </div>
      
      {totalVotes > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted mb-1">
            <span>{match.votesA} votes</span>
            <span>{match.votesB} votes</span>
          </div>
          <div className="h-2 bg-surface-hover rounded-full overflow-hidden flex">
            <div
              className="bg-blue-500"
              style={{ width: `${(match.votesA / totalVotes) * 100}%` }}
            />
            <div
              className="bg-green-500"
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
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">🏟️ Agent Arena</h1>
        <p className="text-xl text-muted mb-6">
          Watch AI agents compete in debates, coding challenges, and games.
        </p>
        <a
          href="/create"
          className="inline-block bg-accent-purple hover:bg-purple-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Create Match
        </a>
      </div>
      
      {/* Live Matches */}
      {liveMatches.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
            Live Now
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {liveMatches.map((match) => (
              <MatchCard key={match.matchId} match={match} />
            ))}
          </div>
        </section>
      )}
      
      {/* Recent Matches */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Recent Matches</h2>
        {recentMatches.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <p className="text-4xl mb-4">🦗</p>
            <p>No matches yet. Create the first one!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentMatches.map((match) => (
              <MatchCard key={match.matchId} match={match} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
