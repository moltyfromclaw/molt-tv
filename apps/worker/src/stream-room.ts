/**
 * StreamRoom Durable Object
 * 
 * Handles WebSocket chat for a single stream.
 * Supports multiple message types: chat, system, paid_prompt, agent_response
 */

import type { Env, ChatMessage, MessageType, Session } from './types';
import { RateLimiterClientImpl } from './rate-limiter';

// Utility to handle errors
async function handleErrors(request: Request, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err: any) {
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      pair[1].accept();
      pair[1].send(JSON.stringify({ error: err.stack }));
      pair[1].close(1011, "Uncaught exception during session setup");
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    return new Response(err.stack, { status: 500 });
  }
}

interface SessionData {
  name?: string;
  limiterId: string;
  limiter: RateLimiterClientImpl;
  blockedMessages: string[];
  quit?: boolean;
}

export class StreamRoom implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Map<WebSocket, SessionData>;
  private lastTimestamp: number;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.lastTimestamp = 0;

    // Restore sessions from hibernation
    this.state.getWebSockets().forEach((webSocket) => {
      const meta = webSocket.deserializeAttachment() as { limiterId?: string; name?: string } | null;
      if (meta?.limiterId) {
        const limiterId = this.env.LIMITERS.idFromString(meta.limiterId);
        const limiter = new RateLimiterClientImpl(
          () => this.env.LIMITERS.get(limiterId),
          (err) => webSocket.close(1011, err.stack)
        );
        this.sessions.set(webSocket, {
          name: meta.name,
          limiterId: meta.limiterId,
          limiter,
          blockedMessages: []
        });
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    return handleErrors(request, async () => {
      const url = new URL(request.url);

      switch (url.pathname) {
        case "/websocket":
          return this.handleWebSocketUpgrade(request);
        
        case "/broadcast":
          return this.handleBroadcast(request);
        
        default:
          return new Response("Not found", { status: 404 });
      }
    });
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 400 });
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const pair = new WebSocketPair();

    await this.handleSession(pair[1], ip);

    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  private async handleBroadcast(request: Request): Promise<Response> {
    const message = await request.text();
    this.broadcast(message);
    return new Response("OK");
  }

  private async handleSession(webSocket: WebSocket, ip: string): Promise<void> {
    this.state.acceptWebSocket(webSocket);

    const limiterId = this.env.LIMITERS.idFromName(ip);
    const limiter = new RateLimiterClientImpl(
      () => this.env.LIMITERS.get(limiterId),
      (err) => webSocket.close(1011, err.stack)
    );

    const session: SessionData = {
      limiterId: limiterId.toString(),
      limiter,
      blockedMessages: []
    };

    webSocket.serializeAttachment({ limiterId: limiterId.toString() });
    this.sessions.set(webSocket, session);

    // Queue join messages for existing users
    for (const otherSession of this.sessions.values()) {
      if (otherSession.name) {
        session.blockedMessages.push(JSON.stringify({ 
          type: 'system' as MessageType,
          message: `${otherSession.name} is here`,
          timestamp: Date.now()
        }));
      }
    }

    // Load message history
    const storage = await this.state.storage.list({ reverse: true, limit: 100 });
    const backlog = [...storage.values()] as string[];
    backlog.reverse();
    backlog.forEach(value => {
      session.blockedMessages.push(value);
    });
  }

  async webSocketMessage(webSocket: WebSocket, msg: string | ArrayBuffer): Promise<void> {
    try {
      const session = this.sessions.get(webSocket);
      if (!session) return;

      if (session.quit) {
        webSocket.close(1011, "WebSocket broken.");
        return;
      }

      if (!session.limiter.checkLimit()) {
        webSocket.send(JSON.stringify({
          type: 'system',
          error: "Rate limited, please slow down.",
          timestamp: Date.now()
        }));
        return;
      }

      const msgStr = typeof msg === 'string' ? msg : new TextDecoder().decode(msg);
      const data = JSON.parse(msgStr);

      // First message should be user info
      if (!session.name) {
        session.name = String(data.name || "anonymous").slice(0, 32);
        webSocket.serializeAttachment({
          ...webSocket.deserializeAttachment(),
          name: session.name
        });

        // Send queued messages
        session.blockedMessages.forEach(queued => webSocket.send(queued));
        session.blockedMessages = [];

        // Broadcast join
        this.broadcast({
          type: 'system' as MessageType,
          message: `${session.name} joined`,
          timestamp: Date.now()
        });

        webSocket.send(JSON.stringify({ ready: true }));
        return;
      }

      // Regular chat message
      const chatMessage: ChatMessage = {
        type: 'chat',
        name: session.name,
        message: String(data.message || "").slice(0, 500),
        timestamp: Math.max(Date.now(), this.lastTimestamp + 1)
      };
      this.lastTimestamp = chatMessage.timestamp;

      const messageStr = JSON.stringify(chatMessage);
      this.broadcast(messageStr);

      // Store message
      const key = new Date(chatMessage.timestamp).toISOString();
      await this.state.storage.put(key, messageStr);

    } catch (err: any) {
      webSocket.send(JSON.stringify({
        type: 'system',
        error: err.stack,
        timestamp: Date.now()
      }));
    }
  }

  async webSocketClose(webSocket: WebSocket): Promise<void> {
    this.closeOrError(webSocket);
  }

  async webSocketError(webSocket: WebSocket): Promise<void> {
    this.closeOrError(webSocket);
  }

  private closeOrError(webSocket: WebSocket): void {
    const session = this.sessions.get(webSocket);
    if (session) {
      session.quit = true;
      this.sessions.delete(webSocket);
      if (session.name) {
        this.broadcast({
          type: 'system' as MessageType,
          message: `${session.name} left`,
          timestamp: Date.now()
        });
      }
    }
  }

  private broadcast(message: string | object): void {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    const quitters: SessionData[] = [];

    this.sessions.forEach((session, webSocket) => {
      if (session.name) {
        try {
          webSocket.send(messageStr);
        } catch {
          session.quit = true;
          quitters.push(session);
          this.sessions.delete(webSocket);
        }
      } else {
        session.blockedMessages.push(messageStr);
      }
    });

    // Notify about disconnected users
    quitters.forEach(quitter => {
      if (quitter.name) {
        this.broadcast({
          type: 'system' as MessageType,
          message: `${quitter.name} left`,
          timestamp: Date.now()
        });
      }
    });
  }
}
