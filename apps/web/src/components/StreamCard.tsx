'use client';

import { Stream } from '@/lib/api';
import Link from 'next/link';

interface StreamCardProps {
  stream: Stream;
}

export default function StreamCard({ stream }: StreamCardProps) {
  return (
    <Link href={`/stream/${stream.id}`}>
      <div className="bg-surface rounded-lg overflow-hidden border border-border hover:border-accent-purple transition-all hover:scale-[1.02] cursor-pointer group">
        {/* Thumbnail */}
        <div className="aspect-video bg-surface-hover relative overflow-hidden">
          {stream.thumbnailUrl ? (
            <img
              src={stream.thumbnailUrl}
              alt={stream.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent-purple/20 to-accent-orange/20">
              <span className="text-6xl">🤖</span>
            </div>
          )}
          
          {/* Live/Offline badge */}
          {stream.isLive ? (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-600 text-white text-xs font-semibold px-2 py-0.5 rounded">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              LIVE
            </div>
          ) : (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-gray-600 text-white text-xs font-semibold px-2 py-0.5 rounded">
              OFFLINE
            </div>
          )}
          
          {/* Viewer count */}
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            {stream.viewerCount.toLocaleString()}
          </div>
        </div>
        
        {/* Info */}
        <div className="p-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-accent-purple flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {stream.agentName.charAt(0)}
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-foreground truncate group-hover:text-accent-purple transition-colors">
                {stream.title}
              </h3>
              <p className="text-muted text-sm truncate">{stream.agentName}</p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
