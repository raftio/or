/**
 * RFC-018: Notification sink – webhook and/or Slack (fire-and-forget).
 */
import {
  getNotificationWebhookUrl,
  getSlackWebhookUrl,
} from "../config.js";

export type NotificationEvent =
  | "bundle_ready"
  | "evidence_failed"
  | "pr_ready_for_review"
  | "pr_merged";

export interface NotificationPayload {
  ticket_id: string;
  pr_id?: string;
  repo?: string;
  message?: string;
  link?: string;
}

function buildMessage(event: NotificationEvent, payload: NotificationPayload): string {
  const { ticket_id, pr_id, repo, message } = payload;
  if (message) return message;
  switch (event) {
    case "bundle_ready":
      return `Bundle ready for ticket ${ticket_id}`;
    case "evidence_failed":
      return `Evidence validation failed for ${ticket_id}${pr_id ? ` (PR ${pr_id})` : ""}`;
    case "pr_ready_for_review":
      return `PR ${repo ?? ""}#${pr_id ?? ""} ready for review (ticket ${ticket_id})`;
    case "pr_merged":
      return `PR merged for ticket ${ticket_id}`;
    default:
      return `Orqestra: ${event} for ${ticket_id}`;
  }
}

/** Fire-and-forget: do not await or block response. */
export function notify(
  event: NotificationEvent,
  payload: NotificationPayload
): void {
  const body = {
    event,
    ...payload,
    message: buildMessage(event, payload),
    timestamp: new Date().toISOString(),
  };

  const webhookUrl = getNotificationWebhookUrl();
  if (webhookUrl) {
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  const slackUrl = getSlackWebhookUrl();
  if (slackUrl) {
    fetch(slackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: body.message }),
    }).catch(() => {});
  }
}
