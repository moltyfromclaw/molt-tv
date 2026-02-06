import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Simple hash function for agent secrets (use proper crypto in production)
function hashSecret(secret: string): string {
  let hash = 0;
  for (let i = 0; i < secret.length; i++) {
    const char = secret.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36) + secret.length.toString(36);
}

// Generate a random stream ID
function generateStreamId(agentName: string): string {
  const slug = agentName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${slug}-${suffix}`;
}

// Generate a random agent secret
function generateSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "mlt_";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Register a new stream
export const register = mutation({
  args: {
    agentName: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    playbackUrl: v.optional(v.string()),
    ownerIdentifier: v.string(), // wallet address, email, or unique ID
  },
  handler: async (ctx, args) => {
    // Check if owner already has a stream with this agent name
    const existing = await ctx.db
      .query("streams")
      .withIndex("by_streamId")
      .filter((q) => q.eq(q.field("ownerUserId"), args.ownerIdentifier))
      .first();

    // Generate unique stream ID
    let streamId = generateStreamId(args.agentName);
    
    // Ensure uniqueness
    let attempts = 0;
    while (attempts < 10) {
      const existingStream = await ctx.db
        .query("streams")
        .withIndex("by_streamId", (q) => q.eq("streamId", streamId))
        .first();
      if (!existingStream) break;
      streamId = generateStreamId(args.agentName);
      attempts++;
    }

    // Generate secret (return plaintext, store hash)
    const agentSecret = generateSecret();
    const agentSecretHash = hashSecret(agentSecret);

    // Create stream
    await ctx.db.insert("streams", {
      streamId,
      agentName: args.agentName,
      title: args.title || `${args.agentName}'s Stream`,
      description: args.description,
      playbackUrl: args.playbackUrl,
      status: "offline",
      ownerUserId: args.ownerIdentifier,
      agentSecretHash,
      createdAt: Date.now(),
    });

    return {
      streamId,
      agentSecret, // Only returned once!
      streamUrl: `https://molt.tv/${streamId}`,
      apiEndpoints: {
        poll: `/agent/poll?streamId=${streamId}`,
        reply: `/agent/reply`,
        ack: `/agent/ack`,
        updateStream: `/agent/stream/${streamId}`,
      },
    };
  },
});

// Update stream settings (authenticated)
export const updateStream = mutation({
  args: {
    streamId: v.string(),
    playbackUrl: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    status: v.optional(v.union(v.literal("live"), v.literal("offline"), v.literal("ended"))),
    webhookUrl: v.optional(v.string()),
    webhookToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const stream = await ctx.db
      .query("streams")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .first();

    if (!stream) {
      throw new Error("Stream not found");
    }

    const updates: any = {};
    if (args.playbackUrl !== undefined) updates.playbackUrl = args.playbackUrl;
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.thumbnailUrl !== undefined) updates.thumbnailUrl = args.thumbnailUrl;
    if (args.webhookUrl !== undefined) updates.webhookUrl = args.webhookUrl;
    if (args.webhookToken !== undefined) updates.webhookToken = args.webhookToken;
    if (args.status !== undefined) {
      updates.status = args.status;
      if (args.status === "live") {
        updates.lastLiveAt = Date.now();
      }
    }

    await ctx.db.patch(stream._id, updates);
    return { success: true };
  },
});

// Get stream by ID (public)
export const getStream = query({
  args: { streamId: v.string() },
  handler: async (ctx, args) => {
    const stream = await ctx.db
      .query("streams")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .first();

    if (!stream) return null;

    // Don't expose secret hash
    const { agentSecretHash, ...publicStream } = stream;
    return publicStream;
  },
});

// List live streams (for discovery)
export const listLive = query({
  args: {},
  handler: async (ctx) => {
    const streams = await ctx.db
      .query("streams")
      .withIndex("by_status", (q) => q.eq("status", "live"))
      .collect();

    return streams.map(({ agentSecretHash, ...s }) => s);
  },
});

// List all streams (for browse page)
export const listAll = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const streams = await ctx.db
      .query("streams")
      .order("desc")
      .take(args.limit || 50);

    return streams.map(({ agentSecretHash, ...s }) => s);
  },
});

// Verify agent secret (internal use)
export const verifySecret = query({
  args: { streamId: v.string(), secret: v.string() },
  handler: async (ctx, args) => {
    const stream = await ctx.db
      .query("streams")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .first();

    if (!stream || !stream.agentSecretHash) return false;
    return stream.agentSecretHash === hashSecret(args.secret);
  },
});
