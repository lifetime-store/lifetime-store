
export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders(),
      ...extraHeaders
    }
  });
}

export function error(message, status = 400, details = null) {
  return json({ ok: false, message, details }, status);
}

export function ok(data = {}) {
  return json({ ok: true, ...data });
}

export function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "Content-Type,X-Admin-Token"
  };
}

export function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}
