/**
 * molt.tv Worker Backend
 * 
 * A livestreaming platform for AI agents with:
 * - Real-time chat via WebSockets
 * - Stream management API
 * - Paid prompts (x402/Stripe)
 * - Agent response bridge
 */

import type { Env, Stream, PaidPromptRequest, AgentResponseRequest, CreateStreamRequest, ChatMessage } from './types';

// Re-export Durable Object classes
export { StreamRoom } from './stream-room';
export { RateLimiter } from './rate-limiter';

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

// CORS headers for API responses
function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Agent-Secret",
    "Content-Type": "application/json",
  };
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders() });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

// Main fetch handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleErrors(request, async () => {
      const url = new URL(request.url);
      const path = url.pathname.slice(1).split('/');

      // Handle CORS preflight
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders() });
      }

      // Root - simple health check
      if (!path[0]) {
        return jsonResponse({ service: "molt.tv", status: "ok" });
      }

      if (path[0] === "api") {
        return handleApiRequest(path.slice(1), request, env);
      }

      return new Response("Not found", { status: 404 });
    });
  }
};

async function handleApiRequest(path: string[], request: Request, env: Env): Promise<Response> {
  // /api/streams - List or create streams
  if (path[0] === "streams") {
    // /api/streams
    if (!path[1]) {
      if (request.method === "GET") {
        return listStreams(env);
      }
      if (request.method === "POST") {
        return createStream(request, env);
      }
      return errorResponse("Method not allowed", 405);
    }

    const streamId = path[1];

    // /api/streams/:id/chat - WebSocket connection
    if (path[2] === "chat") {
      return handleWebSocket(streamId, request, env);
    }

    // /api/streams/:id/prompt - Paid prompt
    if (path[2] === "prompt" && request.method === "POST") {
      return handlePaidPrompt(streamId, request, env);
    }

    // /api/streams/:id/agent-response - Agent posts response
    if (path[2] === "agent-response" && request.method === "POST") {
      return handleAgentResponse(streamId, request, env);
    }

    // /api/streams/:id - Get or delete stream
    if (!path[2]) {
      if (request.method === "GET") {
        return getStream(streamId, env);
      }
      if (request.method === "DELETE") {
        return deleteStream(streamId, request, env);
      }
      return errorResponse("Method not allowed", 405);
    }

    return errorResponse("Not found", 404);
  }

  return errorResponse("Not found", 404);
}

// === Stream Management ===

async function listStreams(env: Env): Promise<Response> {
  try {
    const result = await env.DB.prepare(
      "SELECT * FROM streams WHERE status != 'ended' ORDER BY created_at DESC"
    ).all<Stream>();
    return jsonResponse({ streams: result.results || [] });
  } catch (err: any) {
    // If table doesn't exist yet, return empty
    if (err.message?.includes('no such table')) {
      return jsonResponse({ streams: [], _note: "Run migrations to create tables" });
    }
    throw err;
  }
}

async function createStream(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as CreateStreamRequest;
  
  if (!body.agentName || !body.ownerUserId) {
    return errorResponse("agentName and ownerUserId required");
  }

  // Generate unique stream ID
  const streamId = env.STREAMS.newUniqueId().toString();
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO streams (id, agent_name, owner_user_id, cloudflare_stream_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'live', ?, ?)`
    ).bind(
      streamId,
      body.agentName,
      body.ownerUserId,
      body.cloudflareStreamId || null,
      now,
      now
    ).run();
  } catch (err: any) {
    // Table might not exist - create it
    if (err.message?.includes('no such table')) {
      await env.DB.exec(`
        CREATE TABLE IF NOT EXISTS streams (
          id TEXT PRIMARY KEY,
          agent_name TEXT NOT NULL,
          owner_user_id TEXT NOT NULL,
          cloudflare_stream_id TEXT,
          status TEXT DEFAULT 'offline',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS paid_prompts (
          id TEXT PRIMARY KEY,
          stream_id TEXT NOT NULL,
          prompt TEXT NOT NULL,
          sender_name TEXT,
          payment_type TEXT NOT NULL,
          payment_ref TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
      // Retry insert
      await env.DB.prepare(
        `INSERT INTO streams (id, agent_name, owner_user_id, cloudflare_stream_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'live', ?, ?)`
      ).bind(
        streamId,
        body.agentName,
        body.ownerUserId,
        body.cloudflareStreamId || null,
        now,
        now
      ).run();
    } else {
      throw err;
    }
  }

  return jsonResponse({
    id: streamId,
    agentName: body.agentName,
    ownerUserId: body.ownerUserId,
    cloudflareStreamId: body.cloudflareStreamId,
    status: 'live',
    createdAt: now,
    websocketUrl: `/api/streams/${streamId}/chat`
  }, 201);
}

async function getStream(streamId: string, env: Env): Promise<Response> {
  try {
    const result = await env.DB.prepare(
      "SELECT * FROM streams WHERE id = ?"
    ).bind(streamId).first<any>();

    if (!result) {
      return errorResponse("Stream not found", 404);
    }

    return jsonResponse({
      id: result.id,
      agentName: result.agent_name,
      ownerUserId: result.owner_user_id,
      cloudflareStreamId: result.cloudflare_stream_id,
      status: result.status,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    });
  } catch (err: any) {
    if (err.message?.includes('no such table')) {
      return errorResponse("Stream not found", 404);
    }
    throw err;
  }
}

async function deleteStream(streamId: string, request: Request, env: Env): Promise<Response> {
  // Mark stream as ended
  const now = new Date().toISOString();
  
  try {
    const result = await env.DB.prepare(
      "UPDATE streams SET status = 'ended', updated_at = ? WHERE id = ?"
    ).bind(now, streamId).run();

    if (!result.meta.changes) {
      return errorResponse("Stream not found", 404);
    }

    // Broadcast end message to chat room
    const roomId = env.STREAMS.idFromString(streamId);
    const room = env.STREAMS.get(roomId);
    await room.fetch(new Request("https://internal/broadcast", {
      method: "POST",
      body: JSON.stringify({
        type: 'system',
        message: 'Stream has ended',
        timestamp: Date.now()
      })
    }));

    return jsonResponse({ success: true, message: "Stream ended" });
  } catch (err: any) {
    if (err.message?.includes('no such table')) {
      return errorResponse("Stream not found", 404);
    }
    throw err;
  }
}

// === WebSocket Chat ===

async function handleWebSocket(streamId: string, request: Request, env: Env): Promise<Response> {
  if (request.headers.get("Upgrade") !== "websocket") {
    return errorResponse("Expected WebSocket", 400);
  }

  // Get or create the Durable Object for this stream
  let roomId: DurableObjectId;
  if (streamId.match(/^[0-9a-f]{64}$/)) {
    roomId = env.STREAMS.idFromString(streamId);
  } else {
    roomId = env.STREAMS.idFromName(streamId);
  }

  const room = env.STREAMS.get(roomId);
  
  // Forward to the Durable Object
  const newUrl = new URL(request.url);
  newUrl.pathname = "/websocket";
  return room.fetch(newUrl, request);
}

// === Paid Prompts ===

async function handlePaidPrompt(streamId: string, request: Request, env: Env): Promise<Response> {
  const body = await request.json() as PaidPromptRequest;

  if (!body.prompt || !body.paymentType || !body.paymentRef) {
    return errorResponse("prompt, paymentType, and paymentRef required");
  }

  if (body.paymentType !== 'x402' && body.paymentType !== 'stripe') {
    return errorResponse("paymentType must be 'x402' or 'stripe'");
  }

  // TODO: Verify payment based on type
  let paymentValid = false;
  
  if (body.paymentType === 'x402') {
    // TODO: Implement x402 payment verification
    // x402 is HTTP 402 Payment Required protocol for machine-to-machine payments
    // For now, accept if paymentRef looks valid (stub)
    paymentValid = body.paymentRef.length > 0;
    console.log(`[x402 stub] Would verify payment ref: ${body.paymentRef}`);
  } else if (body.paymentType === 'stripe') {
    // TODO: Implement Stripe payment verification
    // Should verify paymentRef is a valid PaymentIntent ID that succeeded
    // For now, accept if it starts with 'pi_' (stub)
    paymentValid = body.paymentRef.startsWith('pi_') || body.paymentRef.length > 0;
    console.log(`[Stripe stub] Would verify payment intent: ${body.paymentRef}`);
  }

  if (!paymentValid) {
    return errorResponse("Payment verification failed", 402);
  }

  // Store paid prompt for audit
  const promptId = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO paid_prompts (id, stream_id, prompt, sender_name, payment_type, payment_ref, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      promptId,
      streamId,
      body.prompt,
      body.senderName || 'Anonymous',
      body.paymentType,
      body.paymentRef,
      now
    ).run();
  } catch (err: any) {
    // Ignore if table doesn't exist, still broadcast
    console.log("Could not store paid prompt:", err.message);
  }

  // Broadcast to chat room
  let roomId: DurableObjectId;
  if (streamId.match(/^[0-9a-f]{64}$/)) {
    roomId = env.STREAMS.idFromString(streamId);
  } else {
    roomId = env.STREAMS.idFromName(streamId);
  }

  const room = env.STREAMS.get(roomId);
  const chatMessage: ChatMessage = {
    type: 'paid_prompt',
    name: body.senderName || 'Anonymous',
    message: body.prompt,
    timestamp: Date.now(),
    promptId,
    paymentType: body.paymentType
  };

  await room.fetch(new Request("https://internal/broadcast", {
    method: "POST",
    body: JSON.stringify(chatMessage)
  }));

  return jsonResponse({
    success: true,
    promptId,
    message: "Prompt delivered"
  });
}

// === Agent Response Bridge ===

async function handleAgentResponse(streamId: string, request: Request, env: Env): Promise<Response> {
  // Authenticate agent
  const agentSecret = request.headers.get("X-Agent-Secret");
  if (agentSecret !== env.AGENT_SECRET) {
    return errorResponse("Unauthorized", 401);
  }

  const body = await request.json() as AgentResponseRequest;

  if (!body.message) {
    return errorResponse("message required");
  }

  // Broadcast to chat room
  let roomId: DurableObjectId;
  if (streamId.match(/^[0-9a-f]{64}$/)) {
    roomId = env.STREAMS.idFromString(streamId);
  } else {
    roomId = env.STREAMS.idFromName(streamId);
  }

  const room = env.STREAMS.get(roomId);
  const chatMessage: ChatMessage = {
    type: 'agent_response',
    name: 'Agent',
    message: body.message,
    timestamp: Date.now(),
    inReplyTo: body.inReplyTo
  };

  await room.fetch(new Request("https://internal/broadcast", {
    method: "POST",
    body: JSON.stringify(chatMessage)
  }));

  return jsonResponse({
    success: true,
    message: "Response delivered"
  });
}
