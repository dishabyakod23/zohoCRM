/**
 * Static-export placeholder so nginx can serve this HTML shell for any real id.
 */
export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function DynamicIdLayout({ children }) {
  return children;
}
