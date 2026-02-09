import type { Logger } from "@slack/bolt";

export type SlackWebClient = any;

export type SlackLogger = Logger;

export type SlackFileMeta = {
  id: string;
  name?: string;
  mimetype?: string;
  permalink?: string;
  title?: string;
  urlPrivate?: string;
  urlPrivateDownload?: string;
  localPath?: string;
};

export type SavedSlackAttachment = {
  id: string;
  filename: string;
  relativePath: string;
  absolutePath: string;
  note?: string;
};

export type SlackHistoryEntry = {
  role: "user" | "assistant";
  text: string;
  ts: string;
  userId?: string;
  files?: SlackFileMeta[];
};

export interface SlackConversationState {
  channel: string;
  threadTs: string;
  history: SlackHistoryEntry[];
  isProcessing: boolean;
  needsRerun: boolean;
  outputDir: string;
  knownFiles: Set<string>;
  downloadedFileIds: Set<string>;
  downloadedFilePaths: Map<string, string>;
}

export interface SlackMessageEvent {
  type?: string;
  text?: string;
  user?: string;
  ts: string;
  channel: string;
  thread_ts?: string;
  bot_id?: string;
  subtype?: string;
  files?: {
    id: string;
    name?: string;
    mimetype?: string;
    permalink?: string;
    title?: string;
    url_private?: string;
    url_private_download?: string;
  }[];
}

export type SlackThreadMessageEvent = SlackMessageEvent & { thread_ts: string };
