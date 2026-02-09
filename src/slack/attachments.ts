import fs from "fs";
import path from "path";
import { ATTACHMENTS_DIR_NAME, MIME_EXTENSION_MAP } from "./constants";
import type {
  SavedSlackAttachment,
  SlackConversationState,
  SlackFileMeta,
  SlackHistoryEntry,
  SlackLogger,
} from "./types";
import { ensureDirectoryExists } from "./workspace";

function sanitizeFilenameComponent(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function deriveExtension(mimetype?: string): string {
  if (!mimetype) {
    return "";
  }
  return MIME_EXTENSION_MAP[mimetype] ?? "";
}

function isPdfLike(file: SlackFileMeta, filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return file.mimetype === "application/pdf" || ext === ".pdf";
}

function isValidPdfBuffer(buffer: Buffer): boolean {
  if (buffer.length < 5) {
    return false;
  }

  const header = buffer.subarray(0, 5).toString("ascii");
  if (!header.startsWith("%PDF-")) {
    return false;
  }

  const eofIndex = buffer.lastIndexOf(Buffer.from("%%EOF", "ascii"));
  return eofIndex !== -1;
}

function buildAttachmentFilename(file: SlackFileMeta): string {
  const fallbackBase = sanitizeFilenameComponent(file.id || "attachment") || "attachment";
  const originalName = file.name ?? file.title ?? fallbackBase;
  const parsed = path.parse(originalName);
  const base = sanitizeFilenameComponent(parsed.name) || fallbackBase;
  const extension = parsed.ext || deriveExtension(file.mimetype);
  return `${base}${extension}`;
}

function ensureUniqueFilename(dir: string, filename: string): string {
  let candidate = filename || "attachment";
  const parsed = path.parse(candidate);
  const base = parsed.name || "attachment";
  const ext = parsed.ext;
  let counter = 1;

  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base}_${counter}${ext}`;
    counter += 1;
  }

  return candidate;
}

export async function downloadSlackAttachments({
  conversation,
  files,
  logger,
  botToken,
}: {
  conversation: SlackConversationState;
  files?: SlackFileMeta[];
  logger: SlackLogger;
  botToken: string;
}): Promise<SavedSlackAttachment[]> {
  if (!files?.length) {
    return [];
  }

  const attachmentsDir = path.join(conversation.outputDir, ATTACHMENTS_DIR_NAME);
  ensureDirectoryExists(attachmentsDir);

  const saved: SavedSlackAttachment[] = [];

  for (const file of files) {
    if (!file?.id) {
      continue;
    }

    if (conversation.downloadedFileIds.has(file.id)) {
      const existingPath = conversation.downloadedFilePaths.get(file.id);
      if (existingPath) {
        saved.push({
          id: file.id,
          filename: path.basename(existingPath),
          relativePath: existingPath,
          absolutePath: path.join(conversation.outputDir, existingPath),
        });
      }
      continue;
    }

    // Prefer url_private_download for authenticated downloads, avoid permalink
    const downloadUrl = file.urlPrivateDownload ?? file.urlPrivate;
    if (!downloadUrl) {
      logger.warn?.(`Skipping Slack file ${file.id} because it lacks a private download URL (only has permalink: ${file.permalink}). Make sure your Slack app has the 'files:read' scope.`);
      continue;
    }

    logger.info?.(`Downloading Slack file ${file.id} from: ${downloadUrl.substring(0, 80)}...`);

    try {
      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${botToken}`,
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(
          `Slack file download failed with status ${response.status} ${response.statusText}`,
        );
      }

      // Check content type to detect if we got HTML instead of the actual file
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw new Error(
          `Slack returned HTML instead of file content. This usually means the bot token lacks 'files:read' scope or the file requires additional permissions.`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);
      
      // Additional check: if we expected an image but got text, something is wrong
      const firstBytes = fileBuffer.subarray(0, 20).toString('utf8');
      if (firstBytes.includes('<!DOCTYPE') || firstBytes.includes('<html')) {
        throw new Error(
          `Downloaded content appears to be HTML, not the expected file. Check bot permissions.`,
        );
      }

      const originalFilename = buildAttachmentFilename(file);
      let filename = ensureUniqueFilename(attachmentsDir, originalFilename);
      let note: string | undefined;

      if (isPdfLike(file, filename) && !isValidPdfBuffer(fileBuffer)) {
        logger.warn?.(
          `Slack file ${file.id} looked like a PDF but failed validation; saving as .bin to avoid invalid PDF errors.`,
        );
        const parsed = path.parse(filename);
        filename = ensureUniqueFilename(
          attachmentsDir,
          `${parsed.name || "attachment"}.bin`,
        );
        note = "invalid PDF payload; saved as .bin";
      }

      const absolutePath = path.join(attachmentsDir, filename);
      await fs.promises.writeFile(absolutePath, fileBuffer);

      const relativePath = path
        .relative(conversation.outputDir, absolutePath)
        .split(path.sep)
        .join("/");

      conversation.downloadedFileIds.add(file.id);
      conversation.downloadedFilePaths.set(file.id, relativePath);
      file.localPath = relativePath;

      saved.push({
        id: file.id,
        filename,
        relativePath,
        absolutePath,
        note,
      });
    } catch (error) {
      logger.error(
        error,
        `Failed to download Slack attachment ${file.id} (${file.name ?? "unnamed"})`,
      );
    }
  }

  return saved;
}

function getFileReadInstruction(filename: string, mimetype?: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) || 
                  mimetype?.startsWith('image/');
  const isPdf = ext === 'pdf' || mimetype === 'application/pdf';
  
  if (isImage) {
    return 'READ THIS IMAGE NOW with the Read tool to see its contents.';
  } else if (isPdf) {
    return 'Use pdf_extract_text tool to read this PDF.';
  } else {
    return 'Use Read tool to view this file.';
  }
}

export function annotateHistoryEntryWithDownloads(
  entry: SlackHistoryEntry,
  savedFiles: SavedSlackAttachment[],
): void {
  if (savedFiles.length === 0) {
    return;
  }

  const noteLines = savedFiles.map((file) => {
    const fileEntry = entry.files?.find(f => f.id === file.id);
    const instruction = getFileReadInstruction(file.filename, fileEntry?.mimetype);
    return `[USER UPLOADED FILE: ${file.filename}] Saved to: ${file.relativePath}${
      file.note ? ` (${file.note})` : ''
    } — ${instruction}`;
  });
  const note = noteLines.join('\n');
  entry.text = entry.text ? `${entry.text}\n\n${note}` : note;

  if (entry.files?.length) {
    const lookup = new Map(savedFiles.map((file) => [file.id, file.relativePath]));
    entry.files = entry.files.map((file) => {
      const relativePath = lookup.get(file.id);
      return relativePath ? { ...file, localPath: relativePath } : file;
    });
  }
}

