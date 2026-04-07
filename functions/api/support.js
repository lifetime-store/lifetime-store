import { error, ok, optionsResponse } from "../_lib/response.js";
import { readJson } from "../_lib/parse.js";
import { verifyHumanCheck } from '../_lib/human-check.js';
import { sendIssueAlerts } from "../_lib/mail.js";

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const { serial_code = null, issue_type, name, email, message, order_id = null, human_token = '' } = body;
  const human = await verifyHumanCheck(context.env, human_token, context.request.headers.get('cf-connecting-ip') || '');
  if (!human.ok) return error(human.message, 400);

  if (!issue_type || !name || !email || !message) {
    return error("issue_type, name, email, and message are required.", 400);
  }

  const result = await context.env.DB.prepare(`
    INSERT INTO issues (serial_code, order_id, issue_type, name, email, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(serial_code, order_id, issue_type, name, email, message).run();

  try {
    await sendIssueAlerts(context.env, {
      issue_id: result.meta?.last_row_id || null,
      serial_code,
      order_id,
      issue_type,
      name,
      email,
      message
    });
  } catch (mailError) {
    console.error('Issue email alert failed', mailError);
  }

  return ok({
    issueId: result.meta?.last_row_id || null,
    message: "Support request submitted."
  });
}
