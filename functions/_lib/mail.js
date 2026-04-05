function escapeHtml(input = "") {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', '&quot;')
    .replaceAll("'", "&#39;");
}

function formatMoney(amount, currency = 'NGN') {
  try {
    const locale = currency === 'NGN' ? 'en-NG' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'NGN' ? 0 : 2
    }).format(Number(amount || 0));
  } catch {
    return `${currency} ${Number(amount || 0)}`;
  }
}

function renderItems(items = []) {
  if (!items.length) return '<li>No items attached.</li>';
  return items.map((item) => `<li><strong>${escapeHtml(item.product_name || 'Product')}</strong> — ${escapeHtml(item.color || 'Standard')} / ${escapeHtml(item.size || 'One Size')} × ${Number(item.quantity || 1)}</li>`).join('');
}

async function sendEmail(env, { to, subject, html, replyTo }) {
  const apiKey = env.RESEND_API_KEY;
  const from = env.MAIL_FROM_EMAIL;
  if (!apiKey || !from || !to) return { skipped: true };

  const payload = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  if (replyTo) payload.reply_to = replyTo;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function sendOrderAlerts(env, order, items = [], eventLabel = 'Order received') {
  const brand = env.BRAND_NAME || 'Lifetime';
  const alertTo = env.ALERT_TO_EMAIL || env.BRAND_EMAIL;
  const itemList = renderItems(items);
  const total = formatMoney(order.total, order.currency || 'NGN');
  const customerEmail = escapeHtml(order.email || '');

  const internalHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
      <h2>${escapeHtml(brand)} — ${escapeHtml(eventLabel)}</h2>
      <p><strong>Order:</strong> ${escapeHtml(order.order_number || '')}</p>
      <p><strong>Customer:</strong> ${escapeHtml(order.customer_name || '')} (${customerEmail})</p>
      <p><strong>Total:</strong> ${escapeHtml(total)}</p>
      <p><strong>Status:</strong> ${escapeHtml(order.status || '')}</p>
      <p><strong>Address:</strong> ${escapeHtml([order.address, order.city, order.country].filter(Boolean).join(', '))}</p>
      <p><strong>Phone:</strong> ${escapeHtml(order.phone || '')}</p>
      <p><strong>Notes:</strong> ${escapeHtml(order.notes || '')}</p>
      <h3>Items</h3>
      <ul>${itemList}</ul>
    </div>
  `;

  const customerHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
      <h2>Thank you for shopping with ${escapeHtml(brand)}</h2>
      <p>Your order <strong>${escapeHtml(order.order_number || '')}</strong> has been received.</p>
      <p><strong>Status:</strong> ${escapeHtml(order.status || '')}</p>
      <p><strong>Total:</strong> ${escapeHtml(total)}</p>
      <h3>Items</h3>
      <ul>${itemList}</ul>
      <p>If you need help, reply to this email or contact ${escapeHtml(env.BRAND_EMAIL || alertTo || '')}.</p>
    </div>
  `;

  const promises = [];
  if (alertTo) {
    promises.push(sendEmail(env, {
      to: alertTo,
      subject: `${brand}: ${eventLabel} — ${order.order_number}`,
      html: internalHtml,
      replyTo: order.email || undefined
    }));
  }
  if (order.email) {
    promises.push(sendEmail(env, {
      to: order.email,
      subject: `${brand} order update — ${order.order_number}`,
      html: customerHtml,
      replyTo: env.BRAND_EMAIL || alertTo || undefined
    }));
  }
  await Promise.all(promises);
}

export async function sendIssueAlerts(env, issue) {
  const brand = env.BRAND_NAME || 'Lifetime';
  const alertTo = env.ALERT_TO_EMAIL || env.BRAND_EMAIL;

  const internalHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
      <h2>${escapeHtml(brand)} — New support issue</h2>
      <p><strong>Issue type:</strong> ${escapeHtml(issue.issue_type || '')}</p>
      <p><strong>Name:</strong> ${escapeHtml(issue.name || '')}</p>
      <p><strong>Email:</strong> ${escapeHtml(issue.email || '')}</p>
      <p><strong>Order ID:</strong> ${escapeHtml(issue.order_id || '')}</p>
      <p><strong>Authenticity code:</strong> ${escapeHtml(issue.serial_code || '')}</p>
      <p><strong>Message:</strong><br>${escapeHtml(issue.message || '')}</p>
    </div>
  `;

  const customerHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
      <h2>${escapeHtml(brand)} support request received</h2>
      <p>Hi ${escapeHtml(issue.name || '')},</p>
      <p>We have received your message and a member of the ${escapeHtml(brand)} team will review it as quickly as possible.</p>
      <p><strong>Issue type:</strong> ${escapeHtml(issue.issue_type || '')}</p>
      <p><strong>Reference code:</strong> ${escapeHtml(issue.serial_code || 'Not provided')}</p>
      <p>If you need to reply, use this email thread or contact ${escapeHtml(env.BRAND_EMAIL || alertTo || '')}.</p>
    </div>
  `;

  const promises = [];
  if (alertTo) {
    promises.push(sendEmail(env, {
      to: alertTo,
      subject: `${brand}: New support issue — ${issue.issue_type}`,
      html: internalHtml,
      replyTo: issue.email || undefined
    }));
  }
  if (issue.email) {
    promises.push(sendEmail(env, {
      to: issue.email,
      subject: `${brand} support confirmation`,
      html: customerHtml,
      replyTo: env.BRAND_EMAIL || alertTo || undefined
    }));
  }
  await Promise.all(promises);
}
