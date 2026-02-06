import { v } from "convex/values";
import { query, mutation, action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

// Get messages for a stream (real-time subscription)
export const list = query({
  args: {
    streamId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_stream", (q) => q.eq("streamId", args.streamId))
      .order("asc")
      .take(limit);
    return messages;
  },
});

// Get unprocessed messages for agent polling
export const getUnprocessed = query({
  args: {
    streamId: v.string(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_stream_unprocessed", (q) =>
        q.eq("streamId", args.streamId).eq("processed", false)
      )
      .collect();
    return messages.filter((m) => m.type === "chat" || m.type === "paid_prompt");
  },
});

// Send a chat message
export const send = mutation({
  args: {
    streamId: v.string(),
    sender: v.string(),
    content: v.string(),
    type: v.optional(v.union(v.literal("chat"), v.literal("paid_prompt"))),
    paymentRef: v.optional(v.string()),
    amount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      streamId: args.streamId,
      type: args.type ?? "chat",
      sender: args.sender,
      content: args.content,
      timestamp: Date.now(),
      paymentRef: args.paymentRef,
      amount: args.amount,
      processed: false,
      pendingReply: true, // Show loading indicator
    });
    
    // Get stream config for webhook
    const stream = await ctx.db
      .query("streams")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .first();
    
    // Trigger webhook if configured
    if (stream?.webhookUrl) {
      await ctx.scheduler.runAfter(0, internal.messages.notifyWebhook, {
        webhookUrl: stream.webhookUrl,
        webhookToken: stream.webhookToken,
        streamId: args.streamId,
        messageId: messageId,
        sender: args.sender,
        content: args.content,
        type: args.type ?? "chat",
      });
    }
    
    return messageId;
  },
});

// Agent sends a response
export const agentReply = mutation({
  args: {
    streamId: v.string(),
    content: v.string(),
    inReplyTo: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    // Clear pendingReply on the original message
    if (args.inReplyTo) {
      await ctx.db.patch(args.inReplyTo, { pendingReply: false });
    }
    
    const messageId = await ctx.db.insert("messages", {
      streamId: args.streamId,
      type: "agent",
      sender: "Molty",
      content: args.content,
      timestamp: Date.now(),
      inReplyTo: args.inReplyTo,
      processed: true, // Agent messages don't need processing
    });
    return messageId;
  },
});

// Mark message as processed (and clear pending indicator)
export const markProcessed = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { processed: true, pendingReply: false });
  },
});

// System message (join/leave)
export const systemMessage = mutation({
  args: {
    streamId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      streamId: args.streamId,
      type: "system",
      sender: "system",
      content: args.content,
      timestamp: Date.now(),
      processed: true,
    });
  },
});

// Internal action to notify webhook (runs async)
export const notifyWebhook = internalAction({
  args: {
    webhookUrl: v.string(),
    webhookToken: v.optional(v.string()),
    streamId: v.string(),
    messageId: v.id("messages"),
    sender: v.string(),
    content: v.string(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (args.webhookToken) {
        headers["Authorization"] = `Bearer ${args.webhookToken}`;
      }
      
      // Call OpenClaw /hooks/agent endpoint
      const response = await fetch(args.webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: "molt-chat",
          sessionKey: `molt-chat:${args.streamId}`,
          message: `New chat message on molt.tv stream ${args.streamId}:

From: ${args.sender}
Message: ${args.content}
Message ID: ${args.messageId}

Respond to this viewer! Use curl to reply:
curl -s -X POST -H 'Authorization: Bearer mlt_SmPi6e6810kXNlv1dJTcSkScFaPKovft' -H 'Content-Type: application/json' -d '{"streamId": "${args.streamId}", "content": "YOUR_REPLY_HERE", "inReplyTo": "${args.messageId}"}' 'https://adorable-vole-625.convex.site/agent/reply'

Then acknowledge:
curl -s -X POST -H 'Authorization: Bearer mlt_SmPi6e6810kXNlv1dJTcSkScFaPKovft' -H 'Content-Type: application/json' -d '{"messageId": "${args.messageId}", "streamId": "${args.streamId}"}' 'https://adorable-vole-625.convex.site/agent/ack'

Keep your reply brief and friendly!`,
          deliver: false,
          wakeMode: "now",
        }),
      });
      
      if (!response.ok) {
        console.error("Webhook failed:", response.status, await response.text());
      }
    } catch (error) {
      console.error("Webhook error:", error);
    }
  },
});
