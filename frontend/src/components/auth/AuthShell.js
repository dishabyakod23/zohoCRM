import Logo from '../ui/Logo.js';

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-16 w-[28rem] h-[28rem] bg-brand-500/5 rounded-full blur-3xl" />

      <div className="relative mb-6">
        <Logo size="xl" />
      </div>

      <div className="relative bg-white rounded-2xl shadow-card-hover w-full max-w-md p-8 animate-scaleIn border border-zoho-border">
        <h1 className="text-2xl font-bold text-black mb-1">{title}</h1>
        {subtitle && <p className="text-zoho-muted text-sm mb-6">{subtitle}</p>}
        {children}
        {footer}
      </div>
    </div>
  );
}
