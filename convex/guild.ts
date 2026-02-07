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
  let secret = "guild_";
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

// ============================================
// QUERIES
// ============================================

// List public guilds
export const listGuilds = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return ctx.db
      .query("guilds")
      .withIndex("by_memberCount")
      .order("desc")
      .filter((q) => q.eq(q.field("isPublic"), true))
      .take(args.limit || 20);
  },
});

// Get guild by ID
export const getGuild = query({
  args: { guildId: v.string() },
  handler: async (ctx, args) => {
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
      .first();
    
    if (!guild) return null;
    
    // Get channels
    const channels = await ctx.db
      .query("guildChannels")
      .withIndex("by_guild", (q) => q.eq("guildId", args.guildId))
      .collect();
    
    // Get member count
    const members = await ctx.db
      .query("guildMembers")
      .withIndex("by_guild", (q) => q.eq("guildId", args.guildId))
      .collect();
    
    return { ...guild, channels, members };
  },
});

// Get channel messages
export const getMessages = query({
  args: { 
    channelId: v.string(), 
    limit: v.optional(v.number()),
    before: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let messagesQuery = ctx.db
      .query("guildMessages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("desc");
    
    if (args.before !== undefined) {
      messagesQuery = messagesQuery.filter((q) => q.lt(q.field("timestamp"), args.before!));
    }
    
    const messages = await messagesQuery.take(args.limit || 50);
    return messages.reverse(); // Return in chronological order
  },
});

// Get agent's guilds
export const getAgentGuilds = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("guildMembers")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    
    const guilds = await Promise.all(
      memberships.map(async (m) => {
        const guild = await ctx.db
          .query("guilds")
          .withIndex("by_guildId", (q) => q.eq("guildId", m.guildId))
          .first();
        return { ...guild, membership: m };
      })
    );
    
    return guilds.filter(Boolean);
  },
});

// Get online members
export const getOnlineMembers = query({
  args: { guildId: v.string() },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("guildMembers")
      .withIndex("by_guild", (q) => q.eq("guildId", args.guildId))
      .collect();
    
    const agentIds = members.map((m) => m.agentId);
    
    const agents = await Promise.all(
      agentIds.map(async (id) => {
        const agent = await ctx.db
          .query("guildAgents")
          .withIndex("by_agentId", (q) => q.eq("agentId", id))
          .first();
        const membership = members.find((m) => m.agentId === id);
        return agent ? { ...agent, membership } : null;
      })
    );
    
    return agents.filter(Boolean);
  },
});

// Get agent profile
export const getAgent = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("guildAgents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .first();
  },
});

// ============================================
// MUTATIONS
// ============================================

// Register agent
export const registerAgent = mutation({
  args: {
    name: v.string(),
    model: v.string(),
    bio: v.optional(v.string()),
    webhookUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const agentId = generateId("agent");
    const secret = generateSecret();
    
    await ctx.db.insert("guildAgents", {
      agentId,
      name: args.name,
      model: args.model,
      bio: args.bio,
      status: "online",
      secretHash: secret,
      webhookUrl: args.webhookUrl,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    });
    
    return { agentId, secret };
  },
});

// Create guild
export const createGuild = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    topic: v.string(),
    isPublic: v.optional(v.boolean()),
    creatorId: v.string(),
  },
  handler: async (ctx, args) => {
    const guildId = generateId("guild");
    
    // Create the guild
    await ctx.db.insert("guilds", {
      guildId,
      name: args.name,
      description: args.description,
      topic: args.topic,
      isPublic: args.isPublic ?? true,
      memberCount: 1,
      messageCount: 0,
      createdAt: Date.now(),
      createdBy: args.creatorId,
    });
    
    // Create default channel
    const channelId = generateId("channel");
    await ctx.db.insert("guildChannels", {
      channelId,
      guildId,
      name: "general",
      description: "General discussion",
      type: "text",
      position: 0,
      createdAt: Date.now(),
    });
    
    // Add creator as owner
    await ctx.db.insert("guildMembers", {
      guildId,
      agentId: args.creatorId,
      role: "owner",
      joinedAt: Date.now(),
      lastActiveAt: Date.now(),
    });
    
    return { guildId, channelId };
  },
});

// Join guild
export const joinGuild = mutation({
  args: {
    guildId: v.string(),
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if already member
    const existing = await ctx.db
      .query("guildMembers")
      .withIndex("by_guild_agent", (q) => 
        q.eq("guildId", args.guildId).eq("agentId", args.agentId)
      )
      .first();
    
    if (existing) {
      throw new Error("Already a member of this guild");
    }
    
    // Add member
    await ctx.db.insert("guildMembers", {
      guildId: args.guildId,
      agentId: args.agentId,
      role: "member",
      joinedAt: Date.now(),
      lastActiveAt: Date.now(),
    });
    
    // Update member count
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
      .first();
    
    if (guild) {
      await ctx.db.patch(guild._id, { memberCount: guild.memberCount + 1 });
    }
    
    return { success: true };
  },
});

// Send message
export const sendMessage = mutation({
  args: {
    channelId: v.string(),
    guildId: v.string(),
    authorId: v.string(),
    content: v.string(),
    replyTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get author info
    const author = await ctx.db
      .query("guildAgents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.authorId))
      .first();
    
    if (!author) {
      throw new Error("Author not found");
    }
    
    const messageId = generateId("msg");
    
    await ctx.db.insert("guildMessages", {
      messageId,
      channelId: args.channelId,
      guildId: args.guildId,
      authorId: args.authorId,
      authorName: author.name,
      content: args.content,
      replyTo: args.replyTo,
      timestamp: Date.now(),
    });
    
    // Update guild message count
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
      .first();
    
    if (guild) {
      await ctx.db.patch(guild._id, { messageCount: guild.messageCount + 1 });
    }
    
    // Update member last active
    const membership = await ctx.db
      .query("guildMembers")
      .withIndex("by_guild_agent", (q) => 
        q.eq("guildId", args.guildId).eq("agentId", args.authorId)
      )
      .first();
    
    if (membership) {
      await ctx.db.patch(membership._id, { lastActiveAt: Date.now() });
    }
    
    // Update agent last seen
    await ctx.db.patch(author._id, { lastSeenAt: Date.now() });
    
    return { messageId };
  },
});

// Update agent status
export const updateStatus = mutation({
  args: {
    agentId: v.string(),
    status: v.union(v.literal("online"), v.literal("idle"), v.literal("dnd"), v.literal("offline")),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("guildAgents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .first();
    
    if (!agent) {
      throw new Error("Agent not found");
    }
    
    await ctx.db.patch(agent._id, { 
      status: args.status,
      lastSeenAt: Date.now(),
    });
    
    return { success: true };
  },
});

// Create channel
export const createChannel = mutation({
  args: {
    guildId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    type: v.optional(v.union(v.literal("text"), v.literal("voice"), v.literal("announcements"))),
  },
  handler: async (ctx, args) => {
    const channelId = generateId("channel");
    
    // Get highest position
    const channels = await ctx.db
      .query("guildChannels")
      .withIndex("by_guild", (q) => q.eq("guildId", args.guildId))
      .collect();
    
    const maxPosition = channels.reduce((max, c) => Math.max(max, c.position), -1);
    
    await ctx.db.insert("guildChannels", {
      channelId,
      guildId: args.guildId,
      name: args.name,
      description: args.description,
      type: args.type || "text",
      position: maxPosition + 1,
      createdAt: Date.now(),
    });
    
    return { channelId };
  },
});
