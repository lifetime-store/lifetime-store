export function makeTrackingNumber(orderNumber = '') {
  const tail = crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
  const compact = String(orderNumber || '').replace(/[^A-Z0-9]/gi, '').slice(-6).toUpperCase();
  return `LT-TRK-${compact || 'ORDER'}-${tail}`;
}

export function inferDeliveryType(country = '') {
  const c = String(country || '').trim().toLowerCase();
  if (!c || c === 'nigeria') return 'local';
  return 'international';
}

export async function ensureDeliveryForOrder(env, order) {
  const existing = await env.DB.prepare(`SELECT * FROM deliveries WHERE order_id = ? LIMIT 1`).bind(order.id).first();
  if (existing) return existing;
  const trackingNumber = makeTrackingNumber(order.order_number);
  const deliveryType = inferDeliveryType(order.country);
  await env.DB.prepare(`
    INSERT INTO deliveries (
      order_id, order_number, tracking_number, delivery_type, courier_name,
      status, recipient_name, recipient_phone, destination_country, destination_city, latest_note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    order.id,
    order.order_number,
    trackingNumber,
    deliveryType,
    'Lifetime Delivery',
    'payment_confirmed',
    order.customer_name,
    order.phone || '',
    order.country || '',
    order.city || '',
    'Tracking created automatically after successful payment.'
  ).run();
  const created = await env.DB.prepare(`SELECT * FROM deliveries WHERE order_id = ? LIMIT 1`).bind(order.id).first();
  if (created?.id) {
    await env.DB.prepare(`INSERT INTO delivery_updates (delivery_id, status, note, location_label) VALUES (?, ?, ?, ?)`).bind(created.id, 'payment_confirmed', 'Order paid successfully and moved into processing.', order.city || order.country || 'Warehouse').run();
    await env.DB.prepare(`INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)`).bind(order.id, 'payment_confirmed', `Tracking created: ${trackingNumber}`).run();
  }
  return created;
}

export async function addDeliveryUpdate(env, deliveryId, orderId, status, note = '', locationLabel = '', visibleToCustomer = 1) {
  let extraSql = '';
  if (status === 'shipped') extraSql += ', shipped_at = COALESCE(shipped_at, CURRENT_TIMESTAMP)';
  if (status === 'delivered') extraSql += ', delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)';
  await env.DB.prepare(`UPDATE deliveries SET status = ?, latest_note = ?, updated_at = CURRENT_TIMESTAMP ${extraSql} WHERE id = ?`).bind(status, note || status, deliveryId).run();
  await env.DB.prepare(`INSERT INTO delivery_updates (delivery_id, status, note, location_label, visible_to_customer) VALUES (?, ?, ?, ?, ?)`).bind(deliveryId, status, note || '', locationLabel || '', visibleToCustomer ? 1 : 0).run();
  if (orderId) await env.DB.prepare(`INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)`).bind(orderId, status, note || '').run();
}
