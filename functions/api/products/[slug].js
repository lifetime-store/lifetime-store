
import { getProductBySlug } from "../../_lib/db.js";
import { error, ok, optionsResponse } from "../../_lib/response.js";

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const slug = context.params.slug;
  const product = await getProductBySlug(context.env, slug);

  if (!product) {
    return error("Product not found.", 404);
  }

  return ok({ product });
}
