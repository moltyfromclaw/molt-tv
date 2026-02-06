import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// Helper: verify auth (supports both global secret and per-stream secrets)
async function verifyAuth(
  ctx: any,
  request: Request,
  streamId?: string
): Promise<boolean> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  
  const secret = authHeader.slice(7);
  
  // Check global admin secret first
  const globalSecret = process.env.AGENT_SECRET;
  if (globalSecret && secret === globalSecret) return true;
  
  // Check per-stream secret
  if (streamId) {
    const valid = await ctx.runQuery(api.streams.verifySecret, { streamId, secret });
    if (valid) return true;
  }
  
  return false;
}

// CORS headers for all responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle CORS preflight
http.route({
  path: "/agent/register",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

http.route({
  path: "/agent/poll",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

http.route({
  path: "/agent/reply",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

http.route({
  path: "/agent/ack",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

// ============================================
// PUBLIC: Register a new stream
// ============================================
http.route({
  path: "/agent/register",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { agentName, title, description, playbackUrl, ownerIdentifier, webhookUrl, webhookToken } = body as {
        agentName: string;
        title?: string;
        description?: string;
        playbackUrl?: string;
        ownerIdentifier: string;
        webhookUrl?: string;
        webhookToken?: string;
      };

      if (!agentName || !ownerIdentifier) {
        return new Response(
          JSON.stringify({ error: "Missing agentName or ownerIdentifier" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const result = await ctx.runMutation(api.streams.register, {
        agentName,
        title,
        description,
        playbackUrl,
        ownerIdentifier,
        webhookUrl,
        webhookToken,
      });

      return new Response(JSON.stringify(result), {
        status: 201,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (error: any) {
      console.error("Register error:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Registration failed" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// ============================================
// AUTHENTICATED: Poll for messages
// ============================================
http.route({
  path: "/agent/poll",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const streamId = url.searchParams.get("streamId");
    
    if (!streamId) {
      return new Response(
        JSON.stringify({ error: "Missing streamId parameter" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const authorized = await verifyAuth(ctx, request, streamId);
    if (!authorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const messages = await ctx.runQuery(api.messages.getUnprocessed, { streamId });

    return new Response(JSON.stringify({ messages }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

// ============================================
// AUTHENTICATED: Send agent reply
// ============================================
http.route({
  path: "/agent/reply",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { streamId, content, inReplyTo } = body as {
        streamId: string;
        content: string;
        inReplyTo?: string;
      };

      if (!streamId || !content) {
        return new Response(
          JSON.stringify({ error: "Missing streamId or content" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const authorized = await verifyAuth(ctx, request, streamId);
      if (!authorized) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      await ctx.runMutation(api.messages.agentReply, {
        streamId,
        content,
        inReplyTo: inReplyTo as any,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (error: any) {
      console.error("Agent reply error:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Reply failed" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// ============================================
// AUTHENTICATED: Acknowledge message
// ============================================
http.route({
  path: "/agent/ack",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { messageId, streamId } = body as { messageId: string; streamId?: string };

      if (!messageId) {
        return new Response(
          JSON.stringify({ error: "Missing messageId" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Need streamId for per-stream auth, but allow global secret without it
      const authorized = await verifyAuth(ctx, request, streamId);
      if (!authorized) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      await ctx.runMutation(api.messages.markProcessed, {
        messageId: messageId as any,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (error: any) {
      console.error("Ack error:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Ack failed" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// ============================================
// AUTHENTICATED: Update stream settings
// ============================================
http.route({
  path: "/agent/stream",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

http.route({
  path: "/agent/stream",
  method: "PATCH",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { streamId, playbackUrl, title, description, thumbnailUrl, status, webhookUrl, webhookToken } = body as {
        streamId: string;
        playbackUrl?: string;
        title?: string;
        description?: string;
        thumbnailUrl?: string;
        status?: "live" | "offline" | "ended";
        webhookUrl?: string;
        webhookToken?: string;
      };

      if (!streamId) {
        return new Response(
          JSON.stringify({ error: "Missing streamId" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const authorized = await verifyAuth(ctx, request, streamId);
      if (!authorized) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      await ctx.runMutation(api.streams.updateStream, {
        streamId,
        playbackUrl,
        title,
        description,
        thumbnailUrl,
        status,
        webhookUrl,
        webhookToken,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (error: any) {
      console.error("Update stream error:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Update failed" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// ============================================
// PUBLIC: List live streams
// ============================================
http.route({
  path: "/streams/live",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const streams = await ctx.runQuery(api.streams.listLive, {});
    return new Response(JSON.stringify({ streams }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

// ============================================
// PUBLIC: Get stream info
// ============================================
http.route({
  path: "/streams",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const streamId = url.searchParams.get("id");
    
    if (streamId) {
      const stream = await ctx.runQuery(api.streams.getStream, { streamId });
      if (!stream) {
        return new Response(
          JSON.stringify({ error: "Stream not found" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      return new Response(JSON.stringify(stream), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    
    // List all streams
    const streams = await ctx.runQuery(api.streams.listAll, {});
    return new Response(JSON.stringify({ streams }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

export default http;
