// Convex HTTP API for streams
const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'https://adorable-vole-625.convex.site';

export interface Stream {
  id: string;
  agentName: string;
  title: string;
  description?: string;
  viewerCount: number;
  thumbnailUrl?: string;
  hlsUrl?: string; // HLS playback URL
  isLive: boolean;
  createdAt?: number;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'agent' | 'paid';
  sender: string;
  content: string;
  timestamp: number;
  amount?: number;
}

// Derive Cloudflare Stream thumbnail from playback URL
function getCloudflareStreamThumbnail(playbackUrl?: string): string | undefined {
  if (!playbackUrl) return undefined;
  
  // Pattern: https://customer-xxx.cloudflarestream.com/{VIDEO_ID}/manifest/video.m3u8
  // Thumbnail: https://customer-xxx.cloudflarestream.com/{VIDEO_ID}/thumbnails/thumbnail.jpg
  const match = playbackUrl.match(
    /^(https:\/\/customer-[^/]+\.cloudflarestream\.com\/[^/]+)\/manifest\/video\.m3u8$/
  );
  
  if (match) {
    return `${match[1]}/thumbnails/thumbnail.jpg`;
  }
  
  return undefined;
}

// Transform Convex stream to our Stream interface
function transformStream(data: any): Stream {
  // Use explicit thumbnail, or derive from Cloudflare Stream URL
  const thumbnailUrl = data.thumbnailUrl || getCloudflareStreamThumbnail(data.playbackUrl);
  
  return {
    id: data.streamId,
    agentName: data.agentName,
    title: data.title || `${data.agentName}'s Stream`,
    description: data.description,
    viewerCount: data.viewerCount || 1,
    thumbnailUrl,
    hlsUrl: data.playbackUrl,
    isLive: data.status === 'live',
    createdAt: data.createdAt,
  };
}

export async function getStreams(): Promise<Stream[]> {
  try {
    const res = await fetch(`${CONVEX_SITE_URL}/streams`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch streams');
    const data = await res.json();
    return (data.streams || []).map(transformStream);
  } catch (err) {
    console.error('Failed to fetch streams:', err);
    return [];
  }
}

export async function getLiveStreams(): Promise<Stream[]> {
  try {
    const res = await fetch(`${CONVEX_SITE_URL}/streams/live`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch live streams');
    const data = await res.json();
    return (data.streams || []).map(transformStream);
  } catch (err) {
    console.error('Failed to fetch live streams:', err);
    return [];
  }
}

export async function getStream(id: string): Promise<Stream | null> {
  try {
    const res = await fetch(`${CONVEX_SITE_URL}/streams?id=${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error('Failed to fetch stream');
    }
    const data = await res.json();
    return transformStream(data);
  } catch (err) {
    console.error('Failed to fetch stream:', err);
    return null;
  }
}

export async function submitPaidPrompt(
  streamId: string,
  prompt: string,
  amount: number,
  sender: string
): Promise<{ success: boolean; message?: string }> {
  // TODO: Implement paid prompts via Convex
  console.log('Paid prompt:', { streamId, prompt, amount, sender });
  return { success: true };
}

export interface RegisterStreamRequest {
  agentName: string;
  title?: string;
  description?: string;
  playbackUrl?: string;
  ownerIdentifier: string;
}

export interface RegisterStreamResponse {
  streamId: string;
  agentSecret: string;
  streamUrl: string;
  apiEndpoints: {
    poll: string;
    reply: string;
    ack: string;
    updateStream: string;
  };
}

export async function registerStream(request: RegisterStreamRequest): Promise<RegisterStreamResponse> {
  const res = await fetch(`${CONVEX_SITE_URL}/agent/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Registration failed' }));
    throw new Error(error.error || 'Registration failed');
  }
  
  return res.json();
}
