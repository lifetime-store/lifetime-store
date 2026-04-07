import { error } from './response.js';

export async function verifyHumanCheck(env, token, ip = '') {
  if (!env.TURNSTILE_SECRET_KEY) return { ok: true, skipped: true };
  if (!token) return { ok: false, message: 'Human check is required.' };
  const body = new URLSearchParams();
  body.set('secret', env.TURNSTILE_SECRET_KEY);
  body.set('response', token);
  if (ip) body.set('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) return { ok: false, message: 'Human check failed.' };
  return { ok: true };
}

export function humanCheckError(message = 'Human check failed.') {
  return error(message, 400);
}
