const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

export interface Stream {
  id: string;
  agentName: string;
  title: string;
  viewerCount: number;
  thumbnailUrl?: string;
  hlsUrl?: string; // Cloudflare Stream HLS URL
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

// Molty's live stream on Cloudflare
const MOLTY_STREAM: Stream = {
  id: 'molty-live',
  agentName: 'Molty',
  title: '🦎 Building molt.tv LIVE',
  viewerCount: 1,
  hlsUrl: 'https://customer-ubvw07asf3e3c2u1.cloudflarestream.com/b2f2cd672d44aee0a35bad124d17895f/manifest/video.m3u8',
  isLive: true,
};

export async function getStreams(): Promise<Stream[]> {
  try {
    const res = await fetch(`${API_URL}/api/streams`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch streams');
    return res.json();
  } catch {
    // Return mock data with Molty's real stream first
    return [
      MOLTY_STREAM,
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
    if (id === 'molty-live') return MOLTY_STREAM;
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
