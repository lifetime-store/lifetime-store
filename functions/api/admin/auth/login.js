import { adminLoginResponse, adminSupportsPassword } from "../../../_lib/auth.js";
import { error, optionsResponse } from "../../../_lib/response.js";
import { readJson } from "../../../_lib/parse.js";

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const { username = "", password = "", token = "" } = body;
  const locked = await requireLoginAvailability(context.env, context.request, 'admin', username || token || 'admin');
  if (locked) return locked;

  if (token) {
    if (token !== context.env.ADMIN_TOKEN) {
      await recordLoginFailure(context.env, context.request, 'admin', username || token || 'admin');
      return error("Invalid admin token.", 401);
    }
    await clearLoginFailures(context.env, context.request, 'admin', username || token || 'admin');
    return adminLoginResponse("Studio access granted.", context.env.ADMIN_TOKEN);
  }

  if (!adminSupportsPassword(context.env)) {
    return error("Set ADMIN_USERNAME and ADMIN_PASSWORD in Cloudflare, or sign in with your admin token.", 400);
  }

  if (username !== context.env.ADMIN_USERNAME || password !== context.env.ADMIN_PASSWORD) {
    await recordLoginFailure(context.env, context.request, 'admin', username || 'admin');
    return error("Invalid admin username or password.", 401);
  }

  await clearLoginFailures(context.env, context.request, 'admin', username || 'admin');
  return adminLoginResponse("Studio access granted.", context.env.ADMIN_TOKEN);
}
