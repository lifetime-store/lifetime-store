import { ok, error, optionsResponse } from '../../_lib/response.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const identifier = String(context.params.orderNumber || '').trim();
  const email = String(new URL(context.request.url).searchParams.get('email') || '').trim();
  if (!identifier) return error('order number or tracking number is required.', 400);

  let order = null;
  let delivery = null;
  const isTracking = identifier.toUpperCase().startsWith('LT-TRK-');

  if (isTracking) {
    const sql = `SELECT d.*, o.id as order_id, o.order_number, o.customer_name, o.email, o.phone, o.address, o.status as order_status, o.total, o.currency, o.created_at, o.country, o.city
      FROM deliveries d JOIN orders o ON o.id = d.order_id
      WHERE d.tracking_number = ? ${email ? 'AND lower(o.email) = lower(?)' : ''}
      LIMIT 1`;
    const stmt = context.env.DB.prepare(sql);
    delivery = email ? await stmt.bind(identifier, email).first() : await stmt.bind(identifier).first();
    if (!delivery) return error('Tracking record not found.', 404);
    order = {
      id: delivery.order_id,
      order_number: delivery.order_number,
      customer_name: delivery.customer_name,
      email: delivery.email,
      status: delivery.order_status,
      total: delivery.total,
      currency: delivery.currency,
      created_at: delivery.created_at,
      country: delivery.country,
      city: delivery.city,
      phone: delivery.phone,
      address: delivery.address
    };
  } else {
    if (!email) return error('Email is required when using order number.', 400);
    order = await context.env.DB.prepare(`SELECT id, order_number, customer_name, email, phone, address, status, total, currency, created_at, promo_code, promo_discount, tier_discount, country, city FROM orders WHERE order_number = ? AND lower(email) = lower(?) LIMIT 1`).bind(identifier, email).first();
    if (!order) return error('Order not found.', 404);
    delivery = await context.env.DB.prepare(`SELECT * FROM deliveries WHERE order_id = ? LIMIT 1`).bind(order.id).first();
  }

  const hist = await context.env.DB.prepare(`SELECT status, note, created_at FROM order_status_history WHERE order_id = ? ORDER BY id ASC`).bind(order.id).all();
  const deliveryHistory = delivery ? await context.env.DB.prepare(`SELECT status, note, location_label, created_at FROM delivery_updates WHERE delivery_id = ? AND visible_to_customer = 1 ORDER BY id ASC`).bind(delivery.id).all() : { results: [] };
  const fees = delivery ? await context.env.DB.prepare(`SELECT fee_code, amount_ngn, reason, status, created_at, paid_at FROM delivery_fee_requests WHERE delivery_id = ? ORDER BY id DESC`).bind(delivery.id).all() : { results: [] };
  const addressConfirmation = await context.env.DB.prepare(`SELECT recipient_name, recipient_phone, country, city, address, note, status, confirmed_at FROM delivery_address_confirmations WHERE order_id = ? LIMIT 1`).bind(order.id).first();
  return ok({ order, history: hist.results || [], delivery, deliveryHistory: deliveryHistory.results || [], deliveryFees: fees.results || [], addressConfirmation });
}
