import { ok, error, optionsResponse } from '../../_lib/response.js';
import { getCustomerBySession } from '../../_lib/customer-auth.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return onRequestOptions();
  if (context.request.method !== 'GET') return error('Method not allowed.', 405);
  try {
    const customer = await getCustomerBySession(context.env, context.request);
    return ok({ authenticated: Boolean(customer), customer: customer ? { id: customer.id, email: customer.email, full_name: customer.full_name || '' } : null });
  } catch (err) {
    return error(err?.message || 'Could not load account.', 500);
  }
}
