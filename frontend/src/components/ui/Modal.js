'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** Above sidebar (70) and notes panels. */
export const MODAL_Z_INDEX = 400;

export default function Modal({ title, onClose, children, wide = false }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm animate-fadeIn"
      style={{ zIndex: MODAL_Z_INDEX }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-card-hover w-full animate-scaleIn flex flex-col max-h-[min(90vh,100%)] ${wide ? 'max-w-4xl' : 'max-w-xl'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-zoho-border shrink-0 gap-3">
          <h2 id="modal-title" className="text-base font-semibold text-zoho-text truncate min-w-0">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zoho-muted hover:text-zoho-text hover:bg-brand-50 transition-colors text-lg leading-none shrink-0">×</button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
