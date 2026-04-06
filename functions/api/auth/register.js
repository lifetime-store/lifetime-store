import { ok, error, optionsResponse } from '../../_lib/response.js';
import { readJson } from '../../_lib/parse.js';
import { hashPassword, makeExpiryDate, makeSessionToken, sessionCookie } from '../../_lib/customer-auth.js';
import { ensureCustomerProfile } from '../../_lib/storefront.js';

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
    const fullName = String(body.full_name || '').trim();

    if (!email || !password) return error('Email and password are required.', 400);
    if (password.length < 6) return error('Password must be at least 6 characters.', 400);

    const existing = await context.env.DB.prepare(`SELECT id FROM customers WHERE email = ? LIMIT 1`).bind(email).first();
    if (existing) return error('An account with that email already exists.', 409);

    const passwordHash = await hashPassword(password);
    const insert = await context.env.DB.prepare(`
      INSERT INTO customers (email, password_hash, full_name)
      VALUES (?, ?, ?)
    `).bind(email, passwordHash, fullName || null).run();

    const customerId = insert.meta?.last_row_id;
    await ensureCustomerProfile(context.env, customerId);

    const token = makeSessionToken();
    const expiresAt = makeExpiryDate();

    await context.env.DB.prepare(`
      INSERT INTO customer_sessions (customer_id, session_token, expires_at)
      VALUES (?, ?, ?)
    `).bind(customerId, token, expiresAt.toISOString()).run();

    const response = ok({ customer: { id: customerId, email, full_name: fullName || '' } });
    const bodyText = await response.text();
    const headers = new Headers(response.headers);
    headers.append('Set-Cookie', sessionCookie(token, expiresAt));
    return new Response(bodyText, { status: response.status, headers });
  } catch (err) {
    return error(err?.message || 'Could not create account.', 500);
  }
}
