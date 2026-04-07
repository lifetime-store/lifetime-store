import { sendOrderAlerts } from '../../_lib/mail.js';
import { incrementPromoUsage, refreshCustomerProfile } from '../../_lib/storefront.js';
import { ensureDeliveryForOrder, addDeliveryUpdate } from '../../_lib/delivery.js';

async function loadOrderItems(env, orderId) {
  const { results } = await env.DB.prepare(`
    SELECT id, product_id, variant_id, product_name, color, size, quantity, sku
    FROM order_items
    WHERE order_id = ?
    ORDER BY id ASC
  `).bind(orderId).all();
  return results || [];
}

async function notifyPaidIfNeeded(env, order) {
  if (order.status === 'paid') return;
  const items = await loadOrderItems(env, order.id);
  try {
    await sendOrderAlerts(env, { ...order, status: 'paid' }, items, 'Paid order received');
  } catch (mailError) {
    console.error('Paid order email alert failed', mailError);
  }
}

async function decrementStockForOrder(env, orderId) {
  const items = await loadOrderItems(env, orderId);
  for (const item of items) {
    if (item.variant_id) {
      await env.DB.prepare(`UPDATE variants SET stock = MAX(0, stock - ?) WHERE id = ?`).bind(Number(item.quantity || 0), item.variant_id).run();
    }
  }
}

export async function onRequestGet(context) {
  const env = context.env;
  const url = new URL(context.request.url);
  const reference = url.searchParams.get('reference');
  let orderNumber = url.searchParams.get('order') || '';

  if (!env.PAYSTACK_SECRET_KEY) {
    return new Response('PAYSTACK_SECRET_KEY is missing.', { status: 500 });
  }
  if (!reference) {
    return Response.redirect(`${url.origin}/checkout.html?paid=0&reason=missing_reference`, 302);
  }

  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` }
  });
  const verifyData = await verifyRes.json();
  if (!verifyRes.ok || !verifyData.status || !verifyData.data) {
    return Response.redirect(`${url.origin}/checkout.html?paid=0&reason=verify_failed`, 302);
  }

  const tx = verifyData.data;
  if (tx.metadata?.payment_mode === 'delivery_fee') {
    const feeCode = tx.metadata?.fee_code || '';
    const fee = feeCode ? await env.DB.prepare(`SELECT * FROM delivery_fee_requests WHERE fee_code = ? LIMIT 1`).bind(feeCode).first() : null;
    if (!fee) return Response.redirect(`${url.origin}/order-status.html?paid=0&reason=delivery_fee_not_found`, 302);
    if (tx.status === 'success') {
      await env.DB.prepare(`UPDATE delivery_fee_requests SET status = 'paid', paystack_reference = ?, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(reference, fee.id).run();
      const delivery = await env.DB.prepare(`SELECT * FROM deliveries WHERE id = ? LIMIT 1`).bind(fee.delivery_id).first();
      if (delivery) await addDeliveryUpdate(env, delivery.id, fee.order_id, 'delivery_fee_paid', `Delivery fee paid. ${fee.reason}`, delivery.destination_city || delivery.destination_country || 'Logistics');
      const orderRow = await env.DB.prepare(`SELECT order_number, email FROM orders WHERE id = ? LIMIT 1`).bind(fee.order_id).first();
      return Response.redirect(`${url.origin}/order-status.html?order=${encodeURIComponent(orderRow?.order_number || '')}&email=${encodeURIComponent(orderRow?.email || '')}&delivery_fee=paid`, 302);
    }
    return Response.redirect(`${url.origin}/order-status.html?delivery_fee=failed`, 302);
  }
  orderNumber = orderNumber || tx.metadata?.order_number || '';
  if (!orderNumber) {
    return Response.redirect(`${url.origin}/checkout.html?paid=0&reason=missing_order`, 302);
  }

  const order = await env.DB.prepare(`
    SELECT id, total, notes, status, order_number, customer_name, email, phone, country, city, address, currency, promo_code, promo_discount, tier_discount, customer_id
    FROM orders
    WHERE order_number = ?
    LIMIT 1
  `).bind(orderNumber).first();

  if (!order) {
    return Response.redirect(`${url.origin}/checkout.html?paid=0&reason=order_not_found`, 302);
  }

  const expectedAmount = Math.round(Number(order.total || 0) * 100);
  const paidAmount = Number(tx.amount || 0);

  if (tx.status === 'success' && paidAmount === expectedAmount) {
    await env.DB.prepare(`
      UPDATE orders
      SET status = ?, notes = ?
      WHERE order_number = ?
    `).bind(
      'paid',
      `${order.notes ? `${order.notes} | ` : ''}Paid via Paystack. Ref: ${reference}`,
      orderNumber
    ).run();

    await decrementStockForOrder(env, order.id);
    if (order.promo_code) await incrementPromoUsage(env, order.promo_code);
    if (order.customer_id) await refreshCustomerProfile(env, order.customer_id);
    await ensureDeliveryForOrder(env, order);
    await notifyPaidIfNeeded(env, order);

    return Response.redirect(`${url.origin}/checkout.html?paid=1&order=${encodeURIComponent(orderNumber)}`, 302);
  }

  await env.DB.prepare(`UPDATE orders SET status = ?, notes = ? WHERE order_number = ?`).bind(
    'payment_failed',
    `${order.notes ? `${order.notes} | ` : ''}Paystack verification failed or amount mismatch. Ref: ${reference}`,
    orderNumber
  ).run();

  return Response.redirect(`${url.origin}/checkout.html?paid=0&order=${encodeURIComponent(orderNumber)}`, 302);
}
