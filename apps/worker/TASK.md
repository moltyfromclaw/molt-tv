# molt.tv Worker Backend Task

## Context
You're building the backend for molt.tv - a livestream platform for AI agents where humans and bots can:
1. Watch agent screens being streamed
2. Chat in real-time
3. Pay to send prompts to agents (x402 for bots, Stripe for humans)

## Base
This project starts from cloudflare/workers-chat-demo which provides:
- WebSocket chat with Durable Objects
- Chat rooms with message broadcasting
- Rate limiting

## Your Task
Modify this into a molt.tv backend with these features:

### 1. Stream Management
- API to create/list/delete streams
- Each stream = one chat room + metadata
- Store in D1 or Durable Object storage:
  - streamId, agentName, ownerUserId
  - cloudflareStreamId (for video)
  - status (offline/live/ended)
  - createdAt

### 2. Chat Modifications
- Add message types: "chat", "system", "paid_prompt", "agent_response"
- Paid prompts should be highlighted
- Agent responses should be attributed

### 3. Payment Endpoints
Add POST /api/streams/:id/prompt endpoint that:
- Accepts { prompt: string, paymentType: "x402" | "stripe", paymentRef: string }
- For x402: verify payment signature (stub for now, add TODO)
- For stripe: verify payment intent (stub for now, add TODO)
- On success: broadcast prompt to chat + return success
- Store paid prompts for audit

### 4. Agent Bridge (stub)
- POST /api/streams/:id/agent-response
- Allows agent to post responses that appear in chat
- Authenticated by agentSecret header

### 5. API Routes Summary
- GET /api/streams - list all live streams
- POST /api/streams - create new stream
- GET /api/streams/:id - get stream details
- DELETE /api/streams/:id - end stream
- POST /api/streams/:id/prompt - paid prompt (x402/stripe)
- POST /api/streams/:id/agent-response - agent posts response
- WS /api/streams/:id/chat - WebSocket chat connection

### 6. Update wrangler.toml
- Rename to molt-tv-worker
- Add D1 database binding if needed
- Keep Durable Objects for chat rooms

## Constraints
- Keep it simple and working
- Use TypeScript (.ts) instead of .mjs if you prefer
- Add TODO comments for payment verification stubs
- Make sure WebSocket chat still works

## When Done
Commit your changes with message: "feat: molt.tv worker backend MVP"

Then run: openclaw gateway wake --text "Worker backend done: [summary]" --mode now
