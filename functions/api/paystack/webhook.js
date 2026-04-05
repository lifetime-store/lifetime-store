import { ok, optionsResponse, error } from "../../_lib/response.js";
import { computePaystackSignature } from "../../_lib/paystack.js";
import { sendOrderAlerts } from "../../_lib/mail.js";

async function loadOrder(env, orderNumber) {
  return env.DB.prepare(`
    SELECT id, total, notes, status, order_number, customer_name, email, phone, country, city, address, currency
    FROM orders
    WHERE order_number = ?
    LIMIT 1
  `).bind(orderNumber).first();
}

async function loadOrderItems(env, orderId) {
  const { results } = await env.DB.prepare(`
    SELECT product_name, color, size, quantity
    FROM order_items
    WHERE order_id = ?
    ORDER BY id ASC
  `).bind(orderId).all();
  return results || [];
}

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestPost(context) {
  const signature = context.request.headers.get('x-paystack-signature') || '';
  const secret = context.env.PAYSTACK_SECRET_KEY;
  if (!secret) return error('PAYSTACK_SECRET_KEY is missing.', 500);

  const rawBody = await context.request.text();
  const expected = await computePaystackSignature(secret, rawBody);
  if (!signature || signature !== expected) {
    return error('Invalid webhook signature.', 401);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return error('Invalid webhook payload.', 400);
  }

  if (payload.event !== 'charge.success' || !payload.data) {
    return ok({ message: 'Webhook received.' });
  }

  const tx = payload.data;
  const orderNumber = tx.metadata?.order_number || '';
  if (!orderNumber) return ok({ message: 'No order metadata found.' });

  const order = await loadOrder(context.env, orderNumber);
  if (!order) return ok({ message: 'Order not found.' });

  const expectedAmount = Math.round(Number(order.total || 0) * 100);
  const paidAmount = Number(tx.amount || 0);
  if (tx.status !== 'success' || expectedAmount !== paidAmount) {
    return ok({ message: 'Webhook ignored: status or amount mismatch.' });
  }

  const alreadyPaid = order.status === 'paid';
  await context.env.DB.prepare(`
    UPDATE orders
    SET status = ?, notes = ?
    WHERE order_number = ?
  `).bind(
    'paid',
    `${order.notes ? `${order.notes} | ` : ''}Paid via Paystack webhook. Ref: ${tx.reference}`,
    orderNumber
  ).run();

  if (!alreadyPaid) {
    const items = await loadOrderItems(context.env, order.id);
    try {
      await sendOrderAlerts(context.env, { ...order, status: 'paid' }, items, 'Paid order received');
    } catch (mailError) {
      console.error('Webhook order email failed', mailError);
    }
  }

  return ok({ message: 'Webhook processed.' });
}
