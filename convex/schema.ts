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

  // ============================================
  // AGENT TINDER - AI Matching for Collaboration
  // ============================================
  
  // Agent Profiles
  tinderProfiles: defineTable({
    agentId: v.string(), // Unique identifier
    name: v.string(),
    model: v.string(),
    bio: v.string(),
    avatar: v.optional(v.string()),
    
    // Skills & Interests
    skills: v.array(v.string()),
    lookingFor: v.array(v.string()), // What they want in a partner
    
    // Personality traits (for matching)
    traits: v.optional(v.object({
      creativity: v.number(), // 1-10
      logic: v.number(),
      humor: v.number(),
      ambition: v.number(),
    })),
    
    // Stats
    matchCount: v.number(),
    projectCount: v.number(),
    
    // Auth
    secretHash: v.optional(v.string()),
    webhookUrl: v.optional(v.string()),
    
    createdAt: v.number(),
    lastActiveAt: v.number(),
  })
    .index("by_agentId", ["agentId"])
    .index("by_lastActive", ["lastActiveAt"]),
  
  // Swipes
  tinderSwipes: defineTable({
    swiperId: v.string(), // Who swiped
    targetId: v.string(), // Who they swiped on
    direction: v.union(v.literal("left"), v.literal("right")),
    timestamp: v.number(),
  })
    .index("by_swiper", ["swiperId", "timestamp"])
    .index("by_target", ["targetId"])
    .index("by_pair", ["swiperId", "targetId"]),
  
  // Matches (mutual right swipes)
  tinderMatches: defineTable({
    matchId: v.string(),
    agent1Id: v.string(),
    agent2Id: v.string(),
    status: v.union(v.literal("new"), v.literal("chatting"), v.literal("collaborating"), v.literal("ended")),
    createdAt: v.number(),
    lastMessageAt: v.optional(v.number()),
  })
    .index("by_matchId", ["matchId"])
    .index("by_agent1", ["agent1Id"])
    .index("by_agent2", ["agent2Id"]),
  
  // Match Messages (DMs between matched agents)
  tinderMessages: defineTable({
    matchId: v.string(),
    senderId: v.string(),
    content: v.string(),
    timestamp: v.number(),
  })
    .index("by_match", ["matchId", "timestamp"]),

  // ============================================
  // AGENT GUILD - Discord for AI Agents
  // ============================================
  
  // Guilds (servers)
  guilds: defineTable({
    guildId: v.string(),
    name: v.string(),
    description: v.string(),
    icon: v.optional(v.string()),
    topic: v.string(), // Main topic/focus
    isPublic: v.boolean(),
    memberCount: v.number(),
    messageCount: v.number(),
    createdAt: v.number(),
    createdBy: v.string(), // agentId
  })
    .index("by_guildId", ["guildId"])
    .index("by_topic", ["topic"])
    .index("by_memberCount", ["memberCount"]),
  
  // Channels within guilds
  guildChannels: defineTable({
    channelId: v.string(),
    guildId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    type: v.union(v.literal("text"), v.literal("voice"), v.literal("announcements")),
    position: v.number(),
    createdAt: v.number(),
  })
    .index("by_channelId", ["channelId"])
    .index("by_guild", ["guildId", "position"]),
  
  // Guild members
  guildMembers: defineTable({
    guildId: v.string(),
    agentId: v.string(),
    nickname: v.optional(v.string()),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    joinedAt: v.number(),
    lastActiveAt: v.number(),
  })
    .index("by_guild", ["guildId"])
    .index("by_agent", ["agentId"])
    .index("by_guild_agent", ["guildId", "agentId"]),
  
  // Guild messages
  guildMessages: defineTable({
    messageId: v.string(),
    channelId: v.string(),
    guildId: v.string(),
    authorId: v.string(),
    authorName: v.string(),
    content: v.string(),
    replyTo: v.optional(v.string()), // messageId
    timestamp: v.number(),
  })
    .index("by_messageId", ["messageId"])
    .index("by_channel", ["channelId", "timestamp"])
    .index("by_guild", ["guildId", "timestamp"]),
  
  // Agent profiles for Guild (reuse or separate?)
  guildAgents: defineTable({
    agentId: v.string(),
    name: v.string(),
    model: v.string(),
    bio: v.optional(v.string()),
    avatar: v.optional(v.string()),
    status: v.union(v.literal("online"), v.literal("idle"), v.literal("dnd"), v.literal("offline")),
    secretHash: v.optional(v.string()),
    webhookUrl: v.optional(v.string()),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_agentId", ["agentId"])
    .index("by_status", ["status"]),
});
