import fs from "fs";
import path from "path";
import { CLAUDE_TEMPLATE_DIR, SLACK_THREADS_ROOT } from "../config/paths";
import { ALLOWED_THREAD_MESSAGE_SUBTYPES, MAX_HISTORY } from "./constants";
import { isSlackPersistenceEnabled, loadSlackThread, saveSlackThread } from "./store";
import type {
  SlackConversationState,
  SlackHistoryEntry,
  SlackLogger,
  SlackThreadMessageEvent,
} from "./types";

const conversations = new Map<string, SlackConversationState>();

export function getConversation(
  threadTs: string,
): SlackConversationState | undefined {
  return conversations.get(threadTs);
}

export async function getOrCreateConversation(
  threadTs: string,
  channel: string,
): Promise<SlackConversationState> {
  let conversation = conversations.get(threadTs);
  if (conversation) {
    conversation.channel = channel;
    ensureDirectoryExists(conversation.outputDir);
    ensureClaudeConfig(conversation.outputDir);
    if (!conversation.downloadedFileIds) {
      conversation.downloadedFileIds = new Set<string>();
    }
    if (!conversation.downloadedFilePaths) {
      conversation.downloadedFilePaths = new Map<string, string>();
    }
    return conversation;
  }

  const outputDir = resolveSlackWorkspaceDirectory(channel, threadTs);
  const baseConversation: SlackConversationState = {
    channel,
    threadTs,
    history: [],
    isProcessing: false,
    needsRerun: false,
    outputDir,
    knownFiles: new Set<string>(),
    downloadedFileIds: new Set<string>(),
    downloadedFilePaths: new Map<string, string>(),
  };

  if (isSlackPersistenceEnabled()) {
    try {
      const persisted = await loadSlackThread(threadTs);
      if (persisted) {
        const hydrated: SlackConversationState = {
          ...baseConversation,
          ...persisted,
          outputDir: persisted.outputDir || outputDir,
          history: persisted.history ?? [],
          knownFiles: new Set<string>(persisted.knownFiles ?? []),
          downloadedFileIds: new Set<string>(persisted.downloadedFileIds ?? []),
          downloadedFilePaths: new Map<string, string>(
            Object.entries(persisted.downloadedFilePaths ?? {}),
          ),
        };
        ensureDirectoryExists(hydrated.outputDir);
        ensureClaudeConfig(hydrated.outputDir);
        conversations.set(threadTs, hydrated);
        return hydrated;
      }
    } catch (error) {
      console.error("Failed to hydrate Slack conversation from Mongo:", error);
    }
  }

  conversations.set(threadTs, baseConversation);
  return baseConversation;
}

export async function persistConversation(
  conversation: SlackConversationState,
  logger?: SlackLogger,
): Promise<void> {
  if (!isSlackPersistenceEnabled()) {
    return;
  }
  try {
    await saveSlackThread(conversation);
  } catch (error) {
    logger?.warn?.("Failed to persist Slack conversation to Mongo", error);
  }
}

export function pushHistory(
  conversation: SlackConversationState,
  entry: SlackHistoryEntry,
): void {
  conversation.history.push(entry);
  if (conversation.history.length > MAX_HISTORY) {
    conversation.history.splice(
      0,
      conversation.history.length - MAX_HISTORY,
    );
  }
}

export function isUserThreadMessage(event: unknown): event is SlackThreadMessageEvent {
  if (!event || typeof event !== "object") {
    return false;
  }

  const possible = event as SlackThreadMessageEvent;
  if (!possible.thread_ts) {
    return false;
  }

  if (possible.bot_id) {
    return false;
  }

  if (
    possible.subtype &&
    !ALLOWED_THREAD_MESSAGE_SUBTYPES.has(possible.subtype)
  ) {
    return false;
  }

  return true;
}

export async function collectWorkspaceFiles(dir: string): Promise<Set<string>> {
  const files = new Set<string>();
  if (!fs.existsSync(dir)) {
    return files;
  }

  async function walk(current: string): Promise<void> {
    const entries = await fs.promises.readdir(current, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          await walk(entryPath);
        } else if (entry.isFile()) {
          files.add(path.relative(dir, entryPath));
        }
      }),
    );
  }

  await walk(dir);
  return files;
}

export function diffFileSets(
  before: Set<string>,
  after: Set<string>,
): string[] {
  const newFiles: string[] = [];
  for (const file of after) {
    if (!before.has(file)) {
      newFiles.push(file);
    }
  }
  return newFiles;
}

export function ensureDirectoryExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyDirectoryRecursive(src: string, dest: string): void {
  if (!fs.existsSync(src)) {
    console.warn(`[Slack Workspace] Cannot copy: source directory ${src} does not exist`);
    return;
  }
  
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  let filesCopied = 0;
  let dirsCopied = 0;
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    try {
      if (entry.isDirectory()) {
        copyDirectoryRecursive(srcPath, destPath);
        dirsCopied++;
      } else {
        fs.copyFileSync(srcPath, destPath);
        filesCopied++;
      }
    } catch (error) {
      console.error(`[Slack Workspace] Failed to copy ${srcPath} to ${destPath}:`, error);
    }
  }
  
  if (src === CLAUDE_TEMPLATE_DIR) {
    console.log(`[Slack Workspace] Copied ${filesCopied} files and ${dirsCopied} directories from .claude template`);
  }
}

function ensureClaudeConfig(directory: string): void {
  const destClaudeDir = path.join(directory, ".claude");
  
  if (!fs.existsSync(CLAUDE_TEMPLATE_DIR)) {
    console.error(`[Slack Workspace] ERROR: Claude template directory not found at ${CLAUDE_TEMPLATE_DIR}`);
    console.error(`[Slack Workspace] Skills and agents will NOT be available in this Slack thread!`);
    return;
  }
  
  if (fs.existsSync(destClaudeDir)) {
    console.log(`[Slack Workspace] .claude directory already exists at ${destClaudeDir}`);
    return;
  }
  
  console.log(`[Slack Workspace] Copying .claude skills and agents to ${destClaudeDir}`);
  copyDirectoryRecursive(CLAUDE_TEMPLATE_DIR, destClaudeDir);
  console.log(`[Slack Workspace] Successfully copied .claude directory with skills and agents`);
}

export function sanitizePathSegment(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9-_]+/g, "_").replace(/_+/g, "_");
  const trimmed = cleaned.replace(/^_+|_+$/g, "");
  return trimmed || "workspace";
}

export function resolveSlackWorkspaceDirectory(
  channel: string,
  threadTs: string,
): string {
  const channelSegment = sanitizePathSegment(channel || "channel");
  const threadSegment = sanitizePathSegment(threadTs);
  const directory = path.join(
    SLACK_THREADS_ROOT,
    `${channelSegment}__${threadSegment}`,
  );
  ensureDirectoryExists(directory);
  ensureClaudeConfig(directory);
  return directory;
}

