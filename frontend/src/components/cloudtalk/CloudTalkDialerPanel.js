'use client';
import { ClipboardDocumentIcon, PhoneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useCallback } from 'react';
import { useCloudTalk } from './CloudTalkProvider.js';
import { useToast } from '../ui/Toast.js';

/** CloudTalk requires min 420×700; we scale the iframe so the panel fits the viewport. */
const IFRAME_W = 420;
const IFRAME_H = 700;
const SCALE = 0.68;

export default function CloudTalkDialerPanel({ open, iframeMounted, onClose }) {
  const {
    ready,
    loggedIn,
    iframeRef,
    onIframeLoad,
    setOpen,
    iframeSrc,
    pendingDialNumber,
  } = useCloudTalk();
  const { showToast } = useToast();
  const panelW = Math.round(IFRAME_W * SCALE);
  const panelH = Math.round(IFRAME_H * SCALE);

  const copyDialNumber = useCallback(async () => {
    if (!pendingDialNumber || typeof navigator === 'undefined') return;
    try {
      await navigator.clipboard.writeText(pendingDialNumber);
      showToast('Number copied — paste into CloudTalk dialer (Ctrl+V)');
    } catch {
      showToast('Copy failed — select the number and copy manually');
    }
  }, [pendingDialNumber, showToast]);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Open CloudTalk dialer"
          className="fixed bottom-16 right-4 z-[45] w-12 h-12 rounded-full bg-brand-gradient text-white shadow-card-hover flex items-center justify-center hover:opacity-90 transition-opacity ring-4 ring-white/80"
          aria-label="Open CloudTalk dialer"
        >
          <PhoneIcon className="w-5 h-5" />
        </button>
      )}

      <div
        className={`fixed bottom-14 right-4 z-[55] flex flex-col bg-white border border-zoho-border rounded-2xl shadow-card-hover overflow-hidden transition-all duration-200 origin-bottom-right max-h-[calc(100vh-4.5rem)] ${
          open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
        }`}
        style={{ width: panelW }}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-zoho-border bg-brand-50/60 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zoho-text">CloudTalk</h3>
            <p className="text-[10px] text-zoho-muted truncate">
              {ready
                ? (loggedIn ? 'Ready to call' : 'Log in to place calls')
                : 'Loading dialer…'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zoho-muted hover:text-red-500 hover:bg-red-50 transition-colors"
            aria-label="Close CloudTalk dialer"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {pendingDialNumber ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-zoho-border bg-white shrink-0">
            <input
              type="text"
              readOnly
              value={pendingDialNumber}
              onFocus={(e) => e.target.select()}
              className="flex-1 min-w-0 text-xs font-mono text-zoho-text bg-zoho-surface border border-zoho-border rounded-md px-2 py-1"
              aria-label="Number to dial"
            />
            <button
              type="button"
              onClick={copyDialNumber}
              title="Copy number to paste in CloudTalk"
              className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-zoho-muted hover:text-brand-600 hover:bg-brand-50"
              aria-label="Copy dial number"
            >
              <ClipboardDocumentIcon className="w-4 h-4" />
            </button>
          </div>
        ) : null}

        <div className="relative overflow-hidden bg-white shrink-0" style={{ width: panelW, height: panelH }}>
          {iframeMounted ? (
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              title="CloudTalk Phone"
              allow="microphone *"
              onLoad={onIframeLoad}
              className="absolute top-0 left-0 border-0 origin-top-left bg-white"
              style={{
                width: IFRAME_W,
                height: IFRAME_H,
                transform: `scale(${SCALE})`,
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-zoho-muted">
              Open dialer to load CloudTalk…
            </div>
          )}
        </div>
      </div>
    </>
  );
}
