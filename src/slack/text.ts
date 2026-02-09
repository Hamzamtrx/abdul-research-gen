import type { SlackFileMeta } from "./types";

export function cleanSlackText(text?: string, botUserId?: string): string {
  if (!text) {
    return "";
  }

  let cleaned = text;
  if (botUserId) {
    const mentionPattern = new RegExp(`<@${botUserId}>`, "gi");
    cleaned = cleaned.replace(mentionPattern, " ");
  }

  cleaned = cleaned
    .replace(/<([^|>]+)\|([^>]+)>/g, "$2 ($1)")
    .replace(/<([^>]+)>/g, "$1");

  return cleaned.replace(/\s+/g, " ").trim();
}

export function extractFileMetadata(files?: {
  id: string;
  name?: string;
  mimetype?: string;
  permalink?: string;
  title?: string;
  url_private?: string;
  url_private_download?: string;
}[]): SlackFileMeta[] {
  if (!files?.length) {
    return [];
  }

  return files.map((file) => ({
    id: file.id,
    name: file.name ?? file.title,
    mimetype: file.mimetype,
    permalink: file.permalink ?? file.url_private,
    title: file.title,
    urlPrivate: file.url_private,
    urlPrivateDownload: file.url_private_download,
  }));
}

