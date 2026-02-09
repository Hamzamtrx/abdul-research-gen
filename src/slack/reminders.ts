import * as chrono from "chrono-node";
import { MIN_REMINDER_DELAY_MS, REMINDER_KEYWORDS } from "./constants";
import type { SlackLogger, SlackWebClient } from "./types";
import { cleanSlackText } from "./text";

interface ScheduledReminder {
  id: string;
  channel: string;
  threadTs?: string;
  message: string;
  scheduledFor: Date;
  userId?: string;
  timeout: NodeJS.Timeout;
}

const scheduledReminders = new Map<string, ScheduledReminder>();

export async function maybeScheduleReminder({
  rawText,
  cleanedText,
  channel,
  threadTs,
  userId,
  client,
  logger,
}: {
  rawText?: string;
  cleanedText?: string;
  channel: string;
  threadTs?: string;
  userId?: string;
  client: SlackWebClient;
  logger: SlackLogger;
}): Promise<boolean> {
  const text = (rawText ?? cleanedText ?? "").trim();
  if (!text) {
    return false;
  }

  const normalized = text.toLowerCase();
  if (!REMINDER_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return false;
  }

  const scheduledFor = chrono.parseDate(text, new Date());
  if (!scheduledFor) {
    return false;
  }

  const delay = scheduledFor.getTime() - Date.now();
  if (delay < MIN_REMINDER_DELAY_MS) {
    return false;
  }

  const reminderMessage =
    extractReminderBody(cleanedText ?? cleanSlackText(text)) ??
    "follow up on your earlier request";

  await scheduleReminder({
    channel,
    threadTs,
    userId,
    message: reminderMessage,
    scheduledFor,
    client,
    logger,
  });

  return true;
}

async function scheduleReminder({
  channel,
  threadTs,
  userId,
  message,
  scheduledFor,
  client,
  logger,
}: {
  channel: string;
  threadTs?: string;
  userId?: string;
  message: string;
  scheduledFor: Date;
  client: SlackWebClient;
  logger: SlackLogger;
}): Promise<void> {
  const id = `${channel}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const delay = scheduledFor.getTime() - Date.now();
  const reminder: ScheduledReminder = {
    id,
    channel,
    threadTs,
    userId,
    message,
    scheduledFor,
    timeout: setTimeout(() => {
      postScheduledReminder(reminder, client, logger).catch((error) =>
        logger.error(error, "Failed to post scheduled reminder"),
      );
    }, delay),
  };

  scheduledReminders.set(id, reminder);

  await client.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text: `[timer] Noted! I'll remind you ${formatFriendlyTime(scheduledFor)} to ${message}.`,
  });
}

async function postScheduledReminder(
  reminder: ScheduledReminder,
  client: SlackWebClient,
  logger: SlackLogger,
): Promise<void> {
  const mention = reminder.userId ? `<@${reminder.userId}> ` : "";
  const friendlyTime = formatFriendlyTime(reminder.scheduledFor);

  try {
    await client.chat.postMessage({
      channel: reminder.channel,
      thread_ts: reminder.threadTs,
      text: `${mention}[reminder] (${friendlyTime}): ${reminder.message}`,
    });
  } catch (error) {
    logger.error(error, "Failed to send scheduled reminder");
  } finally {
    scheduledReminders.delete(reminder.id);
  }
}

function extractReminderBody(text?: string): string | undefined {
  if (!text) {
    return undefined;
  }

  const normalized = text.trim();
  const match = normalized.match(/(?:to|that)\s+(.+)/i);
  if (match?.[1]) {
    return match[1].trim();
  }

  const stripped = normalized
    .replace(/^(?:please\s+)?(?:can|could|would)\s+you\s+/i, "")
    .replace(/^(?:please\s+)?(?:remind|tell|ping|notify)\s+(?:me|us)\s*/i, "")
    .trim();

  return stripped || undefined;
}

function formatFriendlyTime(date: Date): string {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

