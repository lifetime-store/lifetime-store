import { ok, optionsResponse } from '../../_lib/response.js';
import { getCustomerBySession } from '../../_lib/customer-auth.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const customer = await getCustomerBySession(context.env, context.request);
  return ok({ authenticated: Boolean(customer), customer: customer ? { id: customer.id, email: customer.email, full_name: customer.full_name || '' } : null });
}
