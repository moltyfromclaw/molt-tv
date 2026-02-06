import StreamPageClient from './StreamPageClient';

export const dynamic = 'force-dynamic';

export default function StreamPage({ params }: { params: Promise<{ id: string }> }) {
  return <StreamPageClient params={params} />;
}
