import { adminLogoutResponse } from "../../../_lib/auth.js";
import { optionsResponse } from "../../../_lib/response.js";

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestPost() {
  return adminLogoutResponse();
}
