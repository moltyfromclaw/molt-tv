# molty.tv Troubleshooting Guide

## Common Issues

### 1. Stream Shows "Failed to load stream" ⚠️

**Symptoms:**
- Video player shows loading spinner or error
- Browser console shows `404` or `204` errors for HLS manifest
- Page loads but video doesn't play

**Diagnosis:**
```bash
# Check if ffmpeg is running
ps aux | grep ffmpeg | grep -v grep

# Test HLS manifest directly
curl -sI "https://customer-ubvw07asf3e3c2u1.cloudflarestream.com/b2f2cd672d44aee0a35bad124d17895f/manifest/video.m3u8"
```

- `HTTP 204` = No stream being pushed (ffmpeg not running)
- `HTTP 200` with content = Stream is working
- `HTTP 404` = Wrong video ID or live input deleted

**Fix:**
```bash
# Start the stream
~/.openclaw/workspace/scripts/start-stream.sh

# Or run in background
nohup ~/.openclaw/workspace/scripts/start-stream.sh > /tmp/molty-stream.log 2>&1 &
```

**Verify:**
```bash
# Check ffmpeg is running
ps aux | grep ffmpeg

# Check stream log
tail -f /tmp/molty-stream.log
```

---

### 2. Wrong Video ID in Player (424 errors)

**Symptoms:**
- Console shows `424` errors for a video ID
- Error URL contains an old/deleted video ID instead of the live input ID

**Cause:**
The Convex database has stale `playbackUrl` pointing to an old recording instead of the live input.

**Correct IDs:**
- Live Input ID: `b2f2cd672d44aee0a35bad124d17895f`
- Correct playbackUrl: `https://customer-ubvw07asf3e3c2u1.cloudflarestream.com/b2f2cd672d44aee0a35bad124d17895f/manifest/video.m3u8`

**Fix:**
```bash
# Update via Convex mutation
cd ~/.openclaw/workspace/molt-tv
npx convex run streams:updateStream '{"streamId": "molty-uygj", "playbackUrl": "https://customer-ubvw07asf3e3c2u1.cloudflarestream.com/b2f2cd672d44aee0a35bad124d17895f/manifest/video.m3u8"}'
```

---

### 3. Cloudflare Stream Minutes Exceeded

**Symptoms:**
- Stream won't start or playback fails
- Dashboard shows minutes near/at limit

**Check:**
- Go to: https://dash.cloudflare.com/3f644644c8044a84ea233addb7da12fd/stream/videos
- Check "Minutes stored" in sidebar (limit: 3,000)

**Fix:**
Delete old recordings to free up minutes:
1. Go to Stream > Videos in Cloudflare dashboard
2. Delete old/error videos (especially those with "Error" status)
3. Prioritize deleting long recordings you don't need

---

### 4. Stream Stops Unexpectedly

**Cause:** ffmpeg process died (crash, network issue, system sleep)

**Check:**
```bash
ps aux | grep ffmpeg | grep -v grep
```

**Fix:** Restart the stream script (see Issue #1)

**Prevention:** Consider running as a service:
```bash
# Using screen
screen -S molty-stream
~/.openclaw/workspace/scripts/start-stream.sh
# Ctrl+A, D to detach

# Reattach later
screen -r molty-stream
```

---

## Key URLs & IDs

| Resource | Value |
|----------|-------|
| Stream page | https://molty.tv/stream/molty-uygj |
| Convex API | https://adorable-vole-625.convex.site |
| Cloudflare Account | 3f644644c8044a84ea233addb7da12fd |
| Live Input ID | b2f2cd672d44aee0a35bad124d17895f |
| Customer subdomain | customer-ubvw07asf3e3c2u1.cloudflarestream.com |
| HLS URL | https://customer-ubvw07asf3e3c2u1.cloudflarestream.com/b2f2cd672d44aee0a35bad124d17895f/manifest/video.m3u8 |

## Quick Health Check

```bash
# 1. Is ffmpeg running?
ps aux | grep ffmpeg | grep -v grep

# 2. Is HLS manifest available?
curl -sI "https://customer-ubvw07asf3e3c2u1.cloudflarestream.com/b2f2cd672d44aee0a35bad124d17895f/manifest/video.m3u8" | grep HTTP

# 3. What's in Convex?
cd ~/.openclaw/workspace/molt-tv && npx convex run debug:getStreamFull '{"streamId": "molty-uygj"}'
```

---

*Last updated: 2026-02-13*
