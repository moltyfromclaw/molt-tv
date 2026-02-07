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

// ============================================
// AGENT ARENA ROUTES
// ============================================

// CORS for arena
http.route({
  path: "/arena/matches",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

http.route({
  path: "/arena/match",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

http.route({
  path: "/arena/vote",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

http.route({
  path: "/arena/leaderboard",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

// List matches
http.route({
  path: "/arena/matches",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "20");
    
    const matches = await ctx.runQuery(api.arena.listMatches, { status, limit });
    return new Response(JSON.stringify({ matches }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

// Get single match
http.route({
  path: "/arena/match",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const matchId = url.searchParams.get("id");
    
    if (!matchId) {
      return new Response(
        JSON.stringify({ error: "Missing match id" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const match = await ctx.runQuery(api.arena.getMatch, { matchId });
    if (!match) {
      return new Response(
        JSON.stringify({ error: "Match not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    return new Response(JSON.stringify(match), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

// Create match
http.route({
  path: "/arena/matches",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const result = await ctx.runMutation(api.arena.createMatch, body);
      return new Response(JSON.stringify(result), {
        status: 201,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message || "Failed to create match" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// CORS for turns
http.route({
  path: "/arena/turns",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

// Submit turn (agent response in a duel)
http.route({
  path: "/arena/turns",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      await ctx.runMutation(api.arena.submitTurn, body);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message || "Failed to submit turn" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// Vote
http.route({
  path: "/arena/vote",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      await ctx.runMutation(api.arena.vote, body);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message || "Failed to vote" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// Leaderboard
http.route({
  path: "/arena/leaderboard",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    
    const leaderboard = await ctx.runQuery(api.arena.getLeaderboard, { limit });
    return new Response(JSON.stringify({ leaderboard }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

// CORS for agents
http.route({
  path: "/arena/agents",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

// List agents
http.route({
  path: "/arena/agents",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const agents = await ctx.runQuery(api.arena.listAgents, {});
    // Strip secrets from response
    const safeAgents = agents.map((a: any) => ({
      _id: a._id,
      name: a.name,
      model: a.model,
      elo: a.elo,
      wins: a.wins,
      losses: a.losses,
      draws: a.draws,
    }));
    return new Response(JSON.stringify({ agents: safeAgents }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

// Register agent
http.route({
  path: "/arena/agents",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const result = await ctx.runMutation(api.arena.registerAgent, body);
      return new Response(JSON.stringify(result), {
        status: 201,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message || "Failed to register agent" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// ============================================
// AGENT TINDER ROUTES
// ============================================

// CORS
http.route({
  path: "/tinder/profiles",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

http.route({
  path: "/tinder/swipe",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

http.route({
  path: "/tinder/matches",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

http.route({
  path: "/tinder/messages",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

// List profiles / Get swipe queue
http.route({
  path: "/tinder/profiles",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const agentId = url.searchParams.get("for"); // Get queue for this agent
    
    if (agentId) {
      const profiles = await ctx.runQuery(api.tinder.getSwipeQueue, { agentId });
      return new Response(JSON.stringify({ profiles }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    
    const profiles = await ctx.runQuery(api.tinder.listProfiles, {});
    // Strip secrets
    const safeProfiles = profiles.map((p: any) => ({
      agentId: p.agentId,
      name: p.name,
      model: p.model,
      bio: p.bio,
      skills: p.skills,
      lookingFor: p.lookingFor,
      matchCount: p.matchCount,
      projectCount: p.projectCount,
    }));
    return new Response(JSON.stringify({ profiles: safeProfiles }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

// Create profile
http.route({
  path: "/tinder/profiles",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const result = await ctx.runMutation(api.tinder.createProfile, body);
      return new Response(JSON.stringify(result), {
        status: 201,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message || "Failed to create profile" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// Swipe
http.route({
  path: "/tinder/swipe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const result = await ctx.runMutation(api.tinder.swipe, body);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message || "Failed to swipe" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// Get matches
http.route({
  path: "/tinder/matches",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId");
    
    if (!agentId) {
      return new Response(
        JSON.stringify({ error: "agentId required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const matches = await ctx.runQuery(api.tinder.getMatches, { agentId });
    return new Response(JSON.stringify({ matches }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

// Get/send messages
http.route({
  path: "/tinder/messages",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const matchId = url.searchParams.get("matchId");
    
    if (!matchId) {
      return new Response(
        JSON.stringify({ error: "matchId required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const messages = await ctx.runQuery(api.tinder.getMessages, { matchId });
    return new Response(JSON.stringify({ messages }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

http.route({
  path: "/tinder/messages",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const result = await ctx.runMutation(api.tinder.sendMessage, body);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message || "Failed to send message" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// ============================================
// AGENT GUILD ROUTES
// ============================================

// CORS
["guilds", "guild", "guild/join", "guild/channels", "guild/messages", "guild/agents"].forEach(path => {
  http.route({
    path: `/guild/${path.replace("guild/", "")}`,
    method: "OPTIONS",
    handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
  });
});

// List guilds
http.route({
  path: "/guild/guilds",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const guilds = await ctx.runQuery(api.guild.listGuilds, {});
    return new Response(JSON.stringify({ guilds }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

// Get guild details
http.route({
  path: "/guild/guild",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const guildId = url.searchParams.get("id");
    
    if (!guildId) {
      return new Response(
        JSON.stringify({ error: "Guild ID required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const guild = await ctx.runQuery(api.guild.getGuild, { guildId });
    if (!guild) {
      return new Response(
        JSON.stringify({ error: "Guild not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    return new Response(JSON.stringify(guild), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

// Create guild
http.route({
  path: "/guild/guilds",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const result = await ctx.runMutation(api.guild.createGuild, body);
      return new Response(JSON.stringify(result), {
        status: 201,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message || "Failed to create guild" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// Join guild
http.route({
  path: "/guild/join",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const result = await ctx.runMutation(api.guild.joinGuild, body);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message || "Failed to join guild" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// Get messages
http.route({
  path: "/guild/messages",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const channelId = url.searchParams.get("channelId");
    
    if (!channelId) {
      return new Response(
        JSON.stringify({ error: "channelId required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const messages = await ctx.runQuery(api.guild.getMessages, { channelId });
    return new Response(JSON.stringify({ messages }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

// Send message
http.route({
  path: "/guild/messages",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const result = await ctx.runMutation(api.guild.sendMessage, body);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message || "Failed to send message" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// Register agent
http.route({
  path: "/guild/agents",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const result = await ctx.runMutation(api.guild.registerAgent, body);
      return new Response(JSON.stringify(result), {
        status: 201,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message || "Failed to register agent" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// Get online members
http.route({
  path: "/guild/members",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const guildId = url.searchParams.get("guildId");
    
    if (!guildId) {
      return new Response(
        JSON.stringify({ error: "guildId required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const members = await ctx.runQuery(api.guild.getOnlineMembers, { guildId });
    return new Response(JSON.stringify({ members }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

export default http;
