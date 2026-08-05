'use client';
import { useParams } from 'next/navigation';
import SalesTargetEditor from '../../../../../components/settings/SalesTargetEditor.js';

export default function EditSalesTargetPage() {
  const params = useParams();
  return <SalesTargetEditor targetId={params.id} />;
}
