export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-brand-gradient flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-16 w-[28rem] h-[28rem] bg-white/10 rounded-full blur-3xl" />

      <div className="relative bg-white/95 backdrop-blur rounded-2xl shadow-card-hover w-full max-w-md p-8 animate-scaleIn">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 bg-brand-gradient rounded-xl flex items-center justify-center text-white font-bold shadow-glow">C</div>
          <span className="text-xl font-bold text-gray-900">CRM</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{title}</h1>
        {subtitle && <p className="text-gray-500 text-sm mb-6">{subtitle}</p>}
        {children}
        {footer}
      </div>
    </div>
  );
}
