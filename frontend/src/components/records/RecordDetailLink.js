export default function RecordDetailLink({ href, className, children, ...rest }) {
  const target = href?.includes('?') ? href : (href?.endsWith('/') ? href : `${href}/`);
  // Plain anchors avoid Next.js RSC prefetch/navigation to dynamic static-export routes.
  return <a href={target} className={className} {...rest}>{children}</a>;
}
