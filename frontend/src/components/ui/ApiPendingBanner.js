export default function ApiPendingBanner({ module }) {
  return (
    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
      <strong>{module}</strong> is not yet available on the{' '}
      <a href="https://api-salescrm.duckdns.org/docs" target="_blank" rel="noreferrer" className="text-brand-600 underline">
        Sales CRM API
      </a>
      . This section shows placeholder UI until the endpoint is published.
    </div>
  );
}
