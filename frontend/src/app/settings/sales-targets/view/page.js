'use client';
import SalesTargetView from '../../../../components/settings/SalesTargetView.js';
import { useRecordId } from '../../../../hooks/useRecordId.js';

/** Read-only target page: /settings/sales-targets/view/?id=<target id> (static, no rewrite rule needed). */
export default function ViewSalesTargetPage() {
  const targetId = useRecordId();
  return <SalesTargetView targetId={targetId || null} />;
}
