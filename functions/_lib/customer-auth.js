import { error } from './response.js';

const SESSION_COOKIE = 'lifetime_session';
const SESSION_DAYS = 30;

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password) {
  const data = new TextEncoder().encode(String(password || ''));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

export function makeSessionToken() {
  return crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
}

export function makeExpiryDate(days = SESSION_DAYS) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export function sessionCookie(token, expiresAt) {
  const expires = expiresAt instanceof Date ? expiresAt.toUTCString() : new Date(expiresAt).toUTCString();
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function getSessionToken(request) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/(?:^|; )lifetime_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export async function getCustomerBySession(env, request) {
  const token = getSessionToken(request);
  if (!token) return null;

  const row = await env.DB.prepare(`
    SELECT c.id, c.email, c.full_name, s.session_token, s.expires_at
    FROM customer_sessions s
    JOIN customers c ON c.id = s.customer_id
    WHERE s.session_token = ?
    LIMIT 1
  `).bind(token).first();

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare(`DELETE FROM customer_sessions WHERE session_token = ?`).bind(token).run();
    return null;
  }
  return row;
}

export async function requireCustomer(context) {
  const customer = await getCustomerBySession(context.env, context.request);
  if (!customer) return { response: error('Unauthorized.', 401), customer: null };
  return { response: null, customer };
}
