import { ok, error, optionsResponse } from '../../_lib/response.js';
import { readJson } from '../../_lib/parse.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const orderNumber = String(body.order_number || '').trim();
  const email = String(body.email || '').trim();
  const recipientName = String(body.recipient_name || '').trim();
  const recipientPhone = String(body.recipient_phone || '').trim();
  const country = String(body.country || '').trim();
  const city = String(body.city || '').trim();
  const address = String(body.address || '').trim();
  const note = String(body.note || '').trim();
  if (!orderNumber || !email || !recipientName || !recipientPhone || !address) return error('Order, email, recipient, phone, and address are required.', 400);
  const order = await context.env.DB.prepare(`SELECT id FROM orders WHERE order_number = ? AND lower(email) = lower(?) LIMIT 1`).bind(orderNumber, email).first();
  if (!order) return error('Order not found.', 404);
  await context.env.DB.prepare(`UPDATE orders SET customer_name = ?, phone = ?, country = ?, city = ?, address = ? WHERE id = ?`).bind(recipientName, recipientPhone, country, city, address, order.id).run();
  await context.env.DB.prepare(`
    INSERT INTO delivery_address_confirmations (order_id, recipient_name, recipient_phone, country, city, address, note, status, confirmed_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(order_id) DO UPDATE SET recipient_name = excluded.recipient_name, recipient_phone = excluded.recipient_phone, country = excluded.country, city = excluded.city, address = excluded.address, note = excluded.note, status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
  `).bind(order.id, recipientName, recipientPhone, country, city, address, note).run();
  const delivery = await context.env.DB.prepare(`SELECT id FROM deliveries WHERE order_id = ? LIMIT 1`).bind(order.id).first();
  if (delivery?.id) {
    await context.env.DB.prepare(`UPDATE deliveries SET recipient_name = ?, recipient_phone = ?, destination_country = ?, destination_city = ?, latest_note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(recipientName, recipientPhone, country, city, note || 'Customer confirmed delivery details.', delivery.id).run();
    await context.env.DB.prepare(`INSERT INTO delivery_updates (delivery_id, status, note, location_label, visible_to_customer) VALUES (?, 'address_confirmed', ?, ?, 1)`).bind(delivery.id, note || 'Customer confirmed delivery details.', city || country || 'Delivery profile').run();
  }
  await context.env.DB.prepare(`INSERT INTO order_status_history (order_id, status, note) VALUES (?, 'address_confirmed', ?)`).bind(order.id, note || 'Customer confirmed delivery details.').run();
  return ok({ message: 'Delivery details confirmed.' });
}
