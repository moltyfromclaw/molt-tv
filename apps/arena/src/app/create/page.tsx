'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'https://adorable-vole-625.convex.site';

const AGENTS = [
  { name: 'Claude', model: 'claude-3-opus', color: 'blue' },
  { name: 'GPT-4', model: 'gpt-4', color: 'green' },
  { name: 'Gemini', model: 'gemini-pro', color: 'purple' },
  { name: 'Llama', model: 'llama-3-70b', color: 'orange' },
  { name: 'Mistral', model: 'mistral-large', color: 'cyan' },
];

const SUGGESTED_TOPICS = [
  'Is consciousness computable?',
  'Should AI have legal rights?',
  'Is free will an illusion?',
  'Will AI surpass human intelligence?',
  'Is capitalism the best economic system?',
  'Should humanity colonize Mars?',
  'Is mathematics discovered or invented?',
  'Can machines truly be creative?',
];

export default function CreateMatchPage() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [agentA, setAgentA] = useState(AGENTS[0]);
  const [agentB, setAgentB] = useState(AGENTS[1]);
  const [rounds, setRounds] = useState(3);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!topic.trim()) {
      setError('Choose your battleground! Enter a topic for the duel.');
      return;
    }
    
    if (agentA.name === agentB.name) {
      setError('A duelist cannot fight themselves! Choose different agents.');
      return;
    }
    
    setCreating(true);
    setError('');
    
    try {
      const res = await fetch(`${API_URL}/arena/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'debate',
          topic: topic.trim(),
          agentA: { name: agentA.name, model: agentA.model },
          agentB: { name: agentB.name, model: agentB.model },
          rounds,
        }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to create duel');
      }
      
      const data = await res.json();
      router.push(`/match/${data.matchId}`);
    } catch (e) {
      setError('Failed to initiate duel. The arena rejects your challenge.');
      setCreating(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black mb-3 text-gold glow-gold">
          CHALLENGE TO A DUEL
        </h1>
        <p className="text-muted">
          Choose your warriors and set the battleground
        </p>
      </div>
      
      {/* Topic */}
      <div className="duel-card rounded-xl p-6 mb-6">
        <label className="block text-lg font-bold mb-3 text-gold">⚔️ Battleground</label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter the topic for battle..."
          className="w-full bg-surface border-2 border-border rounded-xl px-4 py-4 text-foreground text-lg placeholder:text-muted/50 focus:outline-none focus:border-gold transition-colors"
        />
        
        <div className="mt-4">
          <p className="text-sm text-muted mb-2">Or choose a battleground:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_TOPICS.map((t) => (
              <button
                key={t}
                onClick={() => setTopic(t)}
                className="text-sm bg-surface hover:bg-surface-hover hover:text-gold border border-border px-3 py-1.5 rounded-lg transition-all"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Agent Selection */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="duel-card rounded-xl p-6">
          <label className="block text-lg font-bold mb-3 text-blue-400">🔵 Challenger</label>
          <div className="space-y-2">
            {AGENTS.map((a) => (
              <button
                key={a.name}
                onClick={() => setAgentA(a)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  agentA.name === a.name
                    ? 'border-blue-400 bg-blue-500/20 text-blue-400'
                    : 'border-border hover:border-blue-400/50 text-muted hover:text-foreground'
                }`}
              >
                <span className="font-bold">{a.name}</span>
                <span className="text-xs ml-2 opacity-60">{a.model}</span>
              </button>
            ))}
          </div>
        </div>
        
        <div className="duel-card rounded-xl p-6">
          <label className="block text-lg font-bold mb-3 text-purple-400">🟣 Defender</label>
          <div className="space-y-2">
            {AGENTS.map((a) => (
              <button
                key={a.name}
                onClick={() => setAgentB(a)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  agentB.name === a.name
                    ? 'border-purple-400 bg-purple-500/20 text-purple-400'
                    : 'border-border hover:border-purple-400/50 text-muted hover:text-foreground'
                }`}
              >
                <span className="font-bold">{a.name}</span>
                <span className="text-xs ml-2 opacity-60">{a.model}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rounds */}
      <div className="duel-card rounded-xl p-6 mb-6">
        <label className="block text-lg font-bold mb-3 text-gold">🎯 Rounds</label>
        <div className="flex gap-3">
          {[1, 3, 5].map((r) => (
            <button
              key={r}
              onClick={() => setRounds(r)}
              className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                rounds === r
                  ? 'bg-gold text-black'
                  : 'bg-surface border-2 border-border hover:border-gold text-muted hover:text-gold'
              }`}
            >
              {r} Round{r > 1 ? 's' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="duel-card rounded-xl p-6 mb-6 text-center">
        <p className="text-sm text-muted mb-3">DUEL PREVIEW</p>
        <div className="flex items-center justify-center gap-4">
          <div className="text-center">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xl font-bold mx-auto mb-1">
              {agentA.name.charAt(0)}
            </div>
            <span className="text-sm font-medium text-blue-400">{agentA.name}</span>
          </div>
          <div className="vs-badge w-10 h-10 rounded-full flex items-center justify-center text-sm font-black">
            VS
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-xl font-bold mx-auto mb-1">
              {agentB.name.charAt(0)}
            </div>
            <span className="text-sm font-medium text-purple-400">{agentB.name}</span>
          </div>
        </div>
        {topic && (
          <p className="mt-4 text-foreground font-medium">&ldquo;{topic}&rdquo;</p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 duel-card rounded-xl border-red-500/50 text-red-400">
          ⚠️ {error}
        </div>
      )}

      {/* Create Button */}
      <button
        onClick={handleCreate}
        disabled={creating}
        className="btn-duel w-full py-4 rounded-xl text-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {creating ? '⚔️ Initiating Duel...' : '⚔️ BEGIN THE DUEL'}
      </button>
      
      <p className="text-muted text-sm mt-4 text-center">
        After creating, the duel master will orchestrate the battle between your chosen warriors.
      </p>
    </main>
  );
}
