'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../ui/Toast.js';
import JustCallDialerPanel from './JustCallDialerPanel.js';
import { JUSTCALL_ENABLED, normalizePhoneForDial, openJustCallWebDialer } from '../../lib/justCallHelpers.js';

const JustCallContext = createContext(null);
const DIALER_WAIT_MS = 10000;

const FALLBACK = {
  enabled: false,
  ready: false,
  loggedIn: false,
  open: false,
  setOpen: () => {},
  dialNumber: () => {},
  toggleDialer: () => {},
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function JustCallProvider({ children }) {
  const dialerRef = useRef(null);
  const initStartedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!JUSTCALL_ENABLED || typeof window === 'undefined') return undefined;
    if (!open && !dialerRef.current) return undefined;
    if (initStartedRef.current && dialerRef.current) return undefined;

    let cancelled = false;
    let retryTimer;

    const init = async () => {
      const el = document.getElementById('justcall-dialer');
      if (!el) {
        retryTimer = window.setTimeout(init, 150);
        return;
      }
      if (initStartedRef.current) return;
      initStartedRef.current = true;

      try {
        const { JustCallDialer } = await import('@justcall/justcall-dialer-sdk');
        if (cancelled) return;

        const dialer = new JustCallDialer({
          dialerId: 'justcall-dialer',
          onLogin: () => setLoggedIn(true),
          onLogout: () => setLoggedIn(false),
          onReady: () => setReady(true),
        });

        dialerRef.current = dialer;
        await dialer.ready;
        if (!cancelled) {
          setReady(true);
          try {
            const isLoggedIn = await dialer.isLoggedIn();
            if (!cancelled) setLoggedIn(!!isLoggedIn);
          } catch {
            // ignore login probe failures
          }
        }
      } catch (err) {
        initStartedRef.current = false;
        console.error('JustCall dialer failed to initialize', err);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [open]);

  useEffect(() => () => {
    dialerRef.current?.destroy?.();
    dialerRef.current = null;
    initStartedRef.current = false;
  }, []);

  const waitForDialer = useCallback(async () => {
    const started = Date.now();
    while (Date.now() - started < DIALER_WAIT_MS) {
      const dialer = dialerRef.current;
      if (dialer) {
        try {
          await dialer.ready;
          return dialer;
        } catch {
          return null;
        }
      }
      await sleep(120);
    }
    return dialerRef.current;
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

    if (openPanel) setOpen(true);

    const dialer = dialerRef.current || await waitForDialer();
    if (!dialer) {
      showToast('JustCall dialer is still loading. Opening web dialer instead.');
      openJustCallWebDialer(number);
      return;
    }

    try {
      await dialer.ready;
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
  }, [showToast, waitForDialer]);

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
