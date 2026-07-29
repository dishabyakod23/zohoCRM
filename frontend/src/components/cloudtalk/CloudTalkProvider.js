'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../ui/Toast.js';
import CloudTalkDialerPanel from './CloudTalkDialerPanel.js';
import {
  CLOUDTALK_ENABLED,
  CLOUDTALK_ORIGIN,
  applyNumberToCloudTalkIframe,
  cloudTalkPhoneUrl,
  normalizePhoneForDial,
  openCloudTalkWebPhone,
  tryCloudTalkDesktopDial,
} from '../../lib/cloudTalkHelpers.js';
import { postCloudTalkDialWithRetries } from '../../lib/cloudTalkDialMessages.js';
import { upsertStoredCloudTalkCall } from '../../lib/cloudTalkCallLog.js';
import { normalizeIframeCloudTalkCall } from '../../lib/services/cloudTalkCalls.js';

const CloudTalkContext = createContext(null);

const FALLBACK = {
  enabled: false,
  ready: false,
  loggedIn: false,
  open: false,
  pendingDialNumber: '',
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
  const activeCallRef = useRef(null);
  const pendingDialRef = useRef('');
  const [open, setOpen] = useState(false);
  const [iframeMounted, setIframeMounted] = useState(false);
  const [iframeSrc, setIframeSrc] = useState(() => cloudTalkPhoneUrl());
  const [pendingDialNumber, setPendingDialNumber] = useState('');
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const { showToast } = useToast();

  const flushPendingDial = useCallback(async (number) => {
    const normalized = normalizePhoneForDial(number || pendingDialRef.current);
    if (!normalized) return;
    const iframe = iframeRef.current;
    if (iframe) applyNumberToCloudTalkIframe(iframe, normalized);
    await postCloudTalkDialWithRetries(iframeRef, normalized);
  }, []);

  const ensureIframe = useCallback(() => {
    setIframeMounted(true);
  }, []);

  const readCurrentUser = useCallback(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('crm_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const persistIframeCall = useCallback((payload, eventName) => {
    const props = payload?.properties || {};
    const callUuid = props.call_uuid;
    if (!callUuid) return;

    const now = new Date().toISOString();
    const existing = activeCallRef.current?.callUuid === callUuid
      ? activeCallRef.current
      : null;

    if (eventName === 'ringing') {
      activeCallRef.current = {
        callUuid,
        direction: 'incoming',
        externalNumber: props.external_number,
        contactName: props.contact?.name,
        startedAt: now,
      };
      return;
    }

    if (eventName === 'dialing') {
      activeCallRef.current = {
        callUuid,
        direction: 'outgoing',
        externalNumber: props.external_number,
        contactName: props.contact?.name,
        startedAt: now,
      };
      return;
    }

    if (eventName === 'contact_info') {
      if (!activeCallRef.current || activeCallRef.current.callUuid !== callUuid) {
        activeCallRef.current = {
          callUuid,
          direction: 'outgoing',
          externalNumber: props.external_number,
          contactName: props.contact?.name,
          startedAt: now,
        };
      } else if (props.contact?.name) {
        activeCallRef.current.contactName = props.contact.name;
      }
      return;
    }

    if (eventName !== 'ended') return;

    const active = existing || activeCallRef.current || {
      callUuid,
      direction: 'outgoing',
      externalNumber: props.external_number,
      contactName: props.contact?.name,
      startedAt: now,
    };

    const entry = normalizeIframeCloudTalkCall({
      callUuid: active.callUuid,
      direction: active.direction,
      externalNumber: active.externalNumber || props.external_number,
      contactName: active.contactName || props.contact?.name,
      startedAt: active.startedAt,
      endedAt: now,
      user: readCurrentUser(),
    });
    upsertStoredCloudTalkCall(entry);
    if (activeCallRef.current?.callUuid === callUuid) activeCallRef.current = null;
  }, [readCurrentUser]);

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
          persistIframeCall(payload, 'ringing');
          break;
        case 'dialing':
        case 'calling':
          setLoggedIn(true);
          setReady(true);
          if (payload.event === 'dialing') persistIframeCall(payload, 'dialing');
          break;
        case 'login':
          setLoggedIn(true);
          setReady(true);
          flushPendingDial();
          break;
        case 'logout':
          setLoggedIn(false);
          break;
        case 'contact_info':
          persistIframeCall(payload, 'contact_info');
          break;
        case 'ended':
          persistIframeCall(payload, 'ended');
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [ensureIframe, persistIframeCall, flushPendingDial]);

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

    pendingDialRef.current = number;
    setPendingDialNumber(number);
    setIframeSrc(cloudTalkPhoneUrl({ number }));

    if (openPanel) {
      ensureIframe();
      setOpen(true);
      await waitForIframe();
      const iframe = iframeRef.current;
      if (iframe) applyNumberToCloudTalkIframe(iframe, number);
      await flushPendingDial(number);
      return;
    }

    const openedDesktop = tryCloudTalkDesktopDial(number);
    if (!openedDesktop) {
      showToast('Open the CloudTalk dialer to place calls from the CRM');
    }
  }, [ensureIframe, flushPendingDial, showToast, waitForIframe]);

  const toggleDialer = useCallback(() => {
    setOpen((v) => {
      if (!v) ensureIframe();
      return !v;
    });
  }, [ensureIframe]);

  const onIframeLoad = useCallback(() => {
    setReady(true);
    flushPendingDial();
  }, [flushPendingDial]);

  const value = useMemo(() => ({
    enabled: CLOUDTALK_ENABLED,
    ready,
    loggedIn,
    open,
    iframeMounted,
    iframeSrc,
    pendingDialNumber,
    setOpen: setOpenPanel,
    toggleDialer,
    dialNumber,
    iframeRef,
    onIframeLoad,
  }), [
    ready,
    loggedIn,
    open,
    iframeMounted,
    iframeSrc,
    pendingDialNumber,
    dialNumber,
    toggleDialer,
    onIframeLoad,
    setOpenPanel,
  ]);

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
