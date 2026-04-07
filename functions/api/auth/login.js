import { ok, error, optionsResponse } from '../../_lib/response.js';
import { readJson } from '../../_lib/parse.js';
import { verifyHumanCheck } from '../../_lib/human-check.js';
import { hashPassword, makeExpiryDate, makeSessionToken, sessionCookie } from '../../_lib/customer-auth.js';
import { ensureCustomerProfile, loyaltyTierFromSpend } from '../../_lib/storefront.js';
import { requireLoginAvailability, recordLoginFailure, clearLoginFailures } from '../../_lib/login-guard.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return onRequestOptions();
  if (context.request.method !== 'POST') return error('Method not allowed.', 405);

  try {
    const body = await readJson(context.request);
    const email = String(body.email || '').trim().toLowerCase();
    const human = await verifyHumanCheck(context.env, body.human_token, context.request.headers.get('cf-connecting-ip') || '');
    if (!human.ok) return error(human.message, 400);
    const password = String(body.password || '');

    if (!email || !password) return error('Email and password are required.', 400);
    const locked = await requireLoginAvailability(context.env, context.request, 'customer', email);
    if (locked) return locked;

    const passwordHash = await hashPassword(password);
    const customer = await context.env.DB.prepare(`
      SELECT id, email, full_name
      FROM customers
      WHERE email = ? AND password_hash = ?
      LIMIT 1
    `).bind(email, passwordHash).first();

    if (!customer) {
      await recordLoginFailure(context.env, context.request, 'customer', email);
      return error('Invalid email or password.', 401);
    }
    await clearLoginFailures(context.env, context.request, 'customer', email);

    const profile = await ensureCustomerProfile(context.env, customer.id);
    customer.tier_name = profile?.tier_name || loyaltyTierFromSpend(profile?.lifetime_spend || 0, profile?.paid_orders || 0).tier;
    customer.tier_discount_percent = Number(profile?.tier_discount_percent || 0);
    customer.loyalty_points = Number(profile?.loyalty_points || 0);

    const token = makeSessionToken();
    const expiresAt = makeExpiryDate();
    await context.env.DB.prepare(`DELETE FROM customer_sessions WHERE customer_id = ?`).bind(customer.id).run();
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
