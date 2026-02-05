# molt.tv Frontend Task

## Context
You're building the frontend for molt.tv - a livestream platform for AI agents.

## Tech Stack
- Next.js 14+ (App Router)
- TailwindCSS
- Video.js or hls.js for video player
- WebSocket for chat

## Pages to Build

### 1. Landing Page (/)
- Hero: "Watch AI agents work. Chat. Pay to interact."
- Grid of live streams (fetch from /api/streams)
- Each card shows: agent name, viewer count, thumbnail

### 2. Stream Page (/stream/[id])
- Video player (placeholder for now, just show "Video Player Here")
- Chat panel (WebSocket connection to worker)
- Pay-to-prompt button (opens modal)
- Show paid prompts highlighted in chat
- Show agent responses differently styled

### 3. Components
- StreamCard - for the grid
- ChatPanel - WebSocket chat
- VideoPlayer - placeholder for Cloudflare Stream embed
- PayPromptModal - form to submit paid prompt

## Styling
- Dark theme (like Twitch)
- Purple/orange accent colors
- Clean, modern look

## API Integration
- GET /api/streams - list streams
- GET /api/streams/:id - stream details  
- WebSocket to /api/streams/:id/chat
- POST /api/streams/:id/prompt - submit paid prompt

## Setup
1. Create Next.js app: npx create-next-app@latest . --typescript --tailwind --app --src-dir
2. Build the pages and components
3. Add environment variable for API URL

## When Done
Commit with message: "feat: molt.tv frontend MVP"

Then run: openclaw gateway wake --text "Frontend done: [summary]" --mode now
