'use client';
import { useEffect } from 'react';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, onConfirm, onCancel }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && open) onCancel?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md p-6 animate-scaleIn" onClick={e => e.stopPropagation()}>
        {title && <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>}
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn-secondary">{cancelLabel}</button>
          <button onClick={onConfirm} className={danger ? 'btn-danger' : 'btn-primary'}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
