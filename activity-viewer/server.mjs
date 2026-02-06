// Simple activity log viewer - run with: node server.mjs
import { createServer } from "http";
import { watch, readFileSync, existsSync, writeFileSync } from "fs";

const LOG_FILE = process.env.LOG_FILE || "/tmp/molty-activity.log";
const PORT = 3456;

// Ensure log file exists
if (!existsSync(LOG_FILE)) {
  writeFileSync(LOG_FILE, `[${new Date().toLocaleTimeString()}] 🦞 Activity log started\n`);
}

// Store connected clients for SSE
const clients = new Set();

// Watch log file for changes
let debounce = null;
watch(LOG_FILE, () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    try {
      const content = readFileSync(LOG_FILE, "utf-8");
      const lines = content.trim().split("\n").slice(-100);
      const data = `data: ${JSON.stringify(lines)}\n\n`;
      clients.forEach((res) => {
        try { res.write(data); } catch {}
      });
    } catch {}
  }, 100);
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
      font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
      padding: 20px;
      min-height: 100vh;
    }
    h1 {
      color: #a855f7;
      margin-bottom: 20px;
      font-size: 24px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .status {
      width: 12px;
      height: 12px;
      background: #22c55e;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.9); }
    }
    #log {
      background: #111118;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 20px;
      height: calc(100vh - 120px);
      overflow-y: auto;
      font-size: 14px;
      line-height: 1.8;
    }
    .line {
      padding: 6px 12px;
      margin: 4px 0;
      border-radius: 6px;
      background: #0d0d14;
      border-left: 3px solid #333;
    }
    .line.write { border-left-color: #22d3ee; }
    .line.exec { border-left-color: #a855f7; }
    .line.success { border-left-color: #22c55e; }
    .line.error { border-left-color: #ef4444; }
    .time { color: #555; margin-right: 12px; font-size: 12px; }
    .emoji { margin-right: 8px; }
    .action { color: #f59e0b; font-weight: 600; }
    .file { color: #22d3ee; }
    .command { color: #c084fc; }
    .success { color: #22c55e; }
    .error { color: #ef4444; }
    .muted { color: #666; }
  </style>
</head>
<body>
  <h1><span class="status"></span> Molty Activity</h1>
  <div id="log"><div class="line muted">Waiting for activity...</div></div>
  <script>
    const log = document.getElementById('log');
    const evtSource = new EventSource('/events');
    
    function getLineClass(line) {
      if (line.includes('WRITE:') || line.includes('EDIT:')) return 'write';
      if (line.includes('EXEC:') || line.includes('RUN:') || line.includes('$')) return 'exec';
      if (line.includes('SUCCESS') || line.includes('✓') || line.includes('Done')) return 'success';
      if (line.includes('ERROR') || line.includes('FAIL')) return 'error';
      return '';
    }
    
    function formatLine(line) {
      let html = line;
      
      // Time prefix
      html = html.replace(/^\\[(\\d{1,2}:\\d{2}(:\\d{2})?(\\s*[AP]M)?)\\]/i, '<span class="time">[$1]</span>');
      
      // Emojis at start
      html = html.replace(/^(<span[^>]*>[^<]*<\\/span>\\s*)(🦞|📄|⚡|✓|❌|🔨|📦|🚀)/g, '$1<span class="emoji">$2</span>');
      
      // Actions
      html = html.replace(/\\b(WRITE|READ|EDIT|EXEC|RUN|BUILD|DEPLOY):/g, '<span class="action">$1:</span>');
      
      // Status
      html = html.replace(/\\b(SUCCESS|DONE|OK|COMPLETE)\\b/gi, '<span class="success">$1</span>');
      html = html.replace(/\\b(ERROR|FAIL|FAILED)\\b/gi, '<span class="error">$1</span>');
      
      // Files
      html = html.replace(/([\\/\\w.-]+\\.(md|ts|tsx|js|json|css|html))/g, '<span class="file">$1</span>');
      
      // Shell commands
      html = html.replace(/\\$ ([^<]+)/g, '<span class="command">$ $1</span>');
      
      return '<div class="line ' + getLineClass(line) + '">' + html + '</div>';
    }
    
    evtSource.onmessage = (event) => {
      const lines = JSON.parse(event.data);
      if (lines.length > 0) {
        log.innerHTML = lines.map(formatLine).join('');
        log.scrollTop = log.scrollHeight;
      }
    };
    
    evtSource.onerror = () => {
      log.innerHTML = '<div class="line error">Connection lost. Reconnecting...</div>';
    };
  </script>
</body>
</html>`;

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  if (url.pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    
    clients.add(res);
    
    // Send initial data
    try {
      const content = readFileSync(LOG_FILE, "utf-8");
      const lines = content.trim().split("\n").slice(-100);
      res.write(`data: ${JSON.stringify(lines)}\n\n`);
    } catch {}
    
    req.on("close", () => clients.delete(res));
    return;
  }
  
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(HTML);
});

server.listen(PORT, () => {
  console.log(`🦞 Activity viewer running at http://localhost:${PORT}`);
  console.log(`📄 Watching: ${LOG_FILE}`);
});
