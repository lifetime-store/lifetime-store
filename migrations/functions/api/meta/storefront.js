import { ok, optionsResponse } from '../../_lib/response.js';
import { getStorefrontMeta } from '../../_lib/storefront.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const meta = await getStorefrontMeta(context.env, context.request);
  return ok({ meta });
}
