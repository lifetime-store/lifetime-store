
import { listProducts } from "../../_lib/db.js";
import { ok, optionsResponse } from "../../_lib/response.js";

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const featuredOnly = context.request.url.includes("featured=1");
  const products = await listProducts(context.env, featuredOnly);
  return ok({ products });
}
