'use client';
import SalesTargetEditor from '../../../../../components/settings/SalesTargetEditor.js';
import { useRecordId } from '../../../../../hooks/useRecordId.js';

export default function EditSalesTargetPage() {
  const targetId = useRecordId();
  return <SalesTargetEditor targetId={targetId || null} />;
}
