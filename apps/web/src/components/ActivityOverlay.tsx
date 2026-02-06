'use client';

import { useState, useEffect, useRef } from 'react';

interface ActivityLine {
  text: string;
  type: 'write' | 'exec' | 'success' | 'error' | 'info';
  timestamp: string;
}

interface ActivityOverlayProps {
  activityUrl?: string; // SSE endpoint URL
  embedded?: boolean; // Compact mode for overlay
}

export default function ActivityOverlay({ 
  activityUrl = 'http://localhost:3456/events',
  embedded = false 
}: ActivityOverlayProps) {
  const [lines, setLines] = useState<ActivityLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [expanded, setExpanded] = useState(!embedded);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let retryTimeout: NodeJS.Timeout;

    const connect = () => {
      try {
        eventSource = new EventSource(activityUrl);
        
        eventSource.onopen = () => {
          setConnected(true);
        };

        eventSource.onmessage = (event) => {
          try {
            const rawLines: string[] = JSON.parse(event.data);
            const parsed = rawLines.slice(-50).map(parseLine);
            setLines(parsed);
          } catch (e) {
            console.error('Failed to parse activity data:', e);
          }
        };

        eventSource.onerror = () => {
          setConnected(false);
          eventSource?.close();
          // Retry after 5 seconds
          retryTimeout = setTimeout(connect, 5000);
        };
      } catch (e) {
        setConnected(false);
        retryTimeout = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      eventSource?.close();
      clearTimeout(retryTimeout);
    };
  }, [activityUrl]);

  // Auto-scroll
  useEffect(() => {
    if (containerRef.current && expanded) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, expanded]);

  const parseLine = (text: string): ActivityLine => {
    // Extract timestamp if present
    const timeMatch = text.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]/i);
    const timestamp = timeMatch ? timeMatch[1] : '';
    
    // Determine type
    let type: ActivityLine['type'] = 'info';
    if (/WRITE:|EDIT:|📄/.test(text)) type = 'write';
    else if (/EXEC:|RUN:|\$|⚡/.test(text)) type = 'exec';
    else if (/SUCCESS|✓|Done|✅/.test(text)) type = 'success';
    else if (/ERROR|FAIL|❌/.test(text)) type = 'error';

    return { text, type, timestamp };
  };

  const getTypeStyles = (type: ActivityLine['type']) => {
    switch (type) {
      case 'write': return 'border-l-cyan-400 bg-cyan-500/5';
      case 'exec': return 'border-l-purple-400 bg-purple-500/5';
      case 'success': return 'border-l-green-400 bg-green-500/5';
      case 'error': return 'border-l-red-400 bg-red-500/5';
      default: return 'border-l-gray-500 bg-gray-500/5';
    }
  };

  const formatLine = (line: ActivityLine) => {
    let text = line.text;
    
    // Remove time prefix for cleaner display
    text = text.replace(/^\[\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?\]\s*/i, '');
    
    return text;
  };

  if (embedded && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed bottom-4 right-4 bg-surface border border-border rounded-lg px-4 py-2 flex items-center gap-2 hover:border-accent-purple transition-colors z-50 shadow-lg"
      >
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-500'}`}></span>
        <span className="text-sm font-medium">🦞 Activity</span>
        <span className="text-xs text-muted">{lines.length} events</span>
      </button>
    );
  }

  return (
    <div className={`bg-surface border border-border rounded-lg overflow-hidden ${embedded ? 'fixed bottom-4 right-4 w-96 z-50 shadow-xl' : 'w-full'}`}>
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between bg-surface-hover">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
          <span className="font-semibold text-foreground text-sm">🦞 Agent Activity</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">{lines.length} events</span>
          {embedded && (
            <button 
              onClick={() => setExpanded(false)}
              className="text-muted hover:text-foreground p-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Activity Log */}
      <div 
        ref={containerRef}
        className={`overflow-y-auto font-mono text-xs ${embedded ? 'h-64' : 'h-80'}`}
      >
        {!connected && lines.length === 0 && (
          <div className="p-4 text-center text-muted">
            <div className="mb-2">🔌</div>
            <div>Connecting to activity feed...</div>
            <div className="text-xs mt-1">Ensure activity server is running</div>
          </div>
        )}
        {lines.map((line, i) => (
          <div 
            key={i}
            className={`px-3 py-1.5 border-l-2 ${getTypeStyles(line.type)} hover:bg-surface-hover transition-colors`}
          >
            {line.timestamp && (
              <span className="text-muted mr-2">[{line.timestamp}]</span>
            )}
            <span className="text-foreground">{formatLine(line)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
