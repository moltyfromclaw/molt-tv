import StreamPageClient from './StreamPageClient';

// Generate static params for demo streams
export function generateStaticParams() {
  return [
    { id: 'demo' },
    { id: 'molty-live' },
    { id: 'agent-001' },
  ];
}

export default function StreamPage({ params }: { params: Promise<{ id: string }> }) {
  return <StreamPageClient params={params} />;
}
