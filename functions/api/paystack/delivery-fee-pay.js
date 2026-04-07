import { error, ok, optionsResponse } from '../../_lib/response.js';
import { readJson } from '../../_lib/parse.js';

function makeReference() {
  const shortId = crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
  return `LT-DF-${Date.now()}-${shortId}`;
}

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestPost(context) {
  const env = context.env;
  if (!env.PAYSTACK_SECRET_KEY) return error('PAYSTACK_SECRET_KEY is missing.', 500);
  const body = await readJson(context.request);
  const feeCode = String(body.fee_code || '').trim();
  if (!feeCode) return error('fee_code is required.', 400);
  const fee = await env.DB.prepare(`SELECT f.*, o.order_number, o.email, d.tracking_number FROM delivery_fee_requests f JOIN orders o ON o.id = f.order_id JOIN deliveries d ON d.id = f.delivery_id WHERE f.fee_code = ? LIMIT 1`).bind(feeCode).first();
  if (!fee) return error('Delivery fee request not found.', 404);
  if (fee.status === 'paid') return error('This delivery fee is already paid.', 400);
  const reference = makeReference();
  const origin = new URL(context.request.url).origin;
  const callbackUrl = `${origin}/api/paystack/verify?delivery_fee=${encodeURIComponent(feeCode)}`;
  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
    body: JSON.stringify({
      email: fee.email,
      amount: Math.round(Number(fee.amount_ngn || 0) * 100),
      currency: 'NGN',
      reference,
      callback_url: callbackUrl,
      metadata: { payment_mode: 'delivery_fee', fee_code: fee.fee_code, order_number: fee.order_number, delivery_tracking: fee.tracking_number }
    })
  });
  const data = await paystackRes.json();
  if (!paystackRes.ok || !data.status || !data.data?.authorization_url) return error(data.message || 'Failed to initialize delivery fee payment.', 500, data);
  await env.DB.prepare(`UPDATE delivery_fee_requests SET paystack_reference = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(reference, fee.id).run();
  return ok({ authorizationUrl: data.data.authorization_url, feeCode, message: 'Delivery fee payment initialized.' });
}
