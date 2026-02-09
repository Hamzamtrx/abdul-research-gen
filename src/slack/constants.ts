export const ATTACHMENTS_DIR_NAME = "attachments";
export const MAX_HISTORY = 40;
export const MIN_REMINDER_DELAY_MS = 60_000;

export const REMINDER_KEYWORDS = [
  "remind",
  "tell me",
  "let me know",
  "ping me",
  "nudge me",
  "notify me",
];

export const ALLOWED_THREAD_MESSAGE_SUBTYPES = new Set([
  "file_share",
]);

export const MIME_EXTENSION_MAP: Record<string, string> = {
  "text/plain": ".txt",
  "text/markdown": ".md",
  "application/pdf": ".pdf",
  "application/json": ".json",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/csv": ".csv",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};

