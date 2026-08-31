/**
 * Static-export placeholder so nginx/Vercel can serve this HTML shell for any real id.
 * Client pages read the real id from ?id= via useRecordId().
 */
export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function SequenceDetailLayout({ children }) {
  return children;
}
