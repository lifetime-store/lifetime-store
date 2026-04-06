import { getAdminCredential, requireAdmin } from "../../../_lib/auth.js";
import { ok, optionsResponse } from "../../../_lib/response.js";

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;

  return ok({
    authenticated: true,
    authMode: getAdminCredential(context) === context.env.ADMIN_TOKEN ? "session_or_token" : "unknown"
  });
}
