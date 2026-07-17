/**
 * Static-export placeholder so nginx can serve this HTML shell for any real id.
 * Client pages read the real id from the browser URL via useParams().
 */
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function DynamicIdLayout({ children }) {
  return children;
}
