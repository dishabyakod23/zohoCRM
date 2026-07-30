'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../ui/Toast.js';
import CloudTalkDialerPanel from './CloudTalkDialerPanel.js';
import {
  CLOUDTALK_ENABLED,
  CLOUDTALK_ORIGIN,
  cloudTalkPhoneUrl,
  copyPhoneToClipboard,
  normalizePhoneForDial,
  openCloudTalkWebPhone,
  tryCloudTalkDesktopDial,
} from '../../lib/cloudTalkHelpers.js';
import { upsertStoredCloudTalkCall } from '../../lib/cloudTalkCallLog.js';
import { normalizeIframeCloudTalkCall } from '../../lib/services/cloudTalkCalls.js';

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
  const loggedInRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [iframeMounted, setIframeMounted] = useState(false);
  const [iframeSrc] = useState(() => cloudTalkPhoneUrl());
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const { showToast } = useToast();

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
          loggedInRef.current = true;
          setLoggedIn(true);
          setReady(true);
          if (payload.event === 'dialing') persistIframeCall(payload, 'dialing');
          break;
        case 'login':
          loggedInRef.current = true;
          setLoggedIn(true);
          setReady(true);
          break;
        case 'logout':
          loggedInRef.current = false;
          setLoggedIn(false);
          break;
        case 'contact_info':
          loggedInRef.current = true;
          setLoggedIn(true);
          persistIframeCall(payload, 'contact_info');
          break;
        case 'ended':
          loggedInRef.current = true;
          setLoggedIn(true);
          persistIframeCall(payload, 'ended');
          break;
        case 'hangup':
          loggedInRef.current = true;
          setLoggedIn(true);
          break;
        default:
          if (payload.event) {
            loggedInRef.current = true;
            setLoggedIn(true);
            setReady(true);
          }
          break;
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [ensureIframe, persistIframeCall]);

  /**
   * CloudTalk's embedded Phone iframe has no documented way to receive a number or a
   * dial command from the parent page — it only broadcasts call-status events outward.
   * So there are exactly two real ways to get a number into a call:
   *  1. The `ct+tel:` deep link, which the CloudTalk Click to Call browser extension (or
   *     Desktop app) picks up and dials automatically — but only if that extension/app is
   *     installed. There's no way to detect from JS whether it actually fired.
   *  2. Copy the number to the clipboard and let the agent paste it into the dialer.
   * We always do both, and open the panel so the agent can see/paste it either way.
   */
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

    const copied = await copyPhoneToClipboard(number);
    tryCloudTalkDesktopDial(number);

    if (openPanel) {
      ensureIframe();
      setOpen(true);
    }

    showToast(
      copied
        ? `${number} copied. Dialing via the CloudTalk Click to Call extension if it's installed — otherwise paste it into the dialer below.`
        : `Dialing ${number} via the CloudTalk Click to Call extension if it's installed — otherwise type it into the dialer below.`,
    );
  }, [ensureIframe, showToast]);

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
    iframeSrc,
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
