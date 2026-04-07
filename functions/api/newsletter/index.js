import { ok, error, optionsResponse } from '../../_lib/response.js';
import { readJson } from '../../_lib/parse.js';
import { verifyHumanCheck } from '../../_lib/human-check.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const email = String(body.email || '').trim().toLowerCase();
  const fullName = String(body.full_name || '').trim();
  const human = await verifyHumanCheck(context.env, body.human_token, context.request.headers.get('cf-connecting-ip') || '');
  if (!human.ok) return error(human.message, 400);
  if (!email || !email.includes('@')) return error('A valid email is required.', 400);
  await context.env.DB.prepare(`
    INSERT INTO newsletter_subscribers (email, full_name, source, status, created_at, updated_at)
    VALUES (?, ?, 'website', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(email) DO UPDATE SET full_name = COALESCE(excluded.full_name, newsletter_subscribers.full_name), status = 'active', updated_at = CURRENT_TIMESTAMP
  `).bind(email, fullName || null).run();
  return ok({ message: 'You are now on the Lifetime update list.' });
}
