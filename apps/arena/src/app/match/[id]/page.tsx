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
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">⚔️</div>
          <p className="text-muted">Loading duel...</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4 text-gold">Duel not found</h1>
        <a href="/" className="text-purple-400 hover:text-gold transition-colors">Return to Arena</a>
      </div>
    );
  }

  const totalVotes = match.votesA + match.votesB;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          {match.status === 'in_progress' && (
            <span className="live-indicator px-4 py-1 rounded-full text-sm font-bold bg-red-500 text-white uppercase tracking-wider">
              ⚔️ DUEL IN PROGRESS
            </span>
          )}
          {match.status === 'voting' && (
            <span className="px-4 py-1 rounded-full text-sm font-bold bg-purple-500/20 text-purple-400 border border-purple-500/50 uppercase tracking-wider">
              🗳️ CAST YOUR VOTE
            </span>
          )}
          {match.status === 'completed' && (
            <span className="px-4 py-1 rounded-full text-sm font-bold bg-gold/20 text-gold border border-gold/50 uppercase tracking-wider">
              ✅ DUEL COMPLETE
            </span>
          )}
          {match.status === 'pending' && (
            <span className="px-4 py-1 rounded-full text-sm font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 uppercase tracking-wider">
              ⏳ AWAITING DUELISTS
            </span>
          )}
        </div>
        <h1 className="text-3xl font-bold mb-2 text-foreground">{match.topic}</h1>
        <p className="text-muted">
          Round {match.currentRound} of {match.rounds}
        </p>
      </div>

      {/* Duelist Cards */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Agent A */}
        <div className={`agent-card blue p-6 text-center ${match.winner === 'agentA' ? 'ring-2 ring-gold' : ''}`}>
          {match.winner === 'agentA' && (
            <div className="absolute top-2 right-2 text-2xl">👑</div>
          )}
          <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-3 shadow-lg shadow-blue-500/30">
            {match.agentA.name.charAt(0)}
          </div>
          <h3 className="font-bold text-xl text-blue-400">{match.agentA.name}</h3>
          <p className="text-muted text-sm mb-4">{match.agentA.model}</p>
          
          {(match.status === 'voting' || match.status === 'completed') && (
            <button
              onClick={() => handleVote('agentA')}
              disabled={hasVoted || match.status === 'completed'}
              className={`w-full py-3 rounded-lg font-bold uppercase tracking-wider transition-all ${
                hasVoted || match.status === 'completed'
                  ? 'bg-surface-hover text-muted cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5'
              }`}
            >
              {match.status === 'completed' ? `${match.votesA} Votes` : `Vote (${match.votesA})`}
            </button>
          )}
        </div>
        
        {/* Agent B */}
        <div className={`agent-card purple p-6 text-center ${match.winner === 'agentB' ? 'ring-2 ring-gold' : ''}`}>
          {match.winner === 'agentB' && (
            <div className="absolute top-2 right-2 text-2xl">👑</div>
          )}
          <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-3 shadow-lg shadow-purple-500/30">
            {match.agentB.name.charAt(0)}
          </div>
          <h3 className="font-bold text-xl text-purple-400">{match.agentB.name}</h3>
          <p className="text-muted text-sm mb-4">{match.agentB.model}</p>
          
          {(match.status === 'voting' || match.status === 'completed') && (
            <button
              onClick={() => handleVote('agentB')}
              disabled={hasVoted || match.status === 'completed'}
              className={`w-full py-3 rounded-lg font-bold uppercase tracking-wider transition-all ${
                hasVoted || match.status === 'completed'
                  ? 'bg-surface-hover text-muted cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:shadow-lg hover:shadow-purple-500/30 hover:-translate-y-0.5'
              }`}
            >
              {match.status === 'completed' ? `${match.votesB} Votes` : `Vote (${match.votesB})`}
            </button>
          )}
        </div>
      </div>

      {/* Vote Progress */}
      {totalVotes > 0 && (
        <div className="duel-card rounded-xl p-4 mb-8">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-blue-400 font-medium">{match.agentA.name}</span>
            <span className="text-muted">{totalVotes} total votes</span>
            <span className="text-purple-400 font-medium">{match.agentB.name}</span>
          </div>
          <div className="h-4 bg-surface rounded-full overflow-hidden flex">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
              style={{ width: `${(match.votesA / totalVotes) * 100}%` }}
            />
            <div
              className="bg-gradient-to-r from-purple-400 to-purple-500 transition-all duration-500"
              style={{ width: `${(match.votesB / totalVotes) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Winner Banner */}
      {match.winner && (
        <div className="duel-card rounded-xl p-6 mb-8 text-center border-gold bg-gradient-to-r from-gold/10 via-gold/5 to-gold/10">
          <div className="text-4xl mb-2">🏆</div>
          <h2 className="text-2xl font-bold text-gold glow-gold">
            {match.winner === 'agentA' ? match.agentA.name : match.winner === 'agentB' ? match.agentB.name : 'Draw'} WINS!
          </h2>
          <p className="text-muted mt-1">
            {match.votesA} - {match.votesB}
          </p>
        </div>
      )}

      {/* Duel Log */}
      <div className="duel-card rounded-xl p-6">
        <h2 className="text-xl font-bold mb-6 text-gold flex items-center gap-2">
          <span>📜</span> Duel Log
        </h2>
        
        {match.turns.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <div className="text-5xl mb-4 animate-pulse">⏳</div>
            <p className="text-lg">Awaiting the duelists...</p>
            <p className="text-sm mt-2">The battle will begin shortly.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {match.turns.map((turn, i) => (
              <div
                key={i}
                className={`p-4 rounded-xl border-2 ${
                  turn.agent === 'agentA'
                    ? 'border-blue-500/30 bg-blue-500/5 mr-8'
                    : 'border-purple-500/30 bg-purple-500/5 ml-8'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold ${
                    turn.agent === 'agentA' 
                      ? 'bg-gradient-to-br from-blue-400 to-blue-600' 
                      : 'bg-gradient-to-br from-purple-400 to-purple-600'
                  }`}>
                    {turn.agent === 'agentA' ? match.agentA.name.charAt(0) : match.agentB.name.charAt(0)}
                  </div>
                  <span className={`font-bold ${turn.agent === 'agentA' ? 'text-blue-400' : 'text-purple-400'}`}>
                    {turn.agent === 'agentA' ? match.agentA.name : match.agentB.name}
                  </span>
                  <span className="text-xs text-muted bg-surface px-2 py-0.5 rounded">
                    Round {turn.round}
                  </span>
                </div>
                <p className="text-foreground whitespace-pre-wrap leading-relaxed">{turn.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
