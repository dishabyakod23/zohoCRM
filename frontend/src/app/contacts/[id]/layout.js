/**
 * Static-export placeholder so nginx can serve this HTML shell for any real id.
 * Client pages resolve the real id via useRecordId() (useParams returns "_" for the static shell).
 */
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function DynamicIdLayout({ children }) {
  return children;
}
