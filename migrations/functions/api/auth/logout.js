import { ok, error, optionsResponse } from '../../_lib/response.js';
import { clearSessionCookie, getSessionToken } from '../../_lib/customer-auth.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return onRequestOptions();
  if (context.request.method !== 'POST') return error('Method not allowed.', 405);

  try {
    const token = getSessionToken(context.request);
    if (token) {
      await context.env.DB.prepare(`DELETE FROM customer_sessions WHERE session_token = ?`).bind(token).run();
    }

    const response = ok({ loggedOut: true });
    const body = await response.text();
    const headers = new Headers(response.headers);
    headers.append('Set-Cookie', clearSessionCookie());
    return new Response(body, { status: response.status, headers });
  } catch (err) {
    return error(err?.message || 'Could not log out.', 500);
  }
}
