'use client';
import { createContext, useContext, useState, useCallback } from 'react';
import { isPublicAuthPath, isStaleAuthToast } from '../../lib/authHelpers.js';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'error') => {
    if (
      typeof window !== 'undefined'
      && isPublicAuthPath(window.location.pathname)
      && isStaleAuthToast(message)
    ) {
      return;
    }
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  const clearToasts = useCallback(() => setToasts([]), []);

  return (
    <ToastContext.Provider value={{ showToast, clearToasts }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] space-y-2 w-full max-w-md px-4">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 rounded-xl shadow-card-hover text-sm font-medium animate-scaleIn ${
            t.type === 'error' ? 'bg-gradient-to-r from-red-500 to-accent-pink text-white' :
            t.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-accent-teal text-white' : 'bg-gray-800 text-white'
          }`}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
