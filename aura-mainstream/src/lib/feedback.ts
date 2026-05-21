// AURA Feedback submission
// 2026-05-20 — submit user feedback to a Feishu (Lark) incoming webhook.
//
// Drop-in usage:
//   import { submitFeedback, captureViewport } from '@/lib/feedback';
//   await submitFeedback({ type: 'bug', message: '...', walletAddress, username });
//
// Backend: Feishu incoming webhook (`VITE_FEEDBACK_WEBHOOK_URL`). If unset,
// the submitter logs to console and resolves successfully so dev / preview
// builds don't error out. A future Supabase mirror can be wired into the
// same call site without touching the widget.

import html2canvas from 'html2canvas';

export type FeedbackType = 'bug' | 'feature' | 'general';

export interface FeedbackPayload {
  type: FeedbackType;
  message: string;
  walletAddress?: string | null;
  username?: string | null;
  /** PNG data URL of the current viewport, optional */
  screenshot?: string | null;
  /** Auto-filled fields */
  url?: string;
  userAgent?: string;
  screenSize?: string;
  viewportSize?: string;
  // Free-form extras (e.g. route name, build version)
  meta?: Record<string, unknown>;
}

const TYPE_LABELS: Record<FeedbackType, string> = {
  bug: '🐛 Bug',
  feature: '✨ Feature Request',
  general: '💬 General Feedback',
};

/** Best-effort viewport screenshot. Returns null on failure. */
export async function captureViewport(): Promise<string | null> {
  try {
    if (typeof document === 'undefined' || !document.body) return null;
    const canvas = await html2canvas(document.body, {
      // Keep it light — full DPR can blow past Feishu's payload limit.
      scale: Math.min(window.devicePixelRatio || 1, 1.5),
      logging: false,
      // Don't try to fetch tainted cross-origin images.
      useCORS: true,
      allowTaint: false,
      // Capture only the viewport, not the whole document.
      width: window.innerWidth,
      height: window.innerHeight,
      x: window.scrollX,
      y: window.scrollY,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      backgroundColor: null,
    });
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[feedback] screenshot failed', err);
    return null;
  }
}

function buildFeishuCard(p: FeedbackPayload) {
  const title = TYPE_LABELS[p.type] || '💬 Feedback';
  const meta: string[] = [];
  if (p.username) meta.push(`**User:** ${p.username}`);
  if (p.walletAddress) meta.push(`**Wallet:** \`${p.walletAddress}\``);
  if (p.url) meta.push(`**URL:** ${p.url}`);
  if (p.viewportSize) meta.push(`**Viewport:** ${p.viewportSize}`);
  if (p.screenSize) meta.push(`**Screen:** ${p.screenSize}`);
  if (p.userAgent) meta.push(`**UA:** ${p.userAgent}`);

  const elements: any[] = [
    {
      tag: 'div',
      text: { tag: 'lark_md', content: p.message || '_(empty)_' },
    },
    { tag: 'hr' },
    {
      tag: 'div',
      text: { tag: 'lark_md', content: meta.join('\n') || '_no metadata_' },
    },
  ];

  if (p.screenshot) {
    // Feishu cards can't render base64 inline (needs image_key). We surface
    // a placeholder note so the dev knows a screenshot exists in the
    // payload — the raw post body keeps the data URL so future receivers
    // (or a custom webhook bridge) can decode it.
    elements.push({
      tag: 'note',
      elements: [
        { tag: 'plain_text', content: '📷 Screenshot attached in JSON payload (data URL)' },
      ],
    });
  }

  return {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: `AURA Feedback — ${title}` },
        template: p.type === 'bug' ? 'red' : p.type === 'feature' ? 'blue' : 'green',
      },
      elements,
    },
    // Custom fields (Feishu ignores extras) so a bridge worker can pick
    // them up if/when one is added.
    aura_feedback: p,
  };
}

/** Resolve the webhook URL once at module init. */
function getWebhookUrl(): string | null {
  const raw = (import.meta.env.VITE_FEEDBACK_WEBHOOK_URL as string | undefined)?.trim();
  if (!raw) return null;
  return raw;
}

export async function submitFeedback(
  p: Omit<FeedbackPayload, 'url' | 'userAgent' | 'screenSize' | 'viewportSize'>
): Promise<{ ok: boolean; reason?: string }> {
  const enriched: FeedbackPayload = {
    ...p,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    screenSize:
      typeof window !== 'undefined'
        ? `${window.screen.width}x${window.screen.height}@${window.devicePixelRatio}x`
        : undefined,
    viewportSize:
      typeof window !== 'undefined'
        ? `${window.innerWidth}x${window.innerHeight}`
        : undefined,
  };

  const url = getWebhookUrl();
  const card = buildFeishuCard(enriched);

  if (!url) {
    // eslint-disable-next-line no-console
    console.warn('[feedback] VITE_FEEDBACK_WEBHOOK_URL not set — payload below was NOT sent.', card);
    return { ok: true, reason: 'no-webhook-configured' };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, reason: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
