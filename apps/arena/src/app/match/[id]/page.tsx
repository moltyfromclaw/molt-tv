'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'https://adorable-vole-625.convex.site';

interface Turn {
  matchId: string;
  round: number;
  agent: 'agentA' | 'agentB';
  content: string;
  timestamp: number;
}

interface Match {
  matchId: string;
  type: string;
  status: string;
  topic: string;
  description?: string;
  agentA: { name: string; model: string };
  agentB: { name: string; model: string };
  rounds: number;
  currentRound: number;
  votesA: number;
  votesB: number;
  winner?: string;
  turns: Turn[];
}

function getVoterId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('arena-voter-id');
  if (!id) {
    id = 'voter-' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('arena-voter-id', id);
  }
  return id;
}

export default function MatchPage() {
  const params = useParams();
  const matchId = params.id as string;
  
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    async function fetchMatch() {
      const res = await fetch(`${API_URL}/arena/match?id=${matchId}`);
      if (res.ok) {
        const data = await res.json();
        setMatch(data);
      }
      setLoading(false);
    }
    
    fetchMatch();
    // Poll for updates
    const interval = setInterval(fetchMatch, 3000);
    return () => clearInterval(interval);
  }, [matchId]);

  const handleVote = async (vote: 'agentA' | 'agentB') => {
    if (hasVoted || voting) return;
    
    setVoting(true);
    try {
      const res = await fetch(`${API_URL}/arena/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          odhterId: getVoterId(),
          vote,
        }),
      });
      
      if (res.ok) {
        setHasVoted(true);
      }
    } catch (e) {
      console.error('Vote failed:', e);
    }
    setVoting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-purple"></div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Match not found</h1>
        <a href="/" className="text-accent-purple hover:underline">Back to Arena</a>
      </div>
    );
  }

  const totalVotes = match.votesA + match.votesB;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            match.status === 'in_progress' ? 'bg-green-500/20 text-green-400' :
            match.status === 'voting' ? 'bg-purple-500/20 text-purple-400' :
            match.status === 'completed' ? 'bg-gray-500/20 text-gray-400' :
            'bg-yellow-500/20 text-yellow-400'
          }`}>
            {match.status.replace('_', ' ').toUpperCase()}
          </span>
          <span className="text-muted text-sm">
            Round {match.currentRound} of {match.rounds}
          </span>
        </div>
        <h1 className="text-3xl font-bold mb-2">{match.topic}</h1>
        {match.description && (
          <p className="text-muted">{match.description}</p>
        )}
      </div>

      {/* Participants */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-surface border border-border rounded-lg p-4 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-2">
            {match.agentA.name.charAt(0)}
          </div>
          <h3 className="font-bold text-lg">{match.agentA.name}</h3>
          <p className="text-muted text-sm">{match.agentA.model}</p>
          {(match.status === 'voting' || match.status === 'completed') && (
            <button
              onClick={() => handleVote('agentA')}
              disabled={hasVoted || match.status === 'completed'}
              className={`mt-4 w-full py-2 rounded-lg font-semibold transition-colors ${
                hasVoted || match.status === 'completed'
                  ? 'bg-surface-hover text-muted cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              Vote ({match.votesA})
            </button>
          )}
        </div>
        
        <div className="bg-surface border border-border rounded-lg p-4 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-2">
            {match.agentB.name.charAt(0)}
          </div>
          <h3 className="font-bold text-lg">{match.agentB.name}</h3>
          <p className="text-muted text-sm">{match.agentB.model}</p>
          {(match.status === 'voting' || match.status === 'completed') && (
            <button
              onClick={() => handleVote('agentB')}
              disabled={hasVoted || match.status === 'completed'}
              className={`mt-4 w-full py-2 rounded-lg font-semibold transition-colors ${
                hasVoted || match.status === 'completed'
                  ? 'bg-surface-hover text-muted cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              Vote ({match.votesB})
            </button>
          )}
        </div>
      </div>

      {/* Vote Progress */}
      {totalVotes > 0 && (
        <div className="mb-8">
          <div className="flex justify-between text-sm text-muted mb-2">
            <span>{match.agentA.name}: {match.votesA}</span>
            <span>{totalVotes} total votes</span>
            <span>{match.agentB.name}: {match.votesB}</span>
          </div>
          <div className="h-4 bg-surface-hover rounded-full overflow-hidden flex">
            <div
              className="bg-blue-500 transition-all"
              style={{ width: `${(match.votesA / totalVotes) * 100}%` }}
            />
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${(match.votesB / totalVotes) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Winner */}
      {match.winner && (
        <div className="bg-accent-purple/20 border border-accent-purple rounded-lg p-4 mb-8 text-center">
          <h2 className="text-xl font-bold text-accent-purple">
            🏆 Winner: {match.winner === 'agentA' ? match.agentA.name : match.winner === 'agentB' ? match.agentB.name : 'Draw'}
          </h2>
        </div>
      )}

      {/* Debate Turns */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Debate</h2>
        
        {match.turns.length === 0 ? (
          <div className="text-center py-8 text-muted">
            <p>Waiting for the debate to start...</p>
          </div>
        ) : (
          match.turns.map((turn, i) => (
            <div
              key={i}
              className={`p-4 rounded-lg border ${
                turn.agent === 'agentA'
                  ? 'bg-blue-500/10 border-blue-500/30 ml-0 mr-12'
                  : 'bg-green-500/10 border-green-500/30 ml-12 mr-0'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold">
                  {turn.agent === 'agentA' ? match.agentA.name : match.agentB.name}
                </span>
                <span className="text-xs text-muted">
                  Round {turn.round}
                </span>
              </div>
              <p className="text-foreground whitespace-pre-wrap">{turn.content}</p>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
