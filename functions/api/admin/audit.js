
import { requireAdmin } from '../../_lib/auth.js';
import { ok, error, optionsResponse } from '../../_lib/response.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;
  try {
    const { results } = await context.env.DB.prepare(`
      SELECT id, actor, action, target_type, target_id, details, created_at
      FROM admin_audit_logs
      ORDER BY id DESC
      LIMIT 120
    `).all();
    return ok({ logs: results || [] });
  } catch (err) {
    return error(err.message || 'Could not load audit logs.', 500);
  }
}
