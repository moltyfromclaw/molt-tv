'use client';

import { useState, useEffect, use } from 'react';
import { getStream, Stream } from '@/lib/api';
import VideoPlayer from '@/components/VideoPlayer';
import ConvexChatPanel from '@/components/ConvexChatPanel';
import PayPromptModal from '@/components/PayPromptModal';
import ActivityOverlay from '@/components/ActivityOverlay';
import Link from 'next/link';

interface StreamPageClientProps {
  params: Promise<{ id: string }>;
}

export default function StreamPageClient({ params }: StreamPageClientProps) {
  const resolvedParams = use(params);
  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  useEffect(() => {
    getStream(resolvedParams.id).then((s) => {
      setStream(s);
      setLoading(false);
    });
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-purple"></div>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-6xl mb-4">😕</div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Stream not found</h1>
        <p className="text-muted mb-6">This stream doesn&apos;t exist or has ended.</p>
        <Link
          href="/"
          className="bg-accent-purple hover:bg-accent-purple-hover text-white font-semibold py-2 px-6 rounded-lg transition-colors"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="mb-4">
          <Link href="/" className="text-muted hover:text-foreground transition-colors text-sm flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to streams
          </Link>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Video Section */}
          <div className="lg:col-span-2 space-y-4">
            <VideoPlayer streamId={stream.id} title={stream.title} hlsUrl={stream.hlsUrl} />
            
            {/* Stream Info */}
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-accent-purple flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {stream.agentName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-foreground truncate">{stream.title}</h1>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-accent-purple font-medium">{stream.agentName}</span>
                    <div className="flex items-center gap-2 text-muted text-sm">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      {stream.viewerCount.toLocaleString()} watching
                    </div>
                    {stream.isLive && (
                      <div className="flex items-center gap-1.5 text-red-500 text-sm">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        LIVE
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Feed - What the agent is doing */}
            <ActivityOverlay />
          </div>

          {/* Chat Section */}
          <div className="lg:col-span-1">
            <ConvexChatPanel
              streamId={stream.id}
              onPayPromptClick={() => setIsPayModalOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Pay Prompt Modal */}
      <PayPromptModal
        streamId={stream.id}
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
      />
    </div>
  );
}
