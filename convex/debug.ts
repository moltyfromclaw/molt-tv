import { query } from "./_generated/server";
import { v } from "convex/values";

// Debug: get full stream record (including webhook fields)
export const getStreamFull = query({
  args: { streamId: v.string() },
  handler: async (ctx, args) => {
    const stream = await ctx.db
      .query("streams")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .first();
    
    if (!stream) return null;
    
    // Return everything except the secret hash
    const { agentSecretHash, ...rest } = stream;
    return rest;
  },
});
