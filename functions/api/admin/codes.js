import { requireAdmin } from "../../_lib/auth.js";
import { makeSerialCode, yearShort } from "../../_lib/codes.js";
import { getBatchWithProduct } from "../../_lib/db.js";
import { error, ok, optionsResponse } from "../../_lib/response.js";
import { readJson, toInt } from "../../_lib/parse.js";

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;

  const url = new URL(context.request.url);
  const batchId = url.searchParams.get("batch_id");

  const baseQuery = `
    SELECT
      ac.id, ac.serial_code, ac.sequence, ac.status, ac.scan_count, ac.created_at, ac.activated_at, ac.qr_url,
      b.id AS batch_id, b.batch_code, b.status AS batch_status,
      p.name AS product_name,
      COALESCE(v.color, '') AS color,
      COALESCE(v.size, '') AS size
    FROM auth_codes ac
    JOIN batches b ON b.id = ac.batch_id
    JOIN products p ON p.id = ac.product_id
    LEFT JOIN variants v ON v.id = ac.variant_id
    ${batchId ? "WHERE ac.batch_id = ?" : ""}
    ORDER BY ac.id DESC
    LIMIT 500
  `;

  const result = batchId
    ? await context.env.DB.prepare(baseQuery).bind(batchId).all()
    : await context.env.DB.prepare(baseQuery).all();

  return ok({ codes: result.results || [] });
}

export async function onRequestPost(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;

  const body = await readJson(context.request);
  const action = body.action || "generate";

  if (action === "generate") {
    const batchId = toInt(body.batch_id);
    const quantity = toInt(body.quantity);

    if (!batchId || !quantity) {
      return error("batch_id and quantity are required for label generation.", 400);
    }

    const batch = await getBatchWithProduct(context.env, batchId);
    if (!batch) return error("Batch not found.", 404);

    const current = await context.env.DB.prepare(`
      SELECT MAX(sequence) AS max_sequence
      FROM auth_codes
      WHERE batch_id = ?
    `).bind(batchId).first();

    const start = (current?.max_sequence || 0) + 1;
    const year = yearShort();
    const generated = [];

    for (let i = 0; i < quantity; i += 1) {
      const sequence = start + i;
      const serial = makeSerialCode({
        year,
        productCode: batch.product_short_code,
        colorCode: batch.color_code || "GEN",
        sizeCode: batch.size_code || "OS",
        sequence
      });

      const qrUrl = `/verify.html?code=${encodeURIComponent(serial)}`;

      await context.env.DB.prepare(`
        INSERT INTO auth_codes (
          batch_id, product_id, variant_id, sequence, serial_code, status, qr_url
        ) VALUES (?, ?, ?, ?, ?, 'generated', ?)
      `).bind(
        batchId,
        batch.product_id,
        batch.variant_id,
        sequence,
        serial,
        qrUrl
      ).run();

      generated.push(serial);
    }

    await context.env.DB.prepare(`UPDATE batches SET status = 'generated' WHERE id = ?`).bind(batchId).run();
    return ok({ message: "Labels generated and kept inactive for manufacturing.", generatedCodes: generated });
  }

  if (action === "set_status") {
    const codes = Array.isArray(body.codes) ? body.codes : [];
    const status = String(body.status || "").trim();
    if (!codes.length || !status) return error("codes and status are required.", 400);

    for (const code of codes) {
      if (status === 'active') {
        await context.env.DB.prepare(`
          UPDATE auth_codes SET status = 'active', activated_at = COALESCE(activated_at, CURRENT_TIMESTAMP)
          WHERE serial_code = ?
        `).bind(String(code)).run();
      } else {
        await context.env.DB.prepare(`UPDATE auth_codes SET status = ? WHERE serial_code = ?`).bind(status, String(code)).run();
      }
    }

    return ok({ message: `Updated ${codes.length} code(s).` });
  }

  if (action === "activate") {
    const codes = Array.isArray(body.codes) ? body.codes : [];
    if (codes.length === 0) return error("Provide at least one code to activate.", 400);

    for (const code of codes) {
      await context.env.DB.prepare(`
        UPDATE auth_codes
        SET status = 'active', activated_at = CURRENT_TIMESTAMP
        WHERE serial_code = ?
      `).bind(String(code)).run();
    }

    return ok({ message: "Selected codes activated." });
  }

  if (action === "void") {
    const codes = Array.isArray(body.codes) ? body.codes : [];
    if (codes.length === 0) return error("Provide at least one code to void.", 400);

    for (const code of codes) {
      await context.env.DB.prepare(`
        UPDATE auth_codes
        SET status = 'void'
        WHERE serial_code = ?
      `).bind(String(code)).run();
    }

    return ok({ message: "Selected codes voided." });
  }

  return error("Unsupported action.", 400);
}
