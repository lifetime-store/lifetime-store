import { optionsResponse, ok, error } from '../../_lib/response.js';
import { readJson, toFloat } from '../../_lib/parse.js';
import { getCustomerBySession } from '../../_lib/customer-auth.js';
import { ensureCustomerProfile, validatePromoCode } from '../../_lib/storefront.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const customer = await getCustomerBySession(context.env, context.request);
  const profile = customer ? await ensureCustomerProfile(context.env, customer.id) : null;
  const result = await validatePromoCode(context.env, body.code, toFloat(body.subtotal, 0), profile?.tier_name || 'Classic');
  if (!result.valid) return error(result.message || 'Promo code invalid.', 400);
  return ok({
    promo: {
      code: result.code,
      discount: result.discount,
      discount_type: result.row.discount_type,
      discount_value: result.row.discount_value,
      tier_gate: result.row.tier_gate || null
    }
  });
}
