import { error } from './response.js';

function clientIp(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
}

function keyFor(identifier, request) {
  const clean = String(identifier || '').trim().toLowerCase() || clientIp(request);
  return `${clean}|${clientIp(request)}`;
}

export async function requireLoginAvailability(env, request, scope, identifier) {
  const row = await env.DB.prepare(`SELECT fail_count, locked_until FROM login_attempts WHERE scope = ? AND identifier = ? LIMIT 1`).bind(scope, keyFor(identifier, request)).first();
  if (row?.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    return error('Too many login attempts. Please wait 15 minutes and try again.', 429);
  }
  return null;
}

export async function recordLoginFailure(env, request, scope, identifier) {
  const key = keyFor(identifier, request);
  const existing = await env.DB.prepare(`SELECT id, fail_count FROM login_attempts WHERE scope = ? AND identifier = ? LIMIT 1`).bind(scope, key).first();
  const nextCount = Number(existing?.fail_count || 0) + 1;
  const lock = nextCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
  if (existing?.id) {
    await env.DB.prepare(`UPDATE login_attempts SET fail_count = ?, locked_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(nextCount, lock, existing.id).run();
  } else {
    await env.DB.prepare(`INSERT INTO login_attempts (scope, identifier, fail_count, locked_until) VALUES (?, ?, ?, ?)`).bind(scope, key, nextCount, lock).run();
  }
}

export async function clearLoginFailures(env, request, scope, identifier) {
  await env.DB.prepare(`DELETE FROM login_attempts WHERE scope = ? AND identifier = ?`).bind(scope, keyFor(identifier, request)).run();
}
