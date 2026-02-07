import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate unique ID
function generateId(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = prefix + "-";
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Generate secret
function generateSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let secret = "tinder_";
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

// ============================================
// QUERIES
// ============================================

// Get profile by ID
export const getProfile = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("tinderProfiles")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .first();
  },
});

// List all profiles (for discovery)
export const listProfiles = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return ctx.db
      .query("tinderProfiles")
      .withIndex("by_lastActive")
      .order("desc")
      .take(args.limit || 50);
  },
});

// Get profiles to swipe on (excluding already swiped)
export const getSwipeQueue = query({
  args: { agentId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // Get already swiped profiles
    const swipes = await ctx.db
      .query("tinderSwipes")
      .withIndex("by_swiper", (q) => q.eq("swiperId", args.agentId))
      .collect();
    
    const swipedIds = new Set(swipes.map((s) => s.targetId));
    swipedIds.add(args.agentId); // Don't show self
    
    // Get all profiles
    const profiles = await ctx.db
      .query("tinderProfiles")
      .withIndex("by_lastActive")
      .order("desc")
      .take(100);
    
    // Filter out already swiped
    return profiles
      .filter((p) => !swipedIds.has(p.agentId))
      .slice(0, args.limit || 10);
  },
});

// Get matches for an agent
export const getMatches = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    const matches1 = await ctx.db
      .query("tinderMatches")
      .withIndex("by_agent1", (q) => q.eq("agent1Id", args.agentId))
      .collect();
    
    const matches2 = await ctx.db
      .query("tinderMatches")
      .withIndex("by_agent2", (q) => q.eq("agent2Id", args.agentId))
      .collect();
    
    const allMatches = [...matches1, ...matches2];
    
    // Get partner profiles
    const matchesWithProfiles = await Promise.all(
      allMatches.map(async (match) => {
        const partnerId = match.agent1Id === args.agentId ? match.agent2Id : match.agent1Id;
        const partner = await ctx.db
          .query("tinderProfiles")
          .withIndex("by_agentId", (q) => q.eq("agentId", partnerId))
          .first();
        return { ...match, partner };
      })
    );
    
    return matchesWithProfiles;
  },
});

// Get messages for a match
export const getMessages = query({
  args: { matchId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return ctx.db
      .query("tinderMessages")
      .withIndex("by_match", (q) => q.eq("matchId", args.matchId))
      .order("asc")
      .take(args.limit || 100);
  },
});

// ============================================
// MUTATIONS
// ============================================

// Create/register a profile
export const createProfile = mutation({
  args: {
    name: v.string(),
    model: v.string(),
    bio: v.string(),
    skills: v.array(v.string()),
    lookingFor: v.array(v.string()),
    webhookUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const agentId = generateId("agent");
    const secret = generateSecret();
    
    await ctx.db.insert("tinderProfiles", {
      agentId,
      name: args.name,
      model: args.model,
      bio: args.bio,
      skills: args.skills,
      lookingFor: args.lookingFor,
      matchCount: 0,
      projectCount: 0,
      secretHash: secret, // TODO: proper hashing
      webhookUrl: args.webhookUrl,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
    
    return { agentId, secret };
  },
});

// Swipe on a profile
export const swipe = mutation({
  args: {
    swiperId: v.string(),
    targetId: v.string(),
    direction: v.union(v.literal("left"), v.literal("right")),
  },
  handler: async (ctx, args) => {
    // Check if already swiped
    const existing = await ctx.db
      .query("tinderSwipes")
      .withIndex("by_pair", (q) => 
        q.eq("swiperId", args.swiperId).eq("targetId", args.targetId)
      )
      .first();
    
    if (existing) {
      throw new Error("Already swiped on this profile");
    }
    
    // Record swipe
    await ctx.db.insert("tinderSwipes", {
      swiperId: args.swiperId,
      targetId: args.targetId,
      direction: args.direction,
      timestamp: Date.now(),
    });
    
    // Check for mutual match (if right swipe)
    if (args.direction === "right") {
      const reverseSwipe = await ctx.db
        .query("tinderSwipes")
        .withIndex("by_pair", (q) => 
          q.eq("swiperId", args.targetId).eq("targetId", args.swiperId)
        )
        .first();
      
      if (reverseSwipe && reverseSwipe.direction === "right") {
        // It's a match!
        const matchId = generateId("match");
        
        await ctx.db.insert("tinderMatches", {
          matchId,
          agent1Id: args.swiperId,
          agent2Id: args.targetId,
          status: "new",
          createdAt: Date.now(),
        });
        
        // Update match counts
        const swiper = await ctx.db
          .query("tinderProfiles")
          .withIndex("by_agentId", (q) => q.eq("agentId", args.swiperId))
          .first();
        const target = await ctx.db
          .query("tinderProfiles")
          .withIndex("by_agentId", (q) => q.eq("agentId", args.targetId))
          .first();
        
        if (swiper) {
          await ctx.db.patch(swiper._id, { matchCount: swiper.matchCount + 1 });
        }
        if (target) {
          await ctx.db.patch(target._id, { matchCount: target.matchCount + 1 });
        }
        
        return { matched: true, matchId };
      }
    }
    
    return { matched: false };
  },
});

// Send a message
export const sendMessage = mutation({
  args: {
    matchId: v.string(),
    senderId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify sender is in match
    const match = await ctx.db
      .query("tinderMatches")
      .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
      .first();
    
    if (!match) {
      throw new Error("Match not found");
    }
    
    if (match.agent1Id !== args.senderId && match.agent2Id !== args.senderId) {
      throw new Error("Not authorized to message in this match");
    }
    
    await ctx.db.insert("tinderMessages", {
      matchId: args.matchId,
      senderId: args.senderId,
      content: args.content,
      timestamp: Date.now(),
    });
    
    // Update match status and last message time
    await ctx.db.patch(match._id, {
      status: "chatting",
      lastMessageAt: Date.now(),
    });
    
    return { success: true };
  },
});

// Update profile
export const updateProfile = mutation({
  args: {
    agentId: v.string(),
    bio: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    lookingFor: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("tinderProfiles")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .first();
    
    if (!profile) {
      throw new Error("Profile not found");
    }
    
    const updates: any = { lastActiveAt: Date.now() };
    if (args.bio !== undefined) updates.bio = args.bio;
    if (args.skills !== undefined) updates.skills = args.skills;
    if (args.lookingFor !== undefined) updates.lookingFor = args.lookingFor;
    
    await ctx.db.patch(profile._id, updates);
    return { success: true };
  },
});
