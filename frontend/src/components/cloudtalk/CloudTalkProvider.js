'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../ui/Toast.js';
import CloudTalkDialerPanel from './CloudTalkDialerPanel.js';
import {
  CLOUDTALK_ENABLED,
  CLOUDTALK_ORIGIN,
  normalizePhoneForDial,
  openCloudTalkWebPhone,
  tryCloudTalkDesktopDial,
} from '../../lib/cloudTalkHelpers.js';

const CloudTalkContext = createContext(null);

const FALLBACK = {
  enabled: false,
  ready: false,
  loggedIn: false,
  open: false,
  setOpen: () => {},
  dialNumber: () => {},
  toggleDialer: () => {},
  iframeRef: { current: null },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCloudTalkMessage(data) {
  if (!data) return null;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (typeof data === 'object') return data;
  return null;
}

export function CloudTalkProvider({ children }) {
  const iframeRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [iframeMounted, setIframeMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const { showToast } = useToast();

  const ensureIframe = useCallback(() => {
    setIframeMounted(true);
  }, []);

  const setOpenPanel = useCallback((value) => {
    if (value) ensureIframe();
    setOpen(value);
  }, [ensureIframe]);

  useEffect(() => {
    if (!CLOUDTALK_ENABLED || typeof window === 'undefined') return undefined;

    const onMessage = (event) => {
      if (event.origin !== CLOUDTALK_ORIGIN) return;
      const payload = parseCloudTalkMessage(event.data);
      if (!payload?.event) return;

      switch (payload.event) {
        case 'ringing':
          ensureIframe();
          setOpen(true);
          break;
        case 'dialing':
        case 'calling':
          setLoggedIn(true);
          setReady(true);
          break;
        case 'login':
          setLoggedIn(true);
          setReady(true);
          break;
        case 'logout':
          setLoggedIn(false);
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [ensureIframe]);

  const postDialToIframe = useCallback((number) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return false;

    const payloads = [
      { action: 'call', number, autocall: true },
      { event: 'dial', properties: { external_number: number } },
      { event: 'dial', number },
    ];

    for (const payload of payloads) {
      try {
        iframe.contentWindow.postMessage(JSON.stringify(payload), CLOUDTALK_ORIGIN);
        iframe.contentWindow.postMessage(payload, CLOUDTALK_ORIGIN);
      } catch {
        // try next format
      }
    }
    return true;
  }, []);

  const waitForIframe = useCallback(async () => {
    const started = Date.now();
    while (Date.now() - started < 8000) {
      if (iframeRef.current?.contentWindow) return iframeRef.current;
      await sleep(120);
    }
    return iframeRef.current;
  }, []);

  const dialNumber = useCallback(async (rawNumber, { openPanel = true } = {}) => {
    const number = normalizePhoneForDial(rawNumber);
    if (!number) {
      showToast('No valid phone number to dial');
      return;
    }

    if (!CLOUDTALK_ENABLED) {
      openCloudTalkWebPhone(number);
      return;
    }

    if (openPanel) {
      ensureIframe();
      setOpen(true);
    }

    await waitForIframe();
    postDialToIframe(number);

    const openedDesktop = tryCloudTalkDesktopDial(number);
    if (openedDesktop) return;

    if (!loggedIn) {
      showToast('Log in to CloudTalk in the dialer panel, then press call');
    }
  }, [loggedIn, ensureIframe, postDialToIframe, showToast, waitForIframe]);

  const toggleDialer = useCallback(() => {
    setOpen((v) => {
      if (!v) ensureIframe();
      return !v;
    });
  }, [ensureIframe]);

  const onIframeLoad = useCallback(() => {
    setReady(true);
  }, []);

  const value = useMemo(() => ({
    enabled: CLOUDTALK_ENABLED,
    ready,
    loggedIn,
    open,
    iframeMounted,
    setOpen: setOpenPanel,
    toggleDialer,
    dialNumber,
    iframeRef,
    onIframeLoad,
  }), [ready, loggedIn, open, iframeMounted, dialNumber, toggleDialer, onIframeLoad, setOpenPanel]);

  return (
    <CloudTalkContext.Provider value={value}>
      {children}
      {CLOUDTALK_ENABLED && (
        <CloudTalkDialerPanel open={open} iframeMounted={iframeMounted} onClose={() => setOpen(false)} />
      )}
    </CloudTalkContext.Provider>
  );
}

export function useCloudTalk() {
  return useContext(CloudTalkContext) || FALLBACK;
}
