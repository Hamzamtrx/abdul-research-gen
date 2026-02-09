import { query } from "@anthropic-ai/claude-agent-sdk";
import type { ClaudeQueryOptions } from "../config/claude";

export async function runQueryWithRetry({
  promptData,
  queryOptions,
  log,
}: {
  promptData: unknown;
  queryOptions: ClaudeQueryOptions;
  log: (message: string) => void;
}): Promise<void> {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      let messageCount = 0;
      log(
        `Entering query loop - waiting for messages from Claude... (attempt ${attempt}/${maxAttempts})`,
      );
      const promptString = buildPromptString(promptData, log);
      for await (const message of query({
        prompt: promptString,
        options: queryOptions,
      })) {
        messageCount++;
        log(`[Message ${messageCount}] Received message type: ${message.type}`);

        if (message.type === "assistant") {
          for (const block of message.message.content) {
            if (block.type === "text") {
              log(block.text);
            }
          }
        } else if (message.type === "result") {
          log(
            `[Result] Subtype: ${message.subtype}, Details: ${JSON.stringify(message)}`,
          );
        } else {
          log(`[Other message] ${JSON.stringify(message)}`);
        }
      }
      log(`Query loop completed. Total messages received: ${messageCount}`);
      return;
    } catch (error) {
      const { retryable, reason, status } = classifyRetryableError(error);
      if (retryable && attempt < maxAttempts) {
        const delayMs = 2000 * 2 ** (attempt - 1);
        const reasonLabel = reason ?? status ?? "overload";
        log(
          `Claude API ${reasonLabel} - retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxAttempts})`,
        );
        await delay(delayMs);
        continue;
      }
      throw error;
    }
  }
}

export function buildPromptString(
  promptData: unknown,
  log: (message: string) => void,
): string {
  if (typeof promptData === "string") {
    return promptData;
  }

  try {
    return safeStringify(promptData);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown stringify error";
    log(
      `Failed to serialize promptData to JSON (${message}); falling back to string coercion.`,
    );
    try {
      return String(promptData);
    } catch {
      return "[unserializable prompt data]";
    }
  }
}

function classifyRetryableError(
  error: unknown,
): { retryable: boolean; reason?: string; status?: number } {
  const status = (error as any)?.response?.status ?? (error as any)?.status;
  const errType = (error as any)?.error?.type ?? (error as any)?.type;
  const message =
    error instanceof Error ? error.message : String(error ?? "unknown error");

  const overloaded =
    status === 529 ||
    errType === "overloaded_error" ||
    /overloaded/i.test(message) ||
    /api error:\s*529/i.test(message);

  const rateLimited =
    status === 429 ||
    errType === "rate_limit_error" ||
    /rate limit/i.test(message);

  if (overloaded) {
    return {
      retryable: true,
      reason: "overload",
      status: typeof status === "number" ? status : undefined,
    };
  }

  if (rateLimited) {
    return {
      retryable: true,
      reason: "rate_limit",
      status: typeof status === "number" ? status : undefined,
    };
  }

  return { retryable: false, status: typeof status === "number" ? status : undefined };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeStringify(value: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(
    value,
    (_key, val) => {
      if (typeof val === "bigint") {
        return val.toString();
      }
      if (typeof val === "object" && val !== null) {
        if (seen.has(val)) {
          return "[Circular]";
        }
        seen.add(val);
      }
      return val;
    },
    2,
  );
}

