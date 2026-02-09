import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import { z } from "zod";
import {
  createSdkMcpServer,
  tool,
} from "@anthropic-ai/claude-agent-sdk";

const DEFAULT_MAX_CHARS = 20000;
const MAX_MATCHES = 5;
const SNIPPET_WINDOW = 320;

export const PdfTool = createSdkMcpServer({
  name: "pdf-tool",
  version: "1.0.0",
  tools: [
    tool(
      "pdf_extract_text",
      "Extracts text from a PDF file on disk, trimmed to a safe length for the model.",
      {
        file: z
          .string()
          .min(1, "Provide a path to the PDF file (relative paths allowed).")
          .describe("Path to the PDF to extract"),
        maxChars: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Optional character limit for extracted text (defaults to 20,000)."),
      },
      async ({ file, maxChars }) => {
        const resolved = resolveFilePath(file);
        if (!fs.existsSync(resolved)) {
          return {
            content: [
              {
                type: "text",
                text: `PDF not found: ${path.basename(file)}.`,
              },
            ],
          };
        }

        try {
          const { text, pages } = await extractPdf(resolved);
          const limit = maxChars ?? DEFAULT_MAX_CHARS;
          const trimmed = trimText(cleanText(text), limit);
          const note =
            trimmed.truncated && text.length > limit
              ? `\n[Trimmed to ${limit.toLocaleString()} characters to keep the excerpt concise.]`
              : "";

          return {
            content: [
              {
                type: "text",
                text: [
                  `Source: ${path.basename(resolved)} (pages: ${pages ?? "unknown"})`,
                  trimmed.text,
                  note,
                ]
                  .filter(Boolean)
                  .join("\n"),
              },
            ],
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error occurred";
          return {
            content: [
              {
                type: "text",
                text: `Failed to extract PDF text from ${path.basename(resolved)}: ${message}`,
              },
            ],
          };
        }
      },
    ),
    tool(
      "pdf_find",
      "Finds the most relevant passages in a PDF for a given query and returns short snippets.",
      {
        file: z
          .string()
          .min(1, "Provide a path to the PDF file (relative paths allowed).")
          .describe("Path to the PDF to search"),
        query: z
          .string()
          .min(3, "Provide a short query or phrase to search for.")
          .describe("Search phrase to locate in the PDF"),
        maxMatches: z
          .number()
          .int()
          .positive()
          .max(10)
          .optional()
          .describe("Optional cap on returned matches (defaults to 5)."),
      },
      async ({ file, query, maxMatches }) => {
        const resolved = resolveFilePath(file);
        if (!fs.existsSync(resolved)) {
          return {
            content: [
              {
                type: "text",
                text: `PDF not found: ${path.basename(file)}.`,
              },
            ],
          };
        }

        try {
          const { text, pages } = await extractPdf(resolved);
          const cleaned = cleanText(text);
          const matches = findBestMatches(cleaned, query, maxMatches ?? MAX_MATCHES);

          if (matches.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `No clear matches for "${query}" in ${path.basename(resolved)}. Try a different keyword or a shorter phrase.`,
                },
              ],
            };
          }

          const rendered = matches
            .map(
              (match, idx) =>
                `${idx + 1}. ${match.snippet}${
                  match.scoreDetail ? ` (score: ${match.scoreDetail})` : ""
                }`,
            )
            .join("\n\n");

          return {
            content: [
              {
                type: "text",
                text: [
                  `Source: ${path.basename(resolved)} (pages: ${pages ?? "unknown"})`,
                  `Query: "${query}"`,
                  `Matches (up to ${matches.length}):`,
                  rendered,
                ].join("\n"),
              },
            ],
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error occurred";
          return {
            content: [
              {
                type: "text",
                text: `Failed to search ${path.basename(resolved)}: ${message}`,
              },
            ],
          };
        }
      },
    ),
  ],
});

async function extractPdf(filePath: string): Promise<{ text: string; pages?: number }> {
  const buffer = await fs.promises.readFile(filePath);
  const parsed = await pdfParse(buffer);
  return { text: parsed.text ?? "", pages: parsed.numpages };
}

function resolveFilePath(file: string): string {
  return path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
}

function cleanText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function trimText(
  text: string,
  maxChars: number,
): { text: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  return { text: `${text.slice(0, maxChars)}…`, truncated: true };
}

function findBestMatches(text: string, query: string, limit: number) {
  const segments = splitIntoSegments(text);
  const scored = segments
    .map((segment, index) => ({
      index,
      segment,
      score: scoreSegment(segment, query),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((entry) => ({
    snippet: buildSnippet(entry.segment, query),
    scoreDetail: entry.score.toFixed(2),
  }));
}

function splitIntoSegments(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // Fall back to line-based slices if no paragraphs detected.
  if (paragraphs.length === 0) {
    const lines = text.split("\n");
    const chunks: string[] = [];
    for (let i = 0; i < lines.length; i += 5) {
      const slice = lines.slice(i, i + 5).join(" ").trim();
      if (slice.length > 0) {
        chunks.push(slice);
      }
    }
    return chunks;
  }

  return paragraphs;
}

function scoreSegment(segment: string, query: string): number {
  const segmentLower = segment.toLowerCase();
  const queryLower = query.toLowerCase();

  let score = 0;
  if (segmentLower.includes(queryLower)) {
    score += 5;
  }

  const tokens = Array.from(new Set(queryLower.split(/\W+/).filter((t) => t.length > 2)));
  for (const token of tokens) {
    if (segmentLower.includes(token)) {
      score += 1;
    }
  }

  // Lightly penalize very short fragments to prefer substantive matches.
  if (segment.length < 80) {
    score *= 0.8;
  }

  return score;
}

function buildSnippet(segment: string, query: string): string {
  const normalizedSegment = segment.replace(/\s+/g, " ").trim();
  if (normalizedSegment.length <= SNIPPET_WINDOW) {
    return normalizedSegment;
  }

  const idx = normalizedSegment.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) {
    return `${normalizedSegment.slice(0, SNIPPET_WINDOW)}…`;
  }

  const start = Math.max(0, idx - SNIPPET_WINDOW / 2);
  const end = Math.min(normalizedSegment.length, idx + query.length + SNIPPET_WINDOW / 2);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < normalizedSegment.length ? "…" : "";
  return `${prefix}${normalizedSegment.slice(start, end)}${suffix}`;
}
