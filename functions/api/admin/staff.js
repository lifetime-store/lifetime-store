import { requireAdmin } from '../../_lib/auth.js';
import { error, ok, optionsResponse } from '../../_lib/response.js';
import { readJson } from '../../_lib/parse.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;
  try {
    const { results } = await context.env.DB.prepare(`SELECT * FROM admin_staff ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, role ASC, id DESC`).all();
    return ok({ staff: results || [] });
  } catch (error) {
    return ok({ staff: [] });
  }
}

export async function onRequestPost(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;
  const body = await readJson(context.request);
  const action = body.action || (body.id ? 'update' : 'create');

  if (action === 'delete') {
    if (!body.id) return error('Staff id is required.', 400);
    await context.env.DB.prepare(`DELETE FROM admin_staff WHERE id = ?`).bind(body.id).run();
    return ok({ message: 'Staff access removed.' });
  }

  const fullName = String(body.full_name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const role = String(body.role || 'operations').trim();
  const status = String(body.status || 'active').trim();
  const accessScope = String(body.access_scope || '').trim();
  if (!fullName || !email) return error('Full name and email are required.', 400);

  if (action === 'update') {
    await context.env.DB.prepare(`UPDATE admin_staff SET full_name = ?, email = ?, role = ?, status = ?, access_scope = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(fullName, email, role, status, accessScope, body.id).run();
    return ok({ message: 'Staff access updated.' });
  }

  await context.env.DB.prepare(`INSERT INTO admin_staff (full_name, email, role, status, access_scope) VALUES (?, ?, ?, ?, ?)`).bind(fullName, email, role, status, accessScope).run();
  return ok({ message: 'Staff access created.' });
}
