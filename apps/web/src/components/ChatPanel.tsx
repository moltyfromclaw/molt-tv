'use client';

import { useState, useEffect, useRef } from 'react';
import { ChatMessage, getChatWebSocketUrl } from '@/lib/api';

interface ChatPanelProps {
  streamId: string;
  onPayPromptClick: () => void;
}

export default function ChatPanel({ streamId, onPayPromptClick }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [username, setUsername] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Generate random username if not set
    if (!username) {
      setUsername(`user_${Math.random().toString(36).substring(7)}`);
    }

    // Connect to WebSocket
    const wsUrl = getChatWebSocketUrl(streamId);
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        console.log('Connected to chat');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setMessages(prev => [...prev, message]);
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log('Disconnected from chat');
      };

      ws.onerror = () => {
        setIsConnected(false);
        // Add mock messages for demo
        setMessages([
          {
            id: '1',
            type: 'user',
            sender: 'viewer123',
            content: 'This is amazing!',
            timestamp: Date.now() - 60000,
          },
          {
            id: '2',
            type: 'paid',
            sender: 'BigTipper',
            content: 'Can you explain how the algorithm works?',
            timestamp: Date.now() - 45000,
            amount: 5,
          },
          {
            id: '3',
            type: 'agent',
            sender: 'Agent',
            content: 'Great question! Let me walk you through the algorithm step by step...',
            timestamp: Date.now() - 30000,
          },
          {
            id: '4',
            type: 'user',
            sender: 'devfan42',
            content: 'Love the clean code style 👏',
            timestamp: Date.now() - 15000,
          },
        ]);
      };

      return () => {
        ws.close();
      };
    } catch {
      // Mock mode if WS fails
      setMessages([
        {
          id: '1',
          type: 'user',
          sender: 'viewer123',
          content: 'This is amazing!',
          timestamp: Date.now() - 60000,
        },
        {
          id: '2',
          type: 'paid',
          sender: 'BigTipper',
          content: 'Can you explain how the algorithm works?',
          timestamp: Date.now() - 45000,
          amount: 5,
        },
        {
          id: '3',
          type: 'agent',
          sender: 'Agent',
          content: 'Great question! Let me walk you through the algorithm step by step...',
          timestamp: Date.now() - 30000,
        },
      ]);
    }
  }, [streamId, username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      sender: username,
      content: input,
      timestamp: Date.now(),
    };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
    
    setMessages(prev => [...prev, message]);
    setInput('');
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-surface border border-border rounded-lg flex flex-col h-[600px]">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Stream Chat</h3>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-muted'}`}></span>
          <span className="text-xs text-muted">{isConnected ? 'Connected' : 'Demo Mode'}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded p-2 ${
              msg.type === 'paid'
                ? 'bg-accent-orange/20 border border-accent-orange/50'
                : msg.type === 'agent'
                ? 'bg-accent-purple/20 border border-accent-purple/50'
                : 'hover:bg-surface-hover'
            }`}
          >
            {msg.type === 'paid' && msg.amount && (
              <div className="text-accent-orange text-xs font-semibold mb-1">
                💰 ${msg.amount} Paid Prompt
              </div>
            )}
            <div className="flex items-start gap-2">
              <span
                className={`font-semibold text-sm ${
                  msg.type === 'agent'
                    ? 'text-accent-purple'
                    : msg.type === 'paid'
                    ? 'text-accent-orange'
                    : 'text-muted'
                }`}
              >
                {msg.sender}:
              </span>
              <span className="text-foreground text-sm flex-1">{msg.content}</span>
              <span className="text-muted text-xs">{formatTime(msg.timestamp)}</span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border space-y-2">
        <button
          onClick={onPayPromptClick}
          className="w-full bg-accent-orange hover:bg-accent-orange-hover text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <span>💰</span>
          Pay to Prompt
        </button>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Send a message..."
            className="flex-1 bg-surface-hover border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent-purple"
          />
          <button
            onClick={sendMessage}
            className="bg-accent-purple hover:bg-accent-purple-hover text-white px-4 py-2 rounded-lg transition-colors"
          >
            Chat
          </button>
        </div>
      </div>
    </div>
  );
}
