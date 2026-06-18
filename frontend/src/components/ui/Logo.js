/** Brand logo — transparent red ring mark */
export default function Logo({ size = 'md', showText = false, textClassName = '', className = '' }) {
  const px = { sm: 32, md: 40, lg: 56, xl: 80 }[size] || 40;

  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${textClassName} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="CRM"
        width={px}
        height={px}
        className="shrink-0 object-contain bg-transparent"
        decoding="async"
      />
      {showText && (
        <div className="min-w-0">
          <span className="font-bold text-sm block truncate tracking-tight">CRM</span>
        </div>
      )}
    </div>
  );
}
