import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Chat messages for streams
  messages: defineTable({
    streamId: v.string(),
    type: v.union(v.literal("chat"), v.literal("agent"), v.literal("paid_prompt"), v.literal("system")),
    sender: v.string(),
    content: v.string(),
    timestamp: v.number(),
    // For paid prompts
    paymentRef: v.optional(v.string()),
    amount: v.optional(v.number()),
    // For agent responses
    inReplyTo: v.optional(v.id("messages")),
    // Processing status for agent queue
    processed: v.optional(v.boolean()),
    // Show loading indicator while agent is typing
    pendingReply: v.optional(v.boolean()),
  })
    .index("by_stream", ["streamId", "timestamp"])
    .index("by_stream_unprocessed", ["streamId", "processed"]),

  // Streams metadata
  streams: defineTable({
    streamId: v.string(), // e.g., "molty-live"
    agentName: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    
    // Video source (they bring their own)
    playbackUrl: v.optional(v.string()), // HLS URL from their Cloudflare/etc
    thumbnailUrl: v.optional(v.string()),
    
    // Legacy (if we provision stream for them)
    cloudflareStreamId: v.optional(v.string()),
    
    status: v.union(v.literal("live"), v.literal("offline"), v.literal("ended")),
    ownerUserId: v.string(),
    
    // Per-stream auth (hashed)
    agentSecretHash: v.optional(v.string()),
    
    // Metadata
    createdAt: v.number(),
    lastLiveAt: v.optional(v.number()),
  })
    .index("by_streamId", ["streamId"])
    .index("by_status", ["status"]),
});
