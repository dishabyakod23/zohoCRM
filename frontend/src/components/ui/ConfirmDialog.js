'use client';
import { useEffect, useState } from 'react';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  confirming = false,
  onConfirm,
  onCancel,
}) {
  const [busy, setBusy] = useState(false);
  const inFlight = confirming || busy;

  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && open && !inFlight) onCancel?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel, inFlight]);

  if (!open) return null;

  const handleConfirm = async () => {
    if (inFlight || !onConfirm) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={inFlight ? undefined : onCancel}>
      <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md p-6 animate-scaleIn" onClick={e => e.stopPropagation()}>
        {title && <h3 className="font-semibold text-zoho-text mb-2">{title}</h3>}
        <p className="text-sm text-zoho-muted mb-6">{message}</p>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} disabled={inFlight} className="btn-secondary disabled:opacity-50">{cancelLabel}</button>
          <button type="button" onClick={handleConfirm} disabled={inFlight} className={`${danger ? 'btn-danger' : 'btn-primary'} disabled:opacity-50`}>
            {inFlight ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
