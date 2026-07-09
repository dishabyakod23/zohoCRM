'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../ui/Toast.js';
import JustCallDialerPanel from './JustCallDialerPanel.js';
import { JUSTCALL_ENABLED, normalizePhoneForDial, openJustCallWebDialer } from '../../lib/justCallHelpers.js';

const JustCallContext = createContext(null);

const FALLBACK = {
  enabled: false,
  ready: false,
  loggedIn: false,
  open: false,
  setOpen: () => {},
  dialNumber: () => {},
  toggleDialer: () => {},
};

export function JustCallProvider({ children }) {
  const dialerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!JUSTCALL_ENABLED || typeof window === 'undefined') return undefined;

    let cancelled = false;

    (async () => {
      try {
        const { JustCallDialer } = await import('@justcall/justcall-dialer-sdk');
        if (cancelled || !document.getElementById('justcall-dialer')) return;

        const dialer = new JustCallDialer({
          dialerId: 'justcall-dialer',
          onLogin: () => setLoggedIn(true),
          onLogout: () => setLoggedIn(false),
          onReady: () => setReady(true),
        });

        dialerRef.current = dialer;
        await dialer.ready;
        if (!cancelled) setReady(true);
      } catch (err) {
        console.error('JustCall dialer failed to initialize', err);
      }
    })();

    return () => {
      cancelled = true;
      dialerRef.current?.destroy?.();
      dialerRef.current = null;
    };
  }, []);

  const dialNumber = useCallback(async (rawNumber, { openPanel = true } = {}) => {
    const number = normalizePhoneForDial(rawNumber);
    if (!number) {
      showToast('No valid phone number to dial');
      return;
    }

    if (!JUSTCALL_ENABLED) {
      openJustCallWebDialer(number);
      return;
    }

    const dialer = dialerRef.current;
    if (!dialer) {
      openJustCallWebDialer(number);
      return;
    }

    try {
      await dialer.ready;
      if (openPanel) setOpen(true);

      const isLoggedIn = await dialer.isLoggedIn();
      if (!isLoggedIn) {
        showToast('Log in to JustCall in the dialer panel to place calls');
        return;
      }

      dialer.dialNumber(number);
    } catch {
      showToast('Could not start call. Opening JustCall dialer instead.');
      openJustCallWebDialer(number);
    }
  }, [showToast]);

  const toggleDialer = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(() => ({
    enabled: JUSTCALL_ENABLED,
    ready,
    loggedIn,
    open,
    setOpen,
    toggleDialer,
    dialNumber,
  }), [ready, loggedIn, open, dialNumber, toggleDialer]);

  return (
    <JustCallContext.Provider value={value}>
      {children}
      {JUSTCALL_ENABLED && <JustCallDialerPanel open={open} onClose={() => setOpen(false)} />}
    </JustCallContext.Provider>
  );
}

export function useJustCall() {
  return useContext(JustCallContext) || FALLBACK;
}
