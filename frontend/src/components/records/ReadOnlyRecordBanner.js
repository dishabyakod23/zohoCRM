export default function ReadOnlyRecordBanner({ show, className = 'mx-6 mt-4' }) {
  if (!show) return null;
  return (
    <div className={`p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-sm ${className}`}>
      You can view this record, but only the owner or an admin can edit it.
    </div>
  );
}
