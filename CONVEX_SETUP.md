# Convex Setup for molt.tv

## 1. Initialize Convex

```bash
cd /Users/m/.openclaw/workspace/molt-tv
npx convex dev
```

This will:
- Open browser for Convex login
- Create a new project (choose a name like "molt-tv")
- Deploy the schema and functions
- Watch for changes

## 2. Configure Environment

After setup, Convex will create `.env.local` with:
```
CONVEX_DEPLOYMENT=dev:your-project-name
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

## 3. Set Agent Secret in Convex

```bash
npx convex env set AGENT_SECRET "dev-secret-change-in-production"
```

## 4. Update Frontend

```bash
cd apps/web
cp ../../.env.local .env.local
npm run dev
```

## 5. Test

Open http://localhost:3000/stream/molty-live

The chat should now use Convex for real-time updates!

## Architecture

```
Frontend ──useQuery──> Convex DB <──HTTP POST── Agent (Molty)
    │                     │
    └──useMutation──────>─┘
```

- Messages are stored in Convex
- Frontend auto-syncs via subscriptions
- Agent polls /agent/poll for new messages
- Agent responds via /agent/reply
