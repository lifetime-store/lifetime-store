import { requireAdmin } from '../../_lib/auth.js';
import { error, ok, optionsResponse } from '../../_lib/response.js';
import { readJson } from '../../_lib/parse.js';
import { addDeliveryUpdate } from '../../_lib/delivery.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context); if (unauthorized) return unauthorized;
  const deliveries = await context.env.DB.prepare(`SELECT d.*, o.customer_name, o.email, o.total, o.status AS order_status FROM deliveries d JOIN orders o ON o.id = d.order_id ORDER BY d.updated_at DESC, d.id DESC LIMIT 200`).all();
  const feeRequests = await context.env.DB.prepare(`SELECT * FROM delivery_fee_requests ORDER BY updated_at DESC, id DESC LIMIT 200`).all();
  return ok({ deliveries: deliveries.results || [], feeRequests: feeRequests.results || [] });
}

export async function onRequestPost(context) {
  const unauthorized = requireAdmin(context); if (unauthorized) return unauthorized;
  const body = await readJson(context.request);
  const deliveryId = Number(body.delivery_id || 0);
  const action = String(body.action || 'update_status');
  if (!deliveryId) return error('delivery_id is required.', 400);
  const delivery = await context.env.DB.prepare(`SELECT * FROM deliveries WHERE id = ? LIMIT 1`).bind(deliveryId).first();
  if (!delivery) return error('Delivery not found.', 404);

  if (action === 'create_fee_request') {
    const amount = Number(body.amount_ngn || 0);
    const reason = String(body.reason || '').trim();
    if (amount <= 0 || !reason) return error('amount_ngn and reason are required.', 400);
    const feeCode = `LT-FEE-${crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
    await context.env.DB.prepare(`INSERT INTO delivery_fee_requests (order_id, delivery_id, fee_code, amount_ngn, reason, status, created_by) VALUES (?, ?, ?, ?, ?, 'requested', ?)`)
      .bind(delivery.order_id, delivery.id, feeCode, amount, reason, String(body.created_by || 'team')).run();
    await addDeliveryUpdate(context.env, deliveryId, delivery.order_id, 'delivery_fee_requested', `Delivery fee requested: NGN ${amount}. ${reason}`, body.location_label || '', 1);
    return ok({ message: 'Delivery fee request created.', feeCode });
  }

  if (action === 'update_status') {
    const status = String(body.status || '').trim();
    if (!status) return error('status is required.', 400);
    await context.env.DB.prepare(`UPDATE deliveries SET courier_name = COALESCE(?, courier_name), delivery_type = COALESCE(?, delivery_type), assigned_staff_email = COALESCE(?, assigned_staff_email), eta_text = COALESCE(?, eta_text), updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(body.courier_name || null, body.delivery_type || null, body.assigned_staff_email || null, body.eta_text || null, deliveryId).run();
    await addDeliveryUpdate(context.env, deliveryId, delivery.order_id, status, String(body.note || ''), String(body.location_label || ''), 1);
    return ok({ message: 'Delivery updated.' });
  }
  return error('Unsupported action.', 400);
}
