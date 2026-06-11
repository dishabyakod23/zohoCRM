'use client';
export default function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-lg animate-scaleIn">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zoho-border">
          <h2 className="font-semibold text-zoho-text">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-zoho-muted hover:text-red-500 hover:bg-red-50 text-xl leading-none transition-colors">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
