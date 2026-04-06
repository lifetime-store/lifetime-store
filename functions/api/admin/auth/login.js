import { adminLoginResponse, adminSupportsPassword } from "../../../_lib/auth.js";
import { error, optionsResponse } from "../../../_lib/response.js";
import { readJson } from "../../../_lib/parse.js";

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const { username = "", password = "", token = "" } = body;

  if (token) {
    if (token !== context.env.ADMIN_TOKEN) {
      return error("Invalid admin token.", 401);
    }
    return adminLoginResponse("Studio access granted.", context.env.ADMIN_TOKEN);
  }

  if (!adminSupportsPassword(context.env)) {
    return error("Set ADMIN_USERNAME and ADMIN_PASSWORD in Cloudflare, or sign in with your admin token.", 400);
  }

  if (username !== context.env.ADMIN_USERNAME || password !== context.env.ADMIN_PASSWORD) {
    return error("Invalid admin username or password.", 401);
  }

  return adminLoginResponse("Studio access granted.", context.env.ADMIN_TOKEN);
}
