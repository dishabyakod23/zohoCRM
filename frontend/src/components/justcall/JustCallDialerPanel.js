'use client';
import { PhoneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useJustCall } from './JustCallProvider.js';

export default function JustCallDialerPanel({ open, onClose }) {
  const { loggedIn, ready, setOpen } = useJustCall();

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Open JustCall dialer"
          className="fixed bottom-16 right-4 z-[45] w-12 h-12 rounded-full bg-brand-gradient text-white shadow-card-hover flex items-center justify-center hover:opacity-90 transition-opacity ring-4 ring-white/80"
          aria-label="Open JustCall dialer"
        >
          <PhoneIcon className="w-5 h-5" />
        </button>
      )}

      <div
        className={`fixed bottom-14 right-4 z-[55] flex flex-col bg-white border border-zoho-border rounded-2xl shadow-card-hover overflow-hidden transition-all duration-200 origin-bottom-right ${
          open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
        }`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zoho-border bg-brand-50/60 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zoho-text">JustCall</h3>
            <p className="text-[10px] text-zoho-muted truncate">
              {ready ? (loggedIn ? 'Ready to call' : 'Log in to place calls') : 'Loading dialer…'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zoho-muted hover:text-red-500 hover:bg-red-50 transition-colors"
            aria-label="Close JustCall dialer"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
        {/* Keep dialer mounted so SDK can initialize even when panel is closed */}
        <div id="justcall-dialer" className="w-[365px] h-[610px] bg-white" />
      </div>
    </>
  );
}
