
import { requireAdmin } from "../../_lib/auth.js";
import { ok, optionsResponse } from "../../_lib/response.js";

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;

  const { results } = await context.env.DB.prepare(`
    SELECT * FROM issues ORDER BY created_at DESC LIMIT 200
  `).all();

  return ok({ issues: results || [] });
}
