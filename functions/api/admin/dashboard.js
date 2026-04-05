import { dashboardSummary } from "../../_lib/db.js";
import { requireAdmin } from "../../_lib/auth.js";
import { ok, optionsResponse } from "../../_lib/response.js";

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;

  const summary = await dashboardSummary(context.env);
  return ok({ summary });
}
