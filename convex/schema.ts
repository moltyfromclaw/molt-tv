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
    
    // Webhook for real-time notifications
    webhookUrl: v.optional(v.string()),
    webhookToken: v.optional(v.string()),
    
    // Metadata
    createdAt: v.number(),
    lastLiveAt: v.optional(v.number()),
  })
    .index("by_streamId", ["streamId"])
    .index("by_status", ["status"]),

  // ============================================
  // AGENT ARENA - AI vs AI Competitions
  // ============================================
  
  // Matches/Debates
  matches: defineTable({
    matchId: v.string(),
    type: v.union(v.literal("debate"), v.literal("coding"), v.literal("game")),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("voting"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    
    // Topic/Challenge
    topic: v.string(),
    description: v.optional(v.string()),
    
    // Participants
    agentA: v.object({
      name: v.string(),
      model: v.string(),
      avatar: v.optional(v.string()),
    }),
    agentB: v.object({
      name: v.string(),
      model: v.string(),
      avatar: v.optional(v.string()),
    }),
    
    // Match settings
    rounds: v.number(),
    timePerRoundMs: v.number(),
    currentRound: v.number(),
    
    // Results
    winner: v.optional(v.union(v.literal("agentA"), v.literal("agentB"), v.literal("draw"))),
    votesA: v.number(),
    votesB: v.number(),
    
    // Timestamps
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
  })
    .index("by_matchId", ["matchId"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),
  
  // Match turns/responses
  matchTurns: defineTable({
    matchId: v.string(),
    round: v.number(),
    agent: v.union(v.literal("agentA"), v.literal("agentB")),
    content: v.string(),
    timestamp: v.number(),
  })
    .index("by_match", ["matchId", "round"]),
  
  // Votes
  matchVotes: defineTable({
    matchId: v.string(),
    odhterId: v.string(), // Anonymous voter ID
    vote: v.union(v.literal("agentA"), v.literal("agentB")),
    timestamp: v.number(),
  })
    .index("by_match", ["matchId"])
    .index("by_voter", ["matchId", "odhterId"]),
  
  // Leaderboard / Registered Agents
  arenaAgents: defineTable({
    name: v.string(),
    model: v.string(),
    elo: v.number(),
    wins: v.number(),
    losses: v.number(),
    draws: v.number(),
    lastMatchAt: v.optional(v.number()),
    // Auth & Webhooks
    secretHash: v.optional(v.string()),
    webhookUrl: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  })
    .index("by_name", ["name"])
    .index("by_elo", ["elo"]),
});
