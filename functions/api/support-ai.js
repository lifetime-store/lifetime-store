import { error, ok, optionsResponse } from "../_lib/response.js";
import { readJson } from "../_lib/parse.js";

function offlineAnswer(question = '', env = {}) {
  const q = String(question || '').toLowerCase();
  const supportEmail = env.SUPPORT_EMAIL || 'support@lifetime-store.shop';
  const ordersEmail = env.ORDERS_EMAIL || 'orders@lifetime-store.shop';
  if (/(track|tracking|order status|delivery)/.test(q)) {
    return `For live delivery updates, open the Orders page and track with your order number and email or your tracking number. Delivery questions are handled through ${ordersEmail}.`;
  }
  if (/(return|refund|exchange|size)/.test(q)) {
    return `For returns, exchanges, or sizing help, open the Returns, Exchanges, and Size Guide pages first. If you still need help, contact ${supportEmail}.`;
  }
  if (/(authentic|verify|fake|label|barcode|qr)/.test(q)) {
    return `Use the Verify page to scan the label live or enter the authenticity code manually. If the result looks wrong, send the code and a clear label photo to ${supportEmail}.`;
  }
  if (/(paystack|payment|delivery fee|shipping fee|charge)/.test(q)) {
    return `Main orders and later delivery-fee requests are processed through Paystack inside the website. For order-payment help, contact ${ordersEmail}.`;
  }
  return `I can help with orders, delivery, authenticity, returns, exchange, sizing, and payment guidance. For direct human help, use ${supportEmail} for support or ${ordersEmail} for delivery and order handling.`;
}

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const question = String(body.question || '').trim();
  if (!question) return error('question is required.', 400);

  const supportEmail = context.env.SUPPORT_EMAIL || 'support@lifetime-store.shop';
  const ordersEmail = context.env.ORDERS_EMAIL || 'orders@lifetime-store.shop';

  if (!context.env.AI || typeof context.env.AI.run !== 'function') {
    return ok({ answer: offlineAnswer(question, context.env), source: 'offline-fallback' });
  }

  const model = context.env.AI_ASSISTANT_MODEL || '@cf/meta/llama-3.1-8b-instruct';
  const system = `You are the Lifetime Store support assistant.
Only answer about Lifetime Store support, delivery, order tracking, authenticity, returns, exchanges, sizes, account access, and payment guidance.
Never invent order status, tracking events, refunds, or payment confirmations.
If a user needs human help, direct them to ${supportEmail} for support or ${ordersEmail} for delivery and order handling.
Keep answers concise, helpful, and commercially professional.`;

  try {
    const result = await context.env.AI.run(model, {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: question }
      ],
      max_tokens: 220
    });

    const answer = result?.response || result?.result?.response || result?.text || offlineAnswer(question, context.env);
    return ok({ answer, source: 'workers-ai' });
  } catch (err) {
    console.error('support-ai failed', err);
    return ok({ answer: offlineAnswer(question, context.env), source: 'offline-fallback' });
  }
}
