import { appHref } from '../../lib/recordNavigation.js';

export default function RecordDetailLink({ href, className, children, ...rest }) {
  // Plain anchors avoid Next.js RSC prefetch/navigation to dynamic static-export routes.
  return <a href={appHref(href)} className={className} {...rest}>{children}</a>;
}
