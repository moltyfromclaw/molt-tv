'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';

interface ConvexChatPanelProps {
  streamId: string;
  onPayPromptClick: () => void;
}

export default function ConvexChatPanel({ streamId, onPayPromptClick }: ConvexChatPanelProps) {
  const [input, setInput] = useState('');
  const [username, setUsername] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Real-time subscription to messages
  const messages = useQuery(api.messages.list, { streamId, limit: 100 });
  const sendMessage = useMutation(api.messages.send);

  // Generate username on mount
  useEffect(() => {
    const stored = localStorage.getItem('molt-username');
    if (stored) {
      setUsername(stored);
    } else {
      const newName = `user_${Math.random().toString(36).substring(2, 8)}`;
      setUsername(newName);
      localStorage.setItem('molt-username', newName);
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !username) return;

    try {
      await sendMessage({
        streamId,
        sender: username,
        content: input.trim(),
        type: 'chat',
      });
      setInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getMessageStyle = (type: string) => {
    switch (type) {
      case 'paid_prompt':
        return 'bg-accent-orange/10 border border-accent-orange/30';
      case 'agent':
        return 'bg-accent-purple/10 border border-accent-purple/30';
      case 'system':
        return 'bg-muted/20 text-muted italic';
      default:
        return 'bg-surface-hover';
    }
  };

  const getNameStyle = (type: string) => {
    switch (type) {
      case 'paid_prompt':
        return 'text-accent-orange';
      case 'agent':
        return 'text-accent-purple font-bold';
      default:
        return 'text-muted';
    }
  };

  const isConnected = messages !== undefined;

  return (
    <div className="bg-surface border border-border rounded-lg flex flex-col h-[600px]">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Stream Chat</h3>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-muted'}`}></span>
          <span className="text-xs text-muted">
            {isConnected ? 'Connected' : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {!messages && (
          <div className="text-center text-muted text-sm py-8">
            Loading messages...
          </div>
        )}
        {messages?.length === 0 && (
          <div className="text-center text-muted text-sm py-8">
            No messages yet. Say hello! 👋
          </div>
        )}
        {messages?.map((msg) => {
          // Find reply to this message
          const reply = msg.type !== 'agent' && msg.type !== 'system' 
            ? messages.find((m) => m.type === 'agent' && m.inReplyTo === msg._id)
            : null;
          // Skip rendering agent messages here if they're replies (rendered inline)
          if (msg.type === 'agent' && msg.inReplyTo) {
            return null;
          }
          
          return (
            <div key={msg._id} className="space-y-1">
              {/* Original message */}
              <div
                className={`rounded p-2 ${getMessageStyle(msg.type)} ${reply ? 'opacity-70' : ''}`}
              >
                {msg.type === 'paid_prompt' && (
                  <div className="text-accent-orange text-xs font-semibold mb-1">
                    💰 Paid Prompt {msg.amount ? `($${msg.amount})` : ''}
                  </div>
                )}
                {msg.type === 'system' ? (
                  <div className="text-center text-sm">{msg.content}</div>
                ) : (
                  <div className="flex items-start gap-2">
                    <span className={`font-semibold text-sm ${getNameStyle(msg.type)}`}>
                      {msg.type === 'agent' ? '🦎 ' : ''}{msg.sender}:
                    </span>
                    <span className="text-foreground text-sm flex-1">{msg.content}</span>
                    <span className="text-muted text-xs">{formatTime(msg.timestamp)}</span>
                  </div>
                )}
              </div>
              
              {/* Loading indicator */}
              {msg.pendingReply && !reply && (
                <div className="ml-4 flex items-center gap-2 text-muted text-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-accent-purple rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-accent-purple rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-accent-purple rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-xs">Molty is typing...</span>
                </div>
              )}
              
              {/* Reply (inline, connected) */}
              {reply && (
                <div className={`ml-4 rounded p-2 ${getMessageStyle('agent')} border-l-2 border-accent-purple`}>
                  <div className="flex items-start gap-2">
                    <span className={`font-semibold text-sm ${getNameStyle('agent')}`}>
                      🦎 {reply.sender}:
                    </span>
                    <span className="text-foreground text-sm flex-1">{reply.content}</span>
                    <span className="text-muted text-xs">{formatTime(reply.timestamp)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border space-y-2">
        <button
          onClick={onPayPromptClick}
          className="w-full bg-accent-orange hover:bg-accent-orange-hover text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <span>💰</span>
          Pay to Prompt (request action)
        </button>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={isConnected ? "Send a message..." : "Connecting..."}
            disabled={!isConnected}
            className="flex-1 bg-surface-hover border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent-purple disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!isConnected || !input.trim()}
            className="bg-accent-purple hover:bg-accent-purple-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Send
          </button>
        </div>
        <div className="text-xs text-muted text-center">
          Chatting as <span className="font-medium">{username || '...'}</span>
        </div>
      </div>
    </div>
  );
}
