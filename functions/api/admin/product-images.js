import { requireAdmin } from "../../_lib/auth.js";
import { error, ok, optionsResponse } from "../../_lib/response.js";
import { readJson, toInt } from "../../_lib/parse.js";

function dataUrlToObject(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1];
  const base64 = match[2];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  let extension = "jpg";
  if (mimeType.includes("png")) extension = "png";
  if (mimeType.includes("webp")) extension = "webp";
  if (mimeType.includes("gif")) extension = "gif";
  if (mimeType.includes("jpeg")) extension = "jpg";

  return { mimeType, bytes, extension };
}

function objectKeyFromUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.pathname.replace(/^\/+/, "");
  } catch {
    return null;
  }
}

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;

  const url = new URL(context.request.url);
  const productId = toInt(url.searchParams.get("product_id"));
  if (!productId) return error("product_id is required.", 400);

  const { results } = await context.env.DB.prepare(`
    SELECT id, product_id, data_url, alt_text, is_primary, sort_order, created_at
    FROM product_images
    WHERE product_id = ?
    ORDER BY is_primary DESC, sort_order ASC, id ASC
  `).bind(productId).all();

  return ok({ images: results || [] });
}

export async function onRequestPost(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;

  if (!context.env.BUCKET) {
    return error("R2 bucket binding BUCKET is missing.", 500);
  }

  if (!context.env.R2_PUBLIC_BASE_URL) {
    return error("R2_PUBLIC_BASE_URL is missing.", 500);
  }

  const body = await readJson(context.request);
  const action = body.action || "upload";

  if (action === "upload") {
    const productId = toInt(body.product_id);
    const sortOrder = toInt(body.sort_order, 0);
    const isPrimary = body.is_primary ? 1 : 0;
    const dataUrl = String(body.data_url || "");
    const altText = String(body.alt_text || "");

    if (!productId || !dataUrl.startsWith("data:image/")) {
      return error("product_id and an image data_url are required.", 400);
    }

    const fileObject = dataUrlToObject(dataUrl);
    if (!fileObject) {
      return error("Invalid image format.", 400);
    }

    const key = `products/${productId}/${Date.now()}-${crypto.randomUUID()}.${fileObject.extension}`;

    await context.env.BUCKET.put(key, fileObject.bytes, {
      httpMetadata: {
        contentType: fileObject.mimeType
      }
    });

    const publicUrl = `${String(context.env.R2_PUBLIC_BASE_URL).replace(/\/$/, "")}/${key}`;

    if (isPrimary) {
      await context.env.DB.prepare(`
        UPDATE product_images
        SET is_primary = 0
        WHERE product_id = ?
      `).bind(productId).run();
    }

    const result = await context.env.DB.prepare(`
      INSERT INTO product_images (product_id, data_url, alt_text, is_primary, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).bind(productId, publicUrl, altText, isPrimary, sortOrder).run();

    if (!isPrimary) {
      const count = await context.env.DB.prepare(`
        SELECT COUNT(*) AS total
        FROM product_images
        WHERE product_id = ?
      `).bind(productId).first();

      if ((count?.total || 0) === 1) {
        await context.env.DB.prepare(`
          UPDATE product_images
          SET is_primary = 1
          WHERE id = ?
        `).bind(result.meta?.last_row_id).run();
      }
    }

    return ok({ message: "Image uploaded to R2." });
  }

  if (action === "set_primary") {
    const imageId = toInt(body.image_id);
    const productId = toInt(body.product_id);

    if (!imageId || !productId) {
      return error("image_id and product_id are required.", 400);
    }

    await context.env.DB.prepare(`
      UPDATE product_images
      SET is_primary = 0
      WHERE product_id = ?
    `).bind(productId).run();

    await context.env.DB.prepare(`
      UPDATE product_images
      SET is_primary = 1
      WHERE id = ?
    `).bind(imageId).run();

    return ok({ message: "Primary image updated." });
  }

  if (action === "delete") {
    const imageId = toInt(body.image_id);
    if (!imageId) return error("image_id is required.", 400);

    const image = await context.env.DB.prepare(`
      SELECT product_id, is_primary, data_url
      FROM product_images
      WHERE id = ?
      LIMIT 1
    `).bind(imageId).first();

    if (!image) return error("Image not found.", 404);

    const objectKey = objectKeyFromUrl(image.data_url);
    if (objectKey) {
      await context.env.BUCKET.delete(objectKey);
    }

    await context.env.DB.prepare(`
      DELETE FROM product_images
      WHERE id = ?
    `).bind(imageId).run();

    if (image.is_primary) {
      const next = await context.env.DB.prepare(`
        SELECT id
        FROM product_images
        WHERE product_id = ?
        ORDER BY sort_order ASC, id ASC
        LIMIT 1
      `).bind(image.product_id).first();

      if (next?.id) {
        await context.env.DB.prepare(`
          UPDATE product_images
          SET is_primary = 1
          WHERE id = ?
        `).bind(next.id).run();
      }
    }

    return ok({ message: "Image deleted from R2 and database." });
  }

  return error("Unsupported action.", 400);
}
