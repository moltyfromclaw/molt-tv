// Simple activity log viewer - run with: bun run server.ts
import { watch } from "fs";
import { readFile } from "fs/promises";

const LOG_FILE = process.env.LOG_FILE || "/tmp/molty-activity.log";
const PORT = 3456;

// Store connected clients for SSE
const clients = new Set<ReadableStreamDefaultController>();

// Watch log file for changes
watch(LOG_FILE, async () => {
  try {
    const content = await readFile(LOG_FILE, "utf-8");
    const lines = content.trim().split("\n").slice(-100); // Last 100 lines
    const data = `data: ${JSON.stringify(lines)}\n\n`;
    clients.forEach((client) => {
      try {
        client.enqueue(new TextEncoder().encode(data));
      } catch {}
    });
  } catch {}
});

const HTML = `<!DOCTYPE html>
<html>
<head>
  <title>🦞 Molty Activity</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a0f;
      color: #e0e0e0;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      padding: 20px;
      min-height: 100vh;
    }
    h1 {
      color: #a855f7;
      margin-bottom: 20px;
      font-size: 24px;
    }
    .status {
      display: inline-block;
      width: 10px;
      height: 10px;
      background: #22c55e;
      border-radius: 50%;
      margin-right: 10px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    #log {
      background: #111118;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 16px;
      height: calc(100vh - 100px);
      overflow-y: auto;
      font-size: 14px;
      line-height: 1.6;
    }
    .line {
      padding: 4px 0;
      border-bottom: 1px solid #1a1a24;
    }
    .line:last-child { border-bottom: none; }
    .time { color: #666; margin-right: 12px; }
    .action { color: #f59e0b; }
    .file { color: #22d3ee; }
    .command { color: #a855f7; }
    .success { color: #22c55e; }
    .error { color: #ef4444; }
    .output { color: #888; font-style: italic; }
  </style>
</head>
<body>
  <h1><span class="status"></span>Molty Activity</h1>
  <div id="log"></div>
  <script>
    const log = document.getElementById('log');
    const evtSource = new EventSource('/events');
    
    function formatLine(line) {
      // Parse and colorize different types of entries
      let html = line;
      
      // Time prefix
      html = html.replace(/^\\[(\\d{2}:\\d{2}:\\d{2})\\]/, '<span class="time">[$1]</span>');
      
      // Actions
      html = html.replace(/(WRITE|READ|EDIT|EXEC|RUN):/g, '<span class="action">$1:</span>');
      html = html.replace(/(SUCCESS|DONE|OK)/g, '<span class="success">$1</span>');
      html = html.replace(/(ERROR|FAIL)/g, '<span class="error">$1</span>');
      
      // Files
      html = html.replace(/(\\/[\\w\\/.-]+\\.[\\w]+)/g, '<span class="file">$1</span>');
      
      // Commands
      html = html.replace(/\\$ (.+)$/g, '<span class="command">$ $1</span>');
      
      return '<div class="line">' + html + '</div>';
    }
    
    evtSource.onmessage = (event) => {
      const lines = JSON.parse(event.data);
      log.innerHTML = lines.map(formatLine).join('');
      log.scrollTop = log.scrollHeight;
    };
  </script>
</body>
</html>`;

Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    
    if (url.pathname === "/events") {
      const stream = new ReadableStream({
        start(controller) {
          clients.add(controller);
          req.signal.addEventListener("abort", () => clients.delete(controller));
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }
    
    return new Response(HTML, {
      headers: { "Content-Type": "text/html" },
    });
  },
});

console.log(\`🦞 Activity viewer running at http://localhost:\${PORT}\`);
console.log(\`📄 Watching: \${LOG_FILE}\`);
