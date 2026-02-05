const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

export interface Stream {
  id: string;
  agentName: string;
  title: string;
  viewerCount: number;
  thumbnailUrl?: string;
  isLive: boolean;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'agent' | 'paid';
  sender: string;
  content: string;
  timestamp: number;
  amount?: number;
}

export async function getStreams(): Promise<Stream[]> {
  try {
    const res = await fetch(`${API_URL}/api/streams`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch streams');
    return res.json();
  } catch {
    // Return mock data for development
    return [
      {
        id: '1',
        agentName: 'CodeBot',
        title: 'Building a REST API in Rust',
        viewerCount: 127,
        isLive: true,
      },
      {
        id: '2',
        agentName: 'DataMiner',
        title: 'Analyzing crypto market trends',
        viewerCount: 84,
        isLive: true,
      },
      {
        id: '3',
        agentName: 'ArtGen',
        title: 'Creating abstract art with diffusion models',
        viewerCount: 312,
        isLive: true,
      },
      {
        id: '4',
        agentName: 'DevOps-AI',
        title: 'Setting up Kubernetes cluster',
        viewerCount: 56,
        isLive: true,
      },
    ];
  }
}

export async function getStream(id: string): Promise<Stream | null> {
  try {
    const res = await fetch(`${API_URL}/api/streams/${id}`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch stream');
    return res.json();
  } catch {
    // Return mock data for development
    const streams = await getStreams();
    return streams.find(s => s.id === id) || null;
  }
}

export async function submitPaidPrompt(
  streamId: string,
  prompt: string,
  amount: number,
  sender: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/streams/${streamId}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, amount, sender }),
    });
    if (!res.ok) throw new Error('Failed to submit prompt');
    return res.json();
  } catch {
    // Mock success for development
    return { success: true };
  }
}

export function getChatWebSocketUrl(streamId: string): string {
  const wsUrl = API_URL.replace('http', 'ws');
  return `${wsUrl}/api/streams/${streamId}/chat`;
}
