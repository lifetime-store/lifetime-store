import { error, ok, optionsResponse } from '../../_lib/response.js';
import { readJson, toFloat } from '../../_lib/parse.js';
import { requireAdmin } from '../../_lib/auth.js';

function makeReference() {
  const shortId = crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
  return `LT-DF-${Date.now()}-${shortId}`;
}
function makeFeeCode() {
  return `LT-FEE-${crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
}

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestPost(context) {
  const unauthorized = requireAdmin(context); if (unauthorized) return unauthorized;
  const env = context.env;
  if (!env.PAYSTACK_SECRET_KEY) return error('PAYSTACK_SECRET_KEY is missing.', 500);
  const body = await readJson(context.request);
  const orderId = Number(body.order_id || 0);
  const amount = toFloat(body.amount_ngn, 0);
  const reason = String(body.reason || '').trim();
  if (!orderId || amount <= 0 || !reason) return error('order_id, amount_ngn, and reason are required.', 400);
  const order = await env.DB.prepare(`SELECT * FROM orders WHERE id = ? LIMIT 1`).bind(orderId).first();
  if (!order) return error('Order not found.', 404);
  const delivery = await env.DB.prepare(`SELECT * FROM deliveries WHERE order_id = ? LIMIT 1`).bind(orderId).first();
  if (!delivery) return error('Delivery record not found for this order.', 404);
  const feeCode = makeFeeCode();
  const reference = makeReference();
  await env.DB.prepare(`INSERT INTO delivery_fee_requests (order_id, delivery_id, fee_code, amount_ngn, reason, status, created_by) VALUES (?, ?, ?, ?, ?, 'requested', ?)`).bind(orderId, delivery.id, feeCode, amount, reason, 'admin').run();
  const origin = new URL(context.request.url).origin;
  const callbackUrl = `${origin}/api/paystack/verify?delivery_fee=${encodeURIComponent(feeCode)}`;
  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
    body: JSON.stringify({
      email: order.email,
      amount: Math.round(amount * 100),
      currency: 'NGN',
      reference,
      callback_url: callbackUrl,
      metadata: { payment_mode: 'delivery_fee', fee_code: feeCode, order_number: order.order_number, delivery_tracking: delivery.tracking_number }
    })
  });
  const data = await paystackRes.json();
  if (!paystackRes.ok || !data.status || !data.data?.authorization_url) return error(data.message || 'Failed to initialize delivery fee payment.', 500, data);
  await env.DB.prepare(`UPDATE delivery_fee_requests SET paystack_reference = ?, updated_at = CURRENT_TIMESTAMP WHERE fee_code = ?`).bind(reference, feeCode).run();
  return ok({ authorizationUrl: data.data.authorization_url, feeCode, trackingNumber: delivery.tracking_number, message: 'Delivery fee request created.' });
}
