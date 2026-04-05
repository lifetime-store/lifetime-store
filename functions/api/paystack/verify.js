export async function onRequestGet(context) {
  const env = context.env;
  const url = new URL(context.request.url);
  const reference = url.searchParams.get("reference");
  let orderNumber = url.searchParams.get("order") || "";

  if (!env.PAYSTACK_SECRET_KEY) {
    return new Response("PAYSTACK_SECRET_KEY is missing.", { status: 500 });
  }

  if (!reference) {
    return Response.redirect(`${url.origin}/checkout.html?paid=0&reason=missing_reference`, 302);
  }

  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: {
      "Authorization": `Bearer ${env.PAYSTACK_SECRET_KEY}`
    }
  });

  const verifyData = await verifyRes.json();

  if (!verifyRes.ok || !verifyData.status || !verifyData.data) {
    return Response.redirect(`${url.origin}/checkout.html?paid=0&reason=verify_failed`, 302);
  }

  const tx = verifyData.data;
  orderNumber = orderNumber || tx.metadata?.order_number || "";

  if (!orderNumber) {
    return Response.redirect(`${url.origin}/checkout.html?paid=0&reason=missing_order`, 302);
  }

  const order = await env.DB.prepare(`
    SELECT id, total, notes
    FROM orders
    WHERE order_number = ?
    LIMIT 1
  `).bind(orderNumber).first();

  if (!order) {
    return Response.redirect(`${url.origin}/checkout.html?paid=0&reason=order_not_found`, 302);
  }

  const expectedAmount = Math.round(Number(order.total || 0) * 100);
  const paidAmount = Number(tx.amount || 0);

  if (tx.status === "success" && paidAmount === expectedAmount) {
    await env.DB.prepare(`
      UPDATE orders
      SET status = ?, notes = ?
      WHERE order_number = ?
    `).bind(
      "paid",
      `${order.notes ? `${order.notes} | ` : ""}Paid via Paystack. Ref: ${reference}`,
      orderNumber
    ).run();

    return Response.redirect(
      `${url.origin}/checkout.html?paid=1&order=${encodeURIComponent(orderNumber)}`,
      302
    );
  }

  await env.DB.prepare(`
    UPDATE orders
    SET status = ?, notes = ?
    WHERE order_number = ?
  `).bind(
    "payment_failed",
    `${order.notes ? `${order.notes} | ` : ""}Paystack verification failed or amount mismatch. Ref: ${reference}`,
    orderNumber
  ).run();

  return Response.redirect(
    `${url.origin}/checkout.html?paid=0&order=${encodeURIComponent(orderNumber)}`,
    302
  );
}
