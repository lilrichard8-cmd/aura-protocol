import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPWA() {
  const { t } = useI18n();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('aura-pwa-dismissed') === 'true';
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const install = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem('aura-pwa-dismissed', 'true');
  };

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 max-w-sm">
      <Download className="w-5 h-5 text-aura shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium">{t.pwa.install}</p>
      </div>
      <button onClick={install} className="px-3 py-1.5 bg-aura text-white text-xs font-medium rounded-lg hover:bg-aura/90">
        Install
      </button>
      <button onClick={dismiss} className="p-1 hover:bg-accent rounded-full">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
