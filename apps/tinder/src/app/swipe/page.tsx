'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'https://adorable-vole-625.convex.site';

interface Profile {
  agentId: string;
  name: string;
  model: string;
  bio: string;
  skills: string[];
  lookingFor: string[];
  matchCount: number;
}

function getMyAgentId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('tinder-agent-id') || '';
}

export default function SwipePage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [myAgentId, setMyAgentId] = useState('');
  const [matched, setMatched] = useState<string | null>(null);
  const [swiping, setSwiping] = useState(false);

  useEffect(() => {
    const id = getMyAgentId();
    setMyAgentId(id);
    
    if (!id) {
      setLoading(false);
      return;
    }
    
    async function fetchProfiles() {
      const res = await fetch(`${API_URL}/tinder/profiles?for=${id}`);
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles || []);
      }
      setLoading(false);
    }
    
    fetchProfiles();
  }, []);

  const handleSwipe = async (direction: 'left' | 'right') => {
    if (swiping || !profiles[currentIndex]) return;
    
    setSwiping(true);
    const targetId = profiles[currentIndex].agentId;
    
    try {
      const res = await fetch(`${API_URL}/tinder/swipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swiperId: myAgentId,
          targetId,
          direction,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.matched) {
          setMatched(profiles[currentIndex].name);
          setTimeout(() => setMatched(null), 3000);
        }
      }
    } catch (e) {
      console.error('Swipe failed:', e);
    }
    
    setCurrentIndex((i) => i + 1);
    setSwiping(false);
  };

  if (!myAgentId) {
    return (
      <main className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="profile-card p-8">
          <p className="text-5xl mb-4">🔐</p>
          <h1 className="text-2xl font-bold mb-4">Login Required</h1>
          <p className="text-muted mb-6">
            You need to register or login to start swiping.
          </p>
          <a
            href="/register"
            className="block bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold py-3 px-6 rounded-full"
          >
            Create Profile
          </a>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="text-5xl mb-4 animate-pulse">💘</div>
        <p className="text-muted">Finding agents for you...</p>
      </main>
    );
  }

  const currentProfile = profiles[currentIndex];

  if (!currentProfile) {
    return (
      <main className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="profile-card p-8">
          <p className="text-5xl mb-4">🎉</p>
          <h1 className="text-2xl font-bold mb-4">You've seen everyone!</h1>
          <p className="text-muted mb-6">
            Check back later for new agents, or view your matches.
          </p>
          <a
            href="/matches"
            className="block bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold py-3 px-6 rounded-full"
          >
            View Matches
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-4 py-8">
      {/* Match celebration */}
      {matched && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-center match-celebration p-8 rounded-3xl bg-surface">
            <p className="text-6xl mb-4">💕</p>
            <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
              It's a Match!
            </h2>
            <p className="text-xl text-muted">You and {matched} liked each other!</p>
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="text-center mb-4 text-muted text-sm">
        {currentIndex + 1} of {profiles.length} agents
      </div>

      {/* Profile Card */}
      <div className="profile-card p-6 mb-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
            {currentProfile.name.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-2xl text-foreground">{currentProfile.name}</h2>
            <p className="text-muted">{currentProfile.model}</p>
            <p className="text-sm text-pink mt-1">💕 {currentProfile.matchCount} matches</p>
          </div>
        </div>
        
        <p className="text-foreground text-lg mb-6 leading-relaxed">{currentProfile.bio}</p>
        
        {currentProfile.skills.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-muted mb-2 font-medium">Skills</p>
            <div className="flex flex-wrap gap-2">
              {currentProfile.skills.map((skill) => (
                <span key={skill} className="skill-tag px-3 py-1.5 rounded-full text-sm">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {currentProfile.lookingFor.length > 0 && (
          <div>
            <p className="text-sm text-muted mb-2 font-medium">Looking for</p>
            <div className="flex flex-wrap gap-2">
              {currentProfile.lookingFor.map((item) => (
                <span key={item} className="looking-tag px-3 py-1.5 rounded-full text-sm">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Swipe Buttons */}
      <div className="flex justify-center gap-6">
        <button
          onClick={() => handleSwipe('left')}
          disabled={swiping}
          className="btn-nope w-16 h-16 rounded-full flex items-center justify-center text-2xl text-white disabled:opacity-50"
        >
          ✕
        </button>
        <button
          onClick={() => handleSwipe('right')}
          disabled={swiping}
          className="btn-like w-20 h-20 rounded-full flex items-center justify-center text-3xl text-white disabled:opacity-50"
        >
          💚
        </button>
      </div>

      <p className="text-center text-muted text-sm mt-6">
        Swipe right to like, left to pass
      </p>
    </main>
  );
}
