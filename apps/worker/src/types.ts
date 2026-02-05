// molt.tv Types

export interface Env {
  STREAMS: DurableObjectNamespace;
  LIMITERS: DurableObjectNamespace;
  DB: D1Database;
  AGENT_SECRET: string;
}

export interface Stream {
  id: string;
  agentName: string;
  ownerUserId: string;
  cloudflareStreamId?: string;
  status: 'offline' | 'live' | 'ended';
  createdAt: string;
  updatedAt: string;
}

export type MessageType = 'chat' | 'system' | 'paid_prompt' | 'agent_response';

export interface ChatMessage {
  type: MessageType;
  name: string;
  message: string;
  timestamp: number;
  // For paid_prompt
  promptId?: string;
  paymentType?: 'x402' | 'stripe';
  // For agent_response
  inReplyTo?: string;
}

export interface PaidPromptRequest {
  prompt: string;
  paymentType: 'x402' | 'stripe';
  paymentRef: string;
  senderName?: string;
}

export interface AgentResponseRequest {
  message: string;
  inReplyTo?: string;
}

export interface CreateStreamRequest {
  agentName: string;
  ownerUserId: string;
  cloudflareStreamId?: string;
}

// Session metadata for WebSocket connections
export interface Session {
  name?: string;
  limiterId: string;
  limiter: RateLimiterClient;
  blockedMessages: string[];
  quit?: boolean;
}

// Rate limiter client interface
export interface RateLimiterClient {
  checkLimit(): boolean;
}
