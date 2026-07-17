'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth.js';
import { useToast } from '../components/ui/Toast.js';
import { getApiError } from '../lib/api.js';
import * as meetingsApi from '../lib/services/meetings.js';

const MeetingRemindersContext = createContext(null);

const POLL_MS = 30000;

export function MeetingRemindersProvider({ children }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const knownIdsRef = useRef(new Set());
  const bootstrappedRef = useRef(false);
  const acknowledgingRef = useRef(new Set());

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!user?.id) {
      setReminders([]);
      return [];
    }
    if (!quiet) setLoading(true);
    try {
      const list = await meetingsApi.listMeetingReminders();
      const nextIds = new Set(list.map((r) => r.id));
      const previous = knownIdsRef.current;
      const isFirstLoad = !bootstrappedRef.current;

      if (!isFirstLoad) {
        const newlyAdded = list.filter((r) => !previous.has(r.id));
        if (newlyAdded.length) {
          const newest = newlyAdded[0];
          showToast(newest.message || `New meeting: ${newest.title}`, 'success');
          setPopupOpen(true);
        }
      } else if (list.length > 0) {
        setPopupOpen(true);
      }

      knownIdsRef.current = nextIds;
      bootstrappedRef.current = true;
      setReminders(list);
      return list;
    } catch {
      if (!quiet) setReminders([]);
      return [];
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [user?.id, showToast]);

  useEffect(() => {
    bootstrappedRef.current = false;
    knownIdsRef.current = new Set();
    setReminders([]);
    setPopupOpen(false);
    if (!user?.id) return undefined;

    refresh();
    const timer = setInterval(() => refresh({ quiet: true }), POLL_MS);
    const onFocus = () => refresh({ quiet: true });
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.id, refresh]);

  const acknowledge = useCallback(async (meetingId) => {
    if (!meetingId || acknowledgingRef.current.has(meetingId)) return;
    acknowledgingRef.current.add(meetingId);
    try {
      await meetingsApi.acknowledgeMeetingReminder(meetingId);
      knownIdsRef.current.delete(meetingId);
      setReminders((prev) => {
        const next = prev.filter((r) => r.id !== meetingId);
        if (next.length === 0) setPopupOpen(false);
        return next;
      });
    } catch (err) {
      showToast(getApiError(err));
      throw err;
    } finally {
      acknowledgingRef.current.delete(meetingId);
    }
  }, [showToast]);

  const dismissPopup = useCallback(() => {
    setPopupOpen(false);
  }, []);

  const openPopup = useCallback(() => {
    setPopupOpen(true);
  }, []);

  return (
    <MeetingRemindersContext.Provider
      value={{
        reminders,
        count: reminders.length,
        loading,
        popupOpen,
        refresh,
        acknowledge,
        dismissPopup,
        openPopup,
      }}
    >
      {children}
    </MeetingRemindersContext.Provider>
  );
}

export function useMeetingReminders() {
  const ctx = useContext(MeetingRemindersContext);
  if (!ctx) {
    return {
      reminders: [],
      count: 0,
      loading: false,
      popupOpen: false,
      refresh: async () => [],
      acknowledge: async () => {},
      dismissPopup: () => {},
      openPopup: () => {},
    };
  }
  return ctx;
}
