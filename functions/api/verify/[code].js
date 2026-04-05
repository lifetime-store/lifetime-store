
import { error, ok, optionsResponse } from "../../_lib/response.js";

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const code = decodeURIComponent(context.params.code || "").trim();

  if (!code) return error("No authenticity code provided.", 400);

  const item = await context.env.DB.prepare(`
    SELECT
      ac.id,
      ac.serial_code,
      ac.status,
      ac.first_scan_at,
      ac.scan_count,
      ac.activated_at,
      b.batch_code,
      b.factory_name,
      b.manufactured_at,
      p.name AS product_name,
      p.slug,
      COALESCE(v.color, '') AS color,
      COALESCE(v.size, '') AS size
    FROM auth_codes ac
    JOIN products p ON p.id = ac.product_id
    LEFT JOIN variants v ON v.id = ac.variant_id
    JOIN batches b ON b.id = ac.batch_id
    WHERE ac.serial_code = ?
    LIMIT 1
  `).bind(code).first();

  if (!item) {
    return ok({
      valid: false,
      authenticity: "unknown",
      message: "This code does not exist in the Lifetime verification registry.",
      item: null
    });
  }

  if (item.status === "active") {
    await context.env.DB.prepare(`
      UPDATE auth_codes
      SET
        scan_count = scan_count + 1,
        first_scan_at = COALESCE(first_scan_at, CURRENT_TIMESTAMP)
      WHERE id = ?
    `).bind(item.id).run();

    item.scan_count = (item.scan_count || 0) + 1;
    item.first_scan_at = item.first_scan_at || new Date().toISOString();
  }

  const authenticity =
    item.status === "active" ? "verified"
    : item.status === "draft" ? "pending_activation"
    : "void";

  return ok({
    valid: item.status === "active",
    authenticity,
    message:
      authenticity === "verified"
        ? "Authentic Lifetime item."
        : authenticity === "pending_activation"
          ? "This code exists but is not active for sale yet."
          : "This code exists but has been voided or replaced.",
    item
  });
}
