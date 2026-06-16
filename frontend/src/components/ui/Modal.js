'use client';
import { useEffect } from 'react';

export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
    >
      <div className="bg-white rounded-xl shadow-card-hover w-full max-w-xl animate-scaleIn" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zoho-border">
          <h2 id="modal-title" className="text-base font-semibold text-zoho-text">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zoho-muted hover:text-zoho-text hover:bg-brand-50 transition-colors text-lg leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
