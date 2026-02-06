import StreamPageClient from './StreamPageClient';

// Dynamic rendering - streams are fetched from database
export const dynamic = 'force-dynamic';

export default function StreamPage({ params }: { params: Promise<{ id: string }> }) {
  return <StreamPageClient params={params} />;
}
