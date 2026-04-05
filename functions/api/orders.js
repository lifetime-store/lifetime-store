
import { error, ok, optionsResponse } from "../_lib/response.js";
import { readJson, toFloat } from "../_lib/parse.js";

function makeOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const shortId = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `LT-ORD-${date}-${shortId}`;
}

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const {
    customer_name,
    email,
    phone = "",
    country = "",
    city = "",
    address = "",
    notes = "",
    currency = "NGN",
    items = [],
    shipping = 0
  } = body;

  if (!customer_name || !email || !Array.isArray(items) || items.length === 0) {
    return error("customer_name, email, and at least one item are required.", 400);
  }

  const subtotal = items.reduce((sum, item) => sum + (Number(item.unit_price) * Number(item.quantity || 1)), 0);
  const shippingValue = toFloat(shipping, 0);
  const total = subtotal + shippingValue;
  const orderNumber = makeOrderNumber();

  const orderInsert = await context.env.DB.prepare(`
    INSERT INTO orders (
      order_number, customer_name, email, phone, country, city, address, notes, currency, subtotal, shipping, total
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    orderNumber,
    customer_name,
    email,
    phone,
    country,
    city,
    address,
    notes,
    currency,
    subtotal,
    shippingValue,
    total
  ).run();

  const orderId = orderInsert.meta?.last_row_id;

  for (const item of items) {
    await context.env.DB.prepare(`
      INSERT INTO order_items (
        order_id, product_id, variant_id, product_name, sku, size, color, quantity, unit_price, currency
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      orderId,
      item.product_id || null,
      item.variant_id || null,
      item.product_name || "Unknown Product",
      item.sku || null,
      item.size || "",
      item.color || "",
      Number(item.quantity || 1),
      Number(item.unit_price || 0),
      currency
    ).run();
  }

  return ok({
    orderNumber,
    message: "Order request received."
  });
}
