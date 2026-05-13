// Edge Function: follow
// Authenticated follow. follower is forced from session.

import { jsonResponse, preflight } from '../_shared/cors.ts';
import { adminClient, verifySession } from '../_shared/session.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const origin = req.headers.get('origin');
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, origin);

  let body: {
    sessionToken?: string;
    followee?: string;
    followerDisplayName?: string | null;
    followerUsername?: string | null;
    followerAvatar?: string | null;
  };
  try { body = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400, origin); }
  const { sessionToken, followee, followerDisplayName, followerUsername, followerAvatar } = body;
  if (!sessionToken || !followee) return jsonResponse({ error: 'missing_fields' }, 400, origin);
  if (typeof followee !== 'string' || followee.length < 32 || followee.length > 44) {
    return jsonResponse({ error: 'invalid_followee' }, 400, origin);
  }

  const session = await verifySession(sessionToken);
  if (!session) return jsonResponse({ error: 'session_invalid' }, 401, origin);
  if (session.wallet === followee) return jsonResponse({ error: 'cannot_follow_self' }, 400, origin);

  const sb = adminClient();
  const { data, error } = await sb.rpc('follow_wallet', {
    follower: session.wallet,
    followee,
    follower_display_name: followerDisplayName ?? null,
    follower_username: followerUsername ?? null,
    follower_avatar: followerAvatar ?? null,
  });
  if (error) return jsonResponse({ error: 'rpc_failed', detail: error.message }, 500, origin);
  return jsonResponse({ row: data }, 200, origin);
});
