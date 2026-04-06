import { ok, error, optionsResponse } from '../../_lib/response.js';
import { readJson } from '../../_lib/parse.js';
import { hashPassword, makeExpiryDate, makeSessionToken, sessionCookie } from '../../_lib/customer-auth.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return onRequestOptions();
  if (context.request.method !== 'POST') return error('Method not allowed.', 405);

  try {
    const body = await readJson(context.request);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) return error('Email and password are required.', 400);

    const passwordHash = await hashPassword(password);
    const customer = await context.env.DB.prepare(`
      SELECT id, email, full_name
      FROM customers
      WHERE email = ? AND password_hash = ?
      LIMIT 1
    `).bind(email, passwordHash).first();

    if (!customer) return error('Invalid email or password.', 401);

    const token = makeSessionToken();
    const expiresAt = makeExpiryDate();
    await context.env.DB.prepare(`INSERT INTO customer_sessions (customer_id, session_token, expires_at) VALUES (?, ?, ?)`).bind(customer.id, token, expiresAt.toISOString()).run();

    const response = ok({ customer });
    const bodyText = await response.text();
    const headers = new Headers(response.headers);
    headers.append('Set-Cookie', sessionCookie(token, expiresAt));
    return new Response(bodyText, { status: response.status, headers });
  } catch (err) {
    return error(err?.message || 'Sign in failed.', 500);
  }
}
