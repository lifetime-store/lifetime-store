
import { error } from "./response.js";

export function requireAdmin(context) {
  const requestToken = context.request.headers.get("x-admin-token");
  const envToken = context.env.ADMIN_TOKEN;

  if (!envToken || envToken === "CHANGE_THIS_BEFORE_DEPLOY") {
    return error("Admin token is not configured on the server.", 500);
  }

  if (!requestToken || requestToken !== envToken) {
    return error("Unauthorized. Invalid admin token.", 401);
  }

  return null;
}
