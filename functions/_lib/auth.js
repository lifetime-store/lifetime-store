import { error, json } from "./response.js";

export const ADMIN_COOKIE_NAME = "lt_admin_session";

export function getCookies(request) {
  const raw = request.headers.get("cookie") || "";
  return raw.split(/;\s*/).filter(Boolean).reduce((acc, part) => {
    const index = part.indexOf("=");
    if (index === -1) return acc;
    const key = decodeURIComponent(part.slice(0, index).trim());
    const value = decodeURIComponent(part.slice(index + 1).trim());
    acc[key] = value;
    return acc;
  }, {});
}

export function getAdminCredential(context) {
  const headerToken = context.request.headers.get("x-admin-token");
  const cookieToken = getCookies(context.request)[ADMIN_COOKIE_NAME];
  return headerToken || cookieToken || "";
}

export function requireAdmin(context) {
  const envToken = context.env.ADMIN_TOKEN;

  if (!envToken || envToken === "CHANGE_THIS_BEFORE_DEPLOY") {
    return error("Admin token is not configured on the server.", 500);
  }

  if (getAdminCredential(context) !== envToken) {
    return error("Unauthorized. Sign in to Studio LT.", 401);
  }

  return null;
}

export function adminCookieHeader(token, maxAgeSeconds = 60 * 60 * 12) {
  return `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}`;
}

export function clearAdminCookieHeader() {
  return `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function adminLoginResponse(message, token) {
  return json({ ok: true, message }, 200, {
    "set-cookie": adminCookieHeader(token)
  });
}

export function adminLogoutResponse(message = "Signed out.") {
  return json({ ok: true, message }, 200, {
    "set-cookie": clearAdminCookieHeader()
  });
}

export function adminSupportsPassword(env) {
  return Boolean(env.ADMIN_USERNAME && env.ADMIN_PASSWORD);
}
