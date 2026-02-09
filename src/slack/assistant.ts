import { query } from "@anthropic-ai/claude-agent-sdk";
import fs from "fs";
import path from "path";
import { buildClaudeQueryOptions, SLACK_SYSTEM_PROMPT } from "../config/claude";
import {
  collectWorkspaceFiles,
  diffFileSets,
  persistConversation,
  pushHistory,
} from "./workspace";
import type {
  SlackConversationState,
  SlackLogger,
  SlackWebClient,
} from "./types";

export async function triggerAssistantResponse(
  conversation: SlackConversationState,
  client: SlackWebClient,
  logger: SlackLogger,
): Promise<void> {
  if (conversation.isProcessing) {
    conversation.needsRerun = true;
    return;
  }

  conversation.isProcessing = true;
  try {
    do {
      conversation.needsRerun = false;
      await runAssistantOnce(conversation, client, logger);
    } while (conversation.needsRerun);
  } finally {
    conversation.isProcessing = false;
  }
}

async function runAssistantOnce(
  conversation: SlackConversationState,
  client: SlackWebClient,
  logger: SlackLogger,
): Promise<void> {
  const beforeFiles = await collectWorkspaceFiles(conversation.outputDir);
  conversation.knownFiles = new Set(beforeFiles);

  const promptPayload = {
    source: "slack",
    channel: conversation.channel,
    threadTs: conversation.threadTs,
    lastUpdated: new Date().toISOString(),
    messages: conversation.history,
    workspace: {
      directory: conversation.outputDir,
      files: Array.from(beforeFiles).sort(),
    },
  };

  let assistantText = "";
  let slackResponseTs: string | undefined;

  const upsertSlackMessage = async (text: string): Promise<void> => {
    const normalized = text.trim();
    if (!normalized) {
      return;
    }

    try {
      if (!slackResponseTs) {
        const postResult = await client.chat.postMessage({
          channel: conversation.channel,
          thread_ts: conversation.threadTs,
          text: normalized,
        });
        if (postResult.ts) {
          slackResponseTs = postResult.ts;
        } else {
          const possibleMessage = (postResult as {
            message?: { ts?: string };
          }).message;
          if (possibleMessage?.ts) {
            slackResponseTs = possibleMessage.ts;
          }
        }
      } else {
        await client.chat.update({
          channel: conversation.channel,
          ts: slackResponseTs,
          text: normalized,
        });
      }
    } catch (slackError) {
      const errorObj = slackError as {
        code?: string;
        data?: { error?: string; retry_after?: number };
      };

      if (errorObj.data?.error === "rate_limited" || errorObj.data?.error === "ratelimited") {
        const retryAfter = errorObj.data?.retry_after || 10;
        logger.warn?.(
          `Rate limited by Slack. The Web API client will automatically retry after ${retryAfter} seconds.`,
        );
      } else {
        logger.error(slackError, "Failed to update Slack streaming response");
      }
    }
  };

  const queryOptions = buildClaudeQueryOptions({
    cwd: conversation.outputDir,
    systemPrompt: SLACK_SYSTEM_PROMPT,
  });

  logger.info(`Starting Claude query with cwd: ${queryOptions.cwd}`);
  logger.info(`Workspace files: ${Array.from(beforeFiles).join(", ") || "none"}`);
  logger.info(`History entries: ${conversation.history.length}`);
  
  // Build prompt with FULL conversation history
  const historyText = conversation.history
    .map((entry) => {
      const role = entry.role === "user" ? "User" : "Assistant";
      const filesNote = entry.downloadedPaths?.length 
        ? `\n[Attached files: ${entry.downloadedPaths.join(", ")}]` 
        : "";
      return `${role}: ${entry.text}${filesNote}`;
    })
    .join("\n\n");
  
  const filesContext = beforeFiles.size > 0 
    ? `\n\nFiles in workspace:\n${Array.from(beforeFiles).join("\n")}`
    : "";
  
  const simplePrompt = `## Conversation History\n\n${historyText}${filesContext}`;
  
  logger.info(`Prompt includes ${conversation.history.length} history entries`);

  try {
    for await (const message of query({
      prompt: simplePrompt,
      options: queryOptions,
    })) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text") {
            assistantText += `${block.text}\n\n`;
            await upsertSlackMessage(assistantText.trimEnd());
          }
        }
      } else if (message.type === "result" && message.subtype !== "success") {
        logger.warn?.(`Slack query result: ${JSON.stringify(message)}`);
      } else if (message.type === "system") {
        logger.info(`System message: ${JSON.stringify(message)}`);
      }
    }
  } catch (error) {
    const errObj = error as { message?: string; code?: string; stderr?: string };
    const errMessage = errObj.message || "Unknown error occurred";
    const stderr = errObj.stderr || "";
    logger.error(error, `Slack assistant run failed. Message: ${errMessage}. Stderr: ${stderr}`);
    await upsertSlackMessage(`[error] I ran into an error: ${errMessage}`);
    return;
  }

  const trimmed = assistantText.trim();
  const responseText =
    trimmed || "I couldn't find anything new to add to this thread.";

  await upsertSlackMessage(responseText);

  pushHistory(conversation, {
    role: "assistant",
    text: responseText,
    ts: Date.now().toString(),
  });

  const afterFiles = await collectWorkspaceFiles(conversation.outputDir);
  const newFiles = diffFileSets(beforeFiles, afterFiles);
  conversation.knownFiles = afterFiles;
  if (newFiles.length > 0) {
    await uploadWorkspaceFiles(conversation, client, logger, newFiles);
  }
  await persistConversation(conversation, logger);
}

async function uploadWorkspaceFiles(
  conversation: SlackConversationState,
  client: SlackWebClient,
  logger: SlackLogger,
  files: string[],
): Promise<void> {
  for (const relativePath of files) {
    const absolutePath = path.join(conversation.outputDir, relativePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const stream = fs.createReadStream(absolutePath);
    try {
      await client.files.uploadV2({
        channel_id: conversation.channel,
        thread_ts: conversation.threadTs,
        filename: path.basename(relativePath),
        title: path.basename(relativePath),
        initial_comment: `New file created: ${relativePath}`,
        file: stream,
      });
    } catch (error) {
      logger.error(
        error,
        `Failed to upload Slack workspace file ${relativePath}`,
      );
    } finally {
      stream.destroy();
    }
  }
}

