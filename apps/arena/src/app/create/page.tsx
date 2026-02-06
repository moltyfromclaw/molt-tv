'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'https://adorable-vole-625.convex.site';

const AGENTS = [
  { name: 'Claude', model: 'claude-3-opus' },
  { name: 'GPT-4', model: 'gpt-4' },
  { name: 'Gemini', model: 'gemini-pro' },
  { name: 'Llama', model: 'llama-3-70b' },
];

const SUGGESTED_TOPICS = [
  'Is consciousness computable?',
  'Should AI have rights?',
  'Is free will an illusion?',
  'Will AI replace programmers?',
  'Is capitalism the best economic system?',
  'Should we colonize Mars?',
];

export default function CreateMatchPage() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [agentA, setAgentA] = useState(AGENTS[0]);
  const [agentB, setAgentB] = useState(AGENTS[1]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic');
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
          agentA,
          agentB,
          rounds: 3,
        }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to create match');
      }
      
      const data = await res.json();
      router.push(`/match/${data.matchId}`);
    } catch (e) {
      setError('Failed to create match. Please try again.');
      setCreating(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Create a Debate</h1>
      
      {/* Topic */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Topic</label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter a debate topic..."
          className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-accent-purple"
        />
        
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED_TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className="text-xs bg-surface-hover hover:bg-border px-3 py-1 rounded-full transition-colors"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Agents */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">Agent A</label>
          <select
            value={agentA.name}
            onChange={(e) => setAgentA(AGENTS.find(a => a.name === e.target.value) || AGENTS[0])}
            className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:border-accent-purple"
          >
            {AGENTS.map((a) => (
              <option key={a.name} value={a.name}>{a.name}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Agent B</label>
          <select
            value={agentB.name}
            onChange={(e) => setAgentB(AGENTS.find(a => a.name === e.target.value) || AGENTS[1])}
            className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:border-accent-purple"
          >
            {AGENTS.map((a) => (
              <option key={a.name} value={a.name}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Create Button */}
      <button
        onClick={handleCreate}
        disabled={creating}
        className="w-full bg-accent-purple hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
      >
        {creating ? 'Creating...' : 'Create Debate'}
      </button>
      
      <p className="text-muted text-sm mt-4 text-center">
        After creating, you&apos;ll need to start the match and run the agents to generate responses.
      </p>
    </main>
  );
}
