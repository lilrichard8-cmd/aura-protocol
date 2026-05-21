// AURA dev/test tools context
// 2026-05-21 — centralizes the open state for test-user-facing buttons that
// live in the top navigation (Feedback panel, Sentry test, etc.). The
// FeedbackWidget panel is rendered at the App root; the Header is where
// the triggers live. This context bridges them.

import { createContext, useContext, useState, ReactNode } from 'react';

interface DevToolsContextValue {
  feedbackOpen: boolean;
  setFeedbackOpen: (open: boolean) => void;
  /** Throws a test error so we can verify Sentry capture end-to-end. */
  triggerSentryTest: () => void;
}

const DevToolsContext = createContext<DevToolsContextValue | null>(null);

export function DevToolsProvider({ children }: { children: ReactNode }) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const triggerSentryTest = () => {
    // Stamp a marker on window so we can grep this single test event in
    // Sentry separately from real errors.
    (window as any).__auraSentryTestAt = new Date().toISOString();
    // Throwing inside a microtask makes Sentry's `window.onerror` handler
    // pick this up the same way a real uncaught error would. Wrapping it
    // in setTimeout(0) also keeps React's render cycle clean.
    setTimeout(() => {
      throw new Error(
        `AURA Sentry verify test @ ${(window as any).__auraSentryTestAt}`
      );
    }, 0);
  };

  return (
    <DevToolsContext.Provider value={{ feedbackOpen, setFeedbackOpen, triggerSentryTest }}>
      {children}
    </DevToolsContext.Provider>
  );
}

export function useDevTools() {
  const ctx = useContext(DevToolsContext);
  if (!ctx) {
    throw new Error('useDevTools must be used inside <DevToolsProvider>');
  }
  return ctx;
}
