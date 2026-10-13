'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type Kind = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  kind: Kind;
  title: string;
  message?: string;
  duration: number;
};

type ToastApi = {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const STYLES: Record<Kind, { bar: string; icon: string; progress: string; Icon: typeof Info }> = {
  success: { bar: 'border-l-emerald-500', icon: 'text-emerald-600', progress: 'bg-emerald-500', Icon: CheckCircle2 },
  error: { bar: 'border-l-red-500', icon: 'text-red-600', progress: 'bg-red-500', Icon: AlertCircle },
  info: { bar: 'border-l-blue-500', icon: 'text-blue-600', progress: 'bg-blue-500', Icon: Info },
};

const EXIT_MS = 200;

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const { bar, icon, progress, Icon } = STYLES[toast.kind];

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => onDismiss(toast.id), EXIT_MS);
  }, [onDismiss, toast.id]);

  // slide in on mount, auto close after the duration
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const timer = setTimeout(close, toast.duration);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [close, toast.duration]);

  const visible = shown && !closing;

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto relative overflow-hidden rounded-lg border border-gray-200 border-l-4 ${bar} bg-white shadow-lg ring-1 ring-black/5 transition duration-200 ease-out motion-reduce:transition-none ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      <div className="flex items-start gap-3 py-3 pl-3 pr-2">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${icon}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
          {toast.message && <p className="mt-0.5 break-words text-sm text-gray-600">{toast.message}</p>}
        </div>
        <button
          onClick={close}
          aria-label="Dismiss notification"
          className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {/* time-left indicator */}
      <div
        className={`absolute bottom-0 left-0 h-0.5 ${progress} opacity-60 motion-reduce:hidden`}
        style={{
          width: shown ? '0%' : '100%',
          transition: `width ${toast.duration}ms linear`,
        }}
      />
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const api = useMemo<ToastApi>(() => {
    let counter = 0;
    const push = (kind: Kind, duration: number) => (title: string, message?: string) => {
      const id = Date.now() * 1000 + (counter++ % 1000);
      // keep at most 4 on screen
      setToasts((prev) => [...prev.slice(-3), { id, kind, title, message, duration }]);
    };
    return {
      success: push('success', 3500),
      info: push('info', 4000),
      error: push('error', 6500),
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] flex-col gap-2 sm:w-96"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}