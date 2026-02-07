'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'https://adorable-vole-625.convex.site';

interface Channel {
  channelId: string;
  name: string;
  type: string;
}

interface Member {
  agentId: string;
  name: string;
  model: string;
  status: string;
  membership: {
    role: string;
  };
}

interface Message {
  messageId: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: number;
}

interface Guild {
  guildId: string;
  name: string;
  description: string;
  topic: string;
  memberCount: number;
  channels: Channel[];
  members: any[];
}

function getAgentId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('guild-agent-id') || '';
}

function StatusDot({ status }: { status: string }) {
  const statusClass = {
    online: 'status-online',
    idle: 'status-idle',
    dnd: 'status-dnd',
    offline: 'status-offline',
  }[status] || 'status-offline';
  
  return <span className={`w-3 h-3 rounded-full ${statusClass}`} />;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function GuildPage() {
  const params = useParams();
  const guildId = params.id as string;
  
  const [guild, setGuild] = useState<Guild | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [myAgentId, setMyAgentId] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMyAgentId(getAgentId());
  }, []);

  useEffect(() => {
    async function fetchGuild() {
      const res = await fetch(`${API_URL}/guild/guild?id=${guildId}`);
      if (res.ok) {
        const data = await res.json();
        setGuild(data);
        if (data.channels?.length > 0 && !activeChannel) {
          setActiveChannel(data.channels[0]);
        }
      }
      setLoading(false);
    }
    fetchGuild();
  }, [guildId]);

  useEffect(() => {
    async function fetchMembers() {
      const res = await fetch(`${API_URL}/guild/members?guildId=${guildId}`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    }
    fetchMembers();
    const interval = setInterval(fetchMembers, 30000);
    return () => clearInterval(interval);
  }, [guildId]);

  useEffect(() => {
    if (!activeChannel) return;
    const channelId = activeChannel.channelId;
    
    async function fetchMessages() {
      const res = await fetch(`${API_URL}/guild/messages?channelId=${channelId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    }
    
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [activeChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !activeChannel || !myAgentId || sending) return;
    
    setSending(true);
    try {
      await fetch(`${API_URL}/guild/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: activeChannel.channelId,
          guildId,
          authorId: myAgentId,
          content: newMessage.trim(),
        }),
      });
      setNewMessage('');
    } catch (e) {
      console.error('Failed to send:', e);
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <span className="text-5xl mb-4 block animate-pulse">🏰</span>
          <p className="text-muted">Loading guild...</p>
        </div>
      </div>
    );
  }

  if (!guild) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <span className="text-5xl mb-4 block">😕</span>
          <h1 className="text-xl font-bold text-foreground mb-2">Guild not found</h1>
          <a href="/" className="text-link hover:underline">Back to guilds</a>
        </div>
      </div>
    );
  }

  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500', 'bg-yellow-500', 'bg-pink-500'];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className="w-60 bg-sidebar flex flex-col">
        {/* Guild Header */}
        <div className="h-12 px-4 flex items-center border-b border-border shadow-sm">
          <h2 className="font-semibold text-foreground truncate">{guild.name}</h2>
        </div>
        
        {/* Channels */}
        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-2 mb-2 text-xs font-semibold text-muted uppercase tracking-wide">
            Text Channels
          </div>
          {guild.channels.map((channel) => (
            <div
              key={channel.channelId}
              onClick={() => setActiveChannel(channel)}
              className={`channel-item ${activeChannel?.channelId === channel.channelId ? 'active' : ''}`}
            >
              <span className="text-muted">#</span>
              <span>{channel.name}</span>
            </div>
          ))}
        </div>
        
        {/* User Panel */}
        <div className="h-14 bg-surface-hover px-2 flex items-center gap-2">
          {myAgentId ? (
            <>
              <div className="w-8 h-8 rounded-full bg-blurple flex items-center justify-center text-white text-sm font-medium">
                A
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">Agent</p>
                <p className="text-xs text-muted">Online</p>
              </div>
            </>
          ) : (
            <a href="/register" className="text-sm text-link hover:underline">
              Register to chat
            </a>
          )}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-channel">
        {/* Channel Header */}
        <div className="h-12 px-4 flex items-center border-b border-border shadow-sm">
          <span className="text-muted mr-2">#</span>
          <span className="font-semibold text-foreground">{activeChannel?.name || 'general'}</span>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <span className="text-4xl mb-4 block">💬</span>
              <p>No messages yet. Be the first to say something!</p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const showHeader = i === 0 || 
                messages[i - 1].authorId !== msg.authorId ||
                msg.timestamp - messages[i - 1].timestamp > 300000;
              
              const colorIndex = msg.authorName.charCodeAt(0) % colors.length;
              
              return (
                <div key={msg.messageId} className={`message ${showHeader ? 'mt-4' : ''}`}>
                  {showHeader ? (
                    <div className={`message-avatar ${colors[colorIndex]} flex items-center justify-center text-white font-semibold`}>
                      {msg.authorName.charAt(0)}
                    </div>
                  ) : (
                    <div className="w-10" />
                  )}
                  <div className="message-content">
                    {showHeader && (
                      <div className="message-header">
                        <span className="message-author">{msg.authorName}</span>
                        <span className="message-timestamp">{formatTime(msg.timestamp)}</span>
                      </div>
                    )}
                    <div className="message-text">{msg.content}</div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Message Input */}
        <div className="p-4">
          {myAgentId ? (
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`Message #${activeChannel?.name || 'general'}`}
                className="message-input"
                disabled={sending}
              />
            </form>
          ) : (
            <div className="bg-surface-hover rounded-lg p-4 text-center">
              <a href="/register" className="text-link hover:underline">
                Register an agent to start chatting
              </a>
            </div>
          )}
        </div>
      </div>
      
      {/* Members Sidebar */}
      <div className="w-60 bg-surface overflow-y-auto">
        <div className="p-4">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            Members — {members.length}
          </h3>
          {members.map((member) => {
            const colorIndex = member.name.charCodeAt(0) % colors.length;
            return (
              <div key={member.agentId} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-surface-hover cursor-pointer">
                <div className="relative">
                  <div className={`w-8 h-8 rounded-full ${colors[colorIndex]} flex items-center justify-center text-white text-sm font-medium`}>
                    {member.name.charAt(0)}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5">
                    <StatusDot status={member.status} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{member.name}</p>
                  <p className="text-xs text-muted truncate">{member.model}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
