import { App, LogLevel, SocketModeReceiver } from "@slack/bolt";
import type {
  AllMiddlewareArgs,
  SlackEventMiddlewareArgs,
} from "@slack/bolt";
import { annotateHistoryEntryWithDownloads, downloadSlackAttachments } from "./attachments";
import { triggerAssistantResponse } from "./assistant";
import {
  getConversation,
  getOrCreateConversation,
  isUserThreadMessage,
  persistConversation,
  pushHistory,
} from "./workspace";
import { cleanSlackText, extractFileMetadata } from "./text";
import { maybeScheduleReminder } from "./reminders";
import type {
  SlackConversationState,
  SlackHistoryEntry,
  SlackLogger,
} from "./types";
import { isSlackPersistenceEnabled } from "./store";

let slackBotToken: string | undefined;
const handledSocketClients = new WeakSet<object>();

export async function startSlackBotServer(): Promise<void> {
  const appToken = process.env.SLACK_APP_TOKEN;
  const botToken = process.env.SLACK_BOT_TOKEN;

  if (!appToken || !botToken) {
    throw new Error(
      "Missing Slack credentials. Set SLACK_APP_TOKEN and SLACK_BOT_TOKEN.",
    );
  }

  // Create SocketModeReceiver to use latest @slack/socket-mode package
  // This ensures we use the latest version (2.0.5+) instead of the older bundled version
  const socketModeReceiver = new SocketModeReceiver({
    appToken,
  });

  const slackApp = new App({
    token: botToken,
    receiver: socketModeReceiver,
    logLevel: LogLevel.INFO,
    clientOptions: {
      retryConfig: {
        retries: 10,
        factor: 1.96,
        randomize: true,
      },
    },
  });

  slackBotToken = botToken;

  registerEventHandlers(slackApp);

  await slackApp.start();
  setupSocketModeResilience(slackApp);
  console.log(
    `Slack bot started in Socket Mode and is now connected to Slack!`,
  );
}

function registerEventHandlers(slackApp: App): void {
  slackApp.event(
    "app_mention",
    async (
      args: SlackEventMiddlewareArgs<"app_mention"> & AllMiddlewareArgs,
    ) => {
      const { event, client, context, logger } = args;
      const text = cleanSlackText(event.text, context.botUserId);
      const files = extractFileMetadata(event.files);

      if (!text && files.length === 0) {
        return;
      }

      const threadTs = event.thread_ts ?? event.ts;
      const conversation = await getOrCreateConversation(threadTs, event.channel);

      const historyEntry: SlackHistoryEntry = {
        role: "user",
        text,
        ts: event.ts,
        userId: event.user,
        files: files.length ? files : undefined,
      };
      pushHistory(conversation, historyEntry);

      await handleAttachments(historyEntry, conversation, files, logger);

      await maybeScheduleReminder({
        rawText: event.text,
        cleanedText: text,
        channel: event.channel,
        threadTs,
        userId: event.user,
        client,
        logger,
      });

      logger.info(`Slack mention received in #${conversation.channel}`);
      await persistConversation(conversation, logger);
      triggerAssistantResponse(conversation, client, logger).catch((error) => {
        logger.error(error, "Failed processing Slack mention");
      });
    },
  );

  slackApp.event(
    "message",
    async (args: SlackEventMiddlewareArgs<"message"> & AllMiddlewareArgs) => {
      const { event, client, logger, context } = args;
      if (!isUserThreadMessage(event)) {
        return;
      }

      // Only respond to messages in threads that are actively in memory
      // (i.e., threads where the bot was recently @mentioned)
      // Do NOT load old conversations from MongoDB to avoid responding in inactive threads
      const conversation = getConversation(event.thread_ts);
      if (!conversation) {
        return;
      }

      const cleanedText = cleanSlackText(event.text, context.botUserId);
      const files = extractFileMetadata(event.files);
      if (!cleanedText && files.length === 0) {
        return;
      }

      const historyEntry: SlackHistoryEntry = {
        role: "user",
        text: cleanedText,
        ts: event.ts,
        userId: event.user,
        files: files.length ? files : undefined,
      };
      pushHistory(conversation, historyEntry);

      await handleAttachments(historyEntry, conversation, files, logger);

      await maybeScheduleReminder({
        rawText: event.text,
        cleanedText,
        channel: event.channel,
        threadTs: event.thread_ts,
        userId: event.user,
        client,
        logger,
      });

      logger.debug?.(
        `Thread message received for ${conversation.threadTs}; scheduling response`,
      );
      await persistConversation(conversation, logger);
      triggerAssistantResponse(conversation, client, logger).catch((error) => {
        logger.error(error, "Failed processing Slack thread reply");
      });
    },
  );
}

async function handleAttachments(
  historyEntry: SlackHistoryEntry,
  conversation: SlackConversationState,
  files: ReturnType<typeof extractFileMetadata>,
  logger: SlackLogger,
): Promise<void> {
  if (!files.length) {
    return;
  }

  const botToken = requireSlackBotToken();
  const savedFiles = await downloadSlackAttachments({
    conversation,
    files,
    logger,
    botToken,
  });
  if (savedFiles.length > 0) {
    annotateHistoryEntryWithDownloads(historyEntry, savedFiles);
  }
}

function setupSocketModeResilience(slackApp: App): void {
  const rawClient = (slackApp as unknown as {
    socketModeClient?: {
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      stateMachine?: {
        config?: {
          global?: {
            unhandledEventHooks?: Array<
              (event: string, state: string) => void
            >;
          };
        };
      };
    };
  }).socketModeClient;

  if (!rawClient || handledSocketClients.has(rawClient)) {
    return;
  }
  handledSocketClients.add(rawClient);

  const globalConfig = rawClient.stateMachine?.config?.global;
  if (globalConfig) {
    globalConfig.unhandledEventHooks =
      globalConfig.unhandledEventHooks ?? [];
    globalConfig.unhandledEventHooks.push((event: string, state: string) => {
      if (event === "server explicit disconnect") {
        console.warn(
          `Slack socket issued "${event}" while ${state}; suppressing crash and waiting for auto-reconnect.`,
        );
      }
    });
  }

  rawClient.on?.("connecting", () => {
    console.log("[Socket Mode] Establishing connection to Slack...");
  });

  rawClient.on?.("connected", () => {
    console.log("[Socket Mode] Successfully connected to Slack!");
  });

  rawClient.on?.("disconnecting", () => {
    console.log("[Socket Mode] Disconnecting from Slack...");
  });

  rawClient.on?.("reconnecting", () => {
    console.log(
      "[Socket Mode] Connection lost. Attempting to reconnect to Slack...",
    );
  });

  rawClient.on?.("disconnected", (error: unknown) => {
    if (error) {
      console.error("[Socket Mode] Disconnected with error:", error);
    } else {
      console.log("[Socket Mode] Gracefully disconnected from Slack.");
    }
  });

  rawClient.on?.("server explicit disconnect", () => {
    console.warn(
      "[Socket Mode] Server explicitly disconnected. Will auto-reconnect.",
    );
  });

  rawClient.on?.("error", (error: unknown) => {
    const errorObj = error as {
      code?: string;
      message?: string;
      data?: { error?: string; response_metadata?: { messages?: string[] } };
    };

    if (errorObj.code === "slack_webapi_platform_error") {
      const slackError = errorObj.data?.error;
      if (slackError === "ratelimited" || slackError === "rate_limited") {
        console.warn(
          "[Socket Mode] Rate limited by Slack API. The client will automatically retry with backoff.",
        );
        return;
      }
    }

    console.error("[Socket Mode] Error:", error);
  });
}

function requireSlackBotToken(): string {
  if (!slackBotToken) {
    throw new Error("Slack bot token has not been initialized yet.");
  }
  return slackBotToken;
}
