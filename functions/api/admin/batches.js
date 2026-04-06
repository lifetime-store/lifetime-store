import { requireAdmin } from "../../_lib/auth.js";
import { getBatchWithProduct } from "../../_lib/db.js";
import { makeBatchCode } from "../../_lib/codes.js";
import { error, ok, optionsResponse } from "../../_lib/response.js";
import { readJson, toInt } from "../../_lib/parse.js";

const VALID_STAGES = new Set([
  "batch_created",
  "generated",
  "printed",
  "attached",
  "received",
  "active",
  "closed",
  "blocked"
]);

function codeStatusForBatchStage(stage) {
  if (["generated", "printed", "attached", "received"].includes(stage)) return stage;
  if (stage === "active") return "active";
  if (stage === "blocked") return "blocked";
  if (stage === "closed") return "archived";
  return null;
}

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;

  const url = new URL(context.request.url);
  const batchId = toInt(url.searchParams.get("batch_id"));

  const sql = `
    SELECT
      b.*,
      p.name AS product_name,
      p.short_code,
      COALESCE(v.color, '') AS color,
      COALESCE(v.size, '') AS size,
      (
        SELECT COUNT(*) FROM auth_codes ac WHERE ac.batch_id = b.id
      ) AS code_count,
      (
        SELECT COUNT(*) FROM auth_codes ac WHERE ac.batch_id = b.id AND ac.status = 'active'
      ) AS active_code_count,
      (
        SELECT COUNT(*) FROM auth_codes ac WHERE ac.batch_id = b.id AND ac.status IN ('generated','printed','attached','received','draft')
      ) AS pending_code_count
    FROM batches b
    JOIN products p ON p.id = b.product_id
    LEFT JOIN variants v ON v.id = b.variant_id
    ${batchId ? 'WHERE b.id = ?' : ''}
    ORDER BY b.id DESC
  `;

  const result = batchId
    ? await context.env.DB.prepare(sql).bind(batchId).all()
    : await context.env.DB.prepare(sql).all();

  if (batchId) return ok({ batch: result.results?.[0] || null });
  return ok({ batches: result.results || [] });
}

export async function onRequestPost(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;

  const body = await readJson(context.request);
  const action = body.action || "create";

  if (action === "create") {
    const {
      product_id,
      variant_id = null,
      factory_name = "Lekki Garment Factory",
      quantity,
      status = "batch_created",
      manufactured_at = "",
      notes = ""
    } = body;

    if (!product_id || !quantity) {
      return error("product_id and quantity are required.", 400);
    }

    const product = await context.env.DB.prepare(`
      SELECT short_code FROM products WHERE id = ? LIMIT 1
    `).bind(product_id).first();

    if (!product) return error("Product not found.", 404);
    const stage = VALID_STAGES.has(status) ? status : "batch_created";
    const batchCode = makeBatchCode(product.short_code, quantity);

    const result = await context.env.DB.prepare(`
      INSERT INTO batches (
        batch_code, product_id, variant_id, factory_name, quantity, status, manufactured_at, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      batchCode,
      product_id,
      variant_id || null,
      factory_name,
      toInt(quantity),
      stage,
      manufactured_at || null,
      notes
    ).run();

    const batch = await getBatchWithProduct(context.env, result.meta?.last_row_id);
    return ok({ message: "Batch created.", batch });
  }

  const batchId = toInt(body.batch_id || body.id);
  if (!batchId) return error("batch_id is required.", 400);

  const batch = await getBatchWithProduct(context.env, batchId);
  if (!batch) return error("Batch not found.", 404);

  if (action === "set_status") {
    const stage = String(body.status || "").trim();
    if (!VALID_STAGES.has(stage)) return error("Unsupported batch status.", 400);

    await context.env.DB.prepare(`UPDATE batches SET status = ?, notes = COALESCE(notes, ?) WHERE id = ?`).bind(stage, batch.notes || '', batchId).run();

    const relatedCodeStatus = codeStatusForBatchStage(stage);
    if (relatedCodeStatus) {
      if (relatedCodeStatus === "active") {
        await context.env.DB.prepare(`
          UPDATE auth_codes
          SET status = 'active', activated_at = COALESCE(activated_at, CURRENT_TIMESTAMP)
          WHERE batch_id = ? AND status NOT IN ('void','blocked','archived')
        `).bind(batchId).run();
      } else {
        await context.env.DB.prepare(`
          UPDATE auth_codes
          SET status = ?
          WHERE batch_id = ? AND status NOT IN ('active','void','blocked','archived')
        `).bind(relatedCodeStatus, batchId).run();
      }
    }

    return ok({ message: `Batch moved to ${stage.replaceAll('_', ' ')}.` });
  }

  if (action === "activate") {
    await context.env.DB.prepare(`UPDATE batches SET status = 'active' WHERE id = ?`).bind(batchId).run();
    await context.env.DB.prepare(`
      UPDATE auth_codes
      SET status = 'active', activated_at = COALESCE(activated_at, CURRENT_TIMESTAMP)
      WHERE batch_id = ? AND status NOT IN ('void','blocked','archived')
    `).bind(batchId).run();
    return ok({ message: "Batch activated. Verification is now live." });
  }

  return error("Unsupported action.", 400);
}
