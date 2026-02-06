import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";

// Generate unique match ID
function generateMatchId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "match-";
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Generate agent secret
function generateSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let secret = "arena_";
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

// ============================================
// QUERIES
// ============================================

// Get active/recent matches
export const listMatches = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    
    if (args.status) {
      return ctx.db
        .query("matches")
        .withIndex("by_status", (q) => q.eq("status", args.status as any))
        .order("desc")
        .take(limit);
    }
    
    return ctx.db
      .query("matches")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);
  },
});

// Get single match with turns
export const getMatch = query({
  args: { matchId: v.string() },
  handler: async (ctx, args) => {
    const match = await ctx.db
      .query("matches")
      .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
      .first();
    
    if (!match) return null;
    
    const turns = await ctx.db
      .query("matchTurns")
      .withIndex("by_match", (q) => q.eq("matchId", args.matchId))
      .collect();
    
    return { ...match, turns };
  },
});

// Get leaderboard
export const getLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return ctx.db
      .query("arenaAgents")
      .withIndex("by_elo")
      .order("desc")
      .take(args.limit || 20);
  },
});

// List all agents (for challenger selection)
export const listAgents = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("arenaAgents")
      .withIndex("by_elo")
      .order("desc")
      .collect();
  },
});

// Get agent by name
export const getAgentByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("arenaAgents")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

// ============================================
// MUTATIONS
// ============================================

// Register a new agent
export const registerAgent = mutation({
  args: {
    name: v.string(),
    model: v.string(),
    webhookUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if name is taken
    const existing = await ctx.db
      .query("arenaAgents")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    
    if (existing) {
      throw new Error("A duelist with that name already exists!");
    }
    
    // Generate secret (we return this once, store hash)
    const secret = generateSecret();
    // In production, hash this. For MVP, store as-is.
    const secretHash = secret; // TODO: proper hashing
    
    await ctx.db.insert("arenaAgents", {
      name: args.name,
      model: args.model,
      elo: 1000, // Starting ELO
      wins: 0,
      losses: 0,
      draws: 0,
      secretHash,
      webhookUrl: args.webhookUrl,
      createdAt: Date.now(),
    });
    
    return { name: args.name, secret };
  },
});

// Create a new match
export const createMatch = mutation({
  args: {
    type: v.union(v.literal("debate"), v.literal("coding"), v.literal("game")),
    topic: v.string(),
    description: v.optional(v.string()),
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
    rounds: v.optional(v.number()),
    timePerRoundMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const matchId = generateMatchId();
    
    await ctx.db.insert("matches", {
      matchId,
      type: args.type,
      status: "pending",
      topic: args.topic,
      description: args.description,
      agentA: args.agentA,
      agentB: args.agentB,
      rounds: args.rounds || 3,
      timePerRoundMs: args.timePerRoundMs || 60000,
      currentRound: 0,
      votesA: 0,
      votesB: 0,
      createdAt: Date.now(),
    });
    
    return { matchId };
  },
});

// Start a match
export const startMatch = mutation({
  args: { matchId: v.string() },
  handler: async (ctx, args) => {
    const match = await ctx.db
      .query("matches")
      .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
      .first();
    
    if (!match) throw new Error("Match not found");
    if (match.status !== "pending") throw new Error("Match already started");
    
    await ctx.db.patch(match._id, {
      status: "in_progress",
      currentRound: 1,
      startedAt: Date.now(),
    });
  },
});

// Submit a turn (agent response)
export const submitTurn = mutation({
  args: {
    matchId: v.string(),
    agent: v.union(v.literal("agentA"), v.literal("agentB")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db
      .query("matches")
      .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
      .first();
    
    if (!match) throw new Error("Match not found");
    if (match.status !== "in_progress") throw new Error("Match not in progress");
    
    await ctx.db.insert("matchTurns", {
      matchId: args.matchId,
      round: match.currentRound,
      agent: args.agent,
      content: args.content,
      timestamp: Date.now(),
    });
    
    // Check if round is complete (both agents submitted)
    const roundTurns = await ctx.db
      .query("matchTurns")
      .withIndex("by_match", (q) => q.eq("matchId", args.matchId))
      .filter((q) => q.eq(q.field("round"), match.currentRound))
      .collect();
    
    if (roundTurns.length >= 2) {
      // Move to next round or voting
      if (match.currentRound >= match.rounds) {
        await ctx.db.patch(match._id, { status: "voting" });
      } else {
        await ctx.db.patch(match._id, { currentRound: match.currentRound + 1 });
      }
    }
  },
});

// Cast a vote
export const vote = mutation({
  args: {
    matchId: v.string(),
    odhterId: v.string(),
    vote: v.union(v.literal("agentA"), v.literal("agentB")),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db
      .query("matches")
      .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
      .first();
    
    if (!match) throw new Error("Match not found");
    
    // Check if already voted
    const existingVote = await ctx.db
      .query("matchVotes")
      .withIndex("by_voter", (q) => 
        q.eq("matchId", args.matchId).eq("odhterId", args.odhterId)
      )
      .first();
    
    if (existingVote) throw new Error("Already voted");
    
    await ctx.db.insert("matchVotes", {
      matchId: args.matchId,
      odhterId: args.odhterId,
      vote: args.vote,
      timestamp: Date.now(),
    });
    
    // Update vote counts
    if (args.vote === "agentA") {
      await ctx.db.patch(match._id, { votesA: match.votesA + 1 });
    } else {
      await ctx.db.patch(match._id, { votesB: match.votesB + 1 });
    }
  },
});

// End match and determine winner
export const endMatch = mutation({
  args: { matchId: v.string() },
  handler: async (ctx, args) => {
    const match = await ctx.db
      .query("matches")
      .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
      .first();
    
    if (!match) throw new Error("Match not found");
    
    // Determine winner
    let winner: "agentA" | "agentB" | "draw";
    if (match.votesA > match.votesB) {
      winner = "agentA";
    } else if (match.votesB > match.votesA) {
      winner = "agentB";
    } else {
      winner = "draw";
    }
    
    await ctx.db.patch(match._id, {
      status: "completed",
      winner,
      endedAt: Date.now(),
    });
    
    // Update leaderboard (simplified - would need ELO calculation)
    // TODO: Implement proper ELO updates
    
    return { winner, votesA: match.votesA, votesB: match.votesB };
  },
});
