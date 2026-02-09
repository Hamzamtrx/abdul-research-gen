import {
  createSdkMcpServer,
  tool,
} from "@anthropic-ai/claude-agent-sdk";
import { google, docs_v1, sheets_v4 } from "googleapis";
import { z } from "zod";
import { config } from "dotenv";
import {
  getAuthorizedGoogleClient,
  isDriveUploadConfigured,
} from "../googleDrive";

config();

const DEFAULT_SHEET_RANGE = "A1:H50";
const MAX_SHEET_ROWS_TO_RENDER = 200;

export const GoogleDocsTool = createSdkMcpServer({
  name: "google-docs-tool",
  version: "1.0.0",
  tools: [
    tool(
      "google_docs_read",
      "Fetches the plain-text contents of a Google Docs document given its URL or document ID. Use this to ingest briefings, research, or scripts stored in Docs.",
      {
        doc: z
          .string()
          .min(3, "Provide a Google Docs share link or document ID.")
          .describe("Google Docs share URL or raw document ID"),
      },
      async ({ doc }) => {
        const isPublishedLink = doc.includes("/pub") || doc.includes("/preview");
        const docId = extractDocumentId(doc);
        if (!docId) {
          return {
            content: [
              {
                type: "text",
                text:
                  "Unable to parse a Google Docs ID from that input. Provide the share link or the alphanumeric ID between /d/ and /edit.",
              },
            ],
          };
        }

        if (isPublishedLink) {
          return {
            content: [
              {
                type: "text",
                text: `This is a published Google Docs link (/pub or /preview) which doesn't work with the API.\n\nUse scrape_google_doc tool instead with this URL: ${doc}\n\nAlternatively, ask the user for an /edit share link.`,
              },
            ],
          };
        }

        if (!isDriveUploadConfigured()) {
          return {
            content: [
              {
                type: "text",
                text:
                  "Google OAuth credentials are not configured (missing client ID/secret or refresh token). Update `.env` before using this tool.",
              },
            ],
          };
        }

        try {
          const auth = await getAuthorizedGoogleClient();
          const docsApi = google.docs({ version: "v1", auth });
          const response = await docsApi.documents.get({
            documentId: docId,
          });
          const bodyText = renderBodyToText(response.data.body?.content ?? []);
          const title = response.data.title ?? "Untitled Document";
          const documentLink = `https://docs.google.com/document/d/${docId}/edit`;
          const headerLines = [
            `Title: ${title}`,
            `Document ID: ${docId}`,
            `Link: ${documentLink}`,
          ];

          const text =
            bodyText.trim().length > 0
              ? bodyText.trim()
              : "[Document contains no extractable text content.]";

          return {
            content: [
              {
                type: "text",
                text: `${headerLines.join("\n")}\n\n${text}`,
              },
            ],
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error occurred";
          const isPermissionError = message.toLowerCase().includes("permission") || 
                                     message.toLowerCase().includes("403") ||
                                     message.toLowerCase().includes("access");
          
          let helpText = `Failed to read Google Doc (${docId}): ${message}`;
          
          if (isPermissionError) {
            helpText += `\n\nAPI access denied. Try scrape_google_doc tool with the URL instead - it can access publicly viewable docs that the API can't.`;
          }
          
          return {
            content: [
              {
                type: "text",
                text: helpText,
              },
            ],
          };
        }
      },
    ),
    tool(
      "google_sheets_read",
      "Fetches grid data from a Google Sheets document given its URL or spreadsheet ID. Use this to ingest tabular data from view-only or shared sheets.",
      {
        sheet: z
          .string()
          .min(3, "Provide a Google Sheets share link or spreadsheet ID.")
          .describe("Google Sheets share URL or spreadsheet ID"),
        range: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Optional A1 range (e.g., Sheet1!A1:F50). Defaults to first sheet and A1:H50.",
          ),
      },
      async ({ sheet, range }) => {
        const spreadsheetId = extractSpreadsheetId(sheet);
        if (!spreadsheetId) {
          return {
            content: [
              {
                type: "text",
                text:
                  "Unable to parse a Google Sheets ID from that input. Provide the share link or the alphanumeric ID between /d/ and /edit.",
              },
            ],
          };
        }

        if (!isDriveUploadConfigured()) {
          return {
            content: [
              {
                type: "text",
                text:
                  "Google OAuth credentials are not configured (missing client ID/secret or refresh token). Update `.env` before using this tool.",
              },
            ],
          };
        }

        try {
          const auth = await getAuthorizedGoogleClient();
          const sheetsApi = google.sheets({ version: "v4", auth });

          const metadata = await sheetsApi.spreadsheets.get({
            spreadsheetId,
            fields: "properties.title,sheets.properties.title",
          });

          const spreadsheetTitle =
            metadata.data.properties?.title ?? "Untitled Spreadsheet";
          const sheetTitles =
            metadata.data.sheets
              ?.map((sheetEntry) => sheetEntry.properties?.title)
              .filter((title): title is string => Boolean(title)) ?? [];

          const normalizedRange = normalizeSheetRange(range, sheetTitles);

          const valuesResponse = await sheetsApi.spreadsheets.values.get({
            spreadsheetId,
            range: normalizedRange.range,
            majorDimension: "ROWS",
          });

          const rendered =
            renderSheetValues(valuesResponse.data.values) ||
            "[No data found in the requested range.]";
          const link = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
          const rangeNote = normalizedRange.usedDefaultRange
            ? " (defaulted to first sheet and A1:H50; pass `range` to override)"
            : "";

          return {
            content: [
              {
                type: "text",
                text: [
                  `Title: ${spreadsheetTitle}`,
                  `Spreadsheet ID: ${spreadsheetId}`,
                  `Sheet: ${normalizedRange.sheetTitle}`,
                  `Range: ${normalizedRange.range}${rangeNote}`,
                  `Link: ${link}`,
                  "",
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
                text: `Failed to read Google Sheet (${spreadsheetId}): ${message}`,
              },
            ],
          };
        }
      },
    ),
  ],
});

function extractDocumentId(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }
  const plainMatch = trimmed.match(/^[a-zA-Z0-9_-]{20,}$/);
  return plainMatch ? plainMatch[0] : null;
}

function renderBodyToText(
  elements: docs_v1.Schema$StructuralElement[],
): string {
  let output = "";
  for (const element of elements) {
    if (element.paragraph?.elements) {
      output += renderParagraph(element.paragraph.elements);
    } else if (element.table?.tableRows) {
      output += renderTable(element.table.tableRows);
    } else if (element.tableOfContents?.content) {
      output += renderBodyToText(element.tableOfContents.content);
    }
  }
  return output;
}

function renderParagraph(
  elements: docs_v1.Schema$ParagraphElement[],
): string {
  let text = "";
  for (const elem of elements) {
    if (elem.textRun?.content) {
      text += elem.textRun.content;
    }
  }
  if (!text.endsWith("\n")) {
    text += "\n";
  }
  return text;
}

function renderTable(rows: docs_v1.Schema$TableRow[]): string {
  const renderedRows = rows.map((row) => {
    const cells = row.tableCells ?? [];
    return cells
      .map((cell) => renderBodyToText(cell.content ?? []))
      .join(" | ");
  });
  return `${renderedRows.join("\n")}\n`;
}

function extractSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }
  const plainMatch = trimmed.match(/^[a-zA-Z0-9_-]{20,}$/);
  return plainMatch ? plainMatch[0] : null;
}

function normalizeSheetRange(
  range: string | undefined,
  sheetTitles: string[],
): { range: string; sheetTitle: string; usedDefaultRange: boolean } {
  const fallbackSheet = sheetTitles[0] ?? "Sheet1";
  const trimmed = range?.trim();

  if (trimmed && trimmed.includes("!")) {
    const sheetTitle = trimmed.split("!")[0] || fallbackSheet;
    const displaySheetTitle = sheetTitle
      .replace(/^'+|'+$/g, "")
      .replace(/''/g, "'")
      .trim();
    return {
      range: trimmed,
      sheetTitle: displaySheetTitle || fallbackSheet,
      usedDefaultRange: false,
    };
  }

  const chosenRange = trimmed && trimmed.length > 0 ? trimmed : DEFAULT_SHEET_RANGE;
  const safeSheetForRange = quoteSheetTitle(fallbackSheet);
  return {
    range: `${safeSheetForRange}!${chosenRange}`,
    sheetTitle: fallbackSheet,
    usedDefaultRange: !(trimmed && trimmed.length > 0),
  };
}

function quoteSheetTitle(title: string): string {
  if (title.match(/[\s']/)) {
    const escaped = title.replace(/'/g, "''");
    return `'${escaped}'`;
  }
  return title;
}

function renderSheetValues(
  values: sheets_v4.Schema$ValueRange["values"] | null | undefined,
): string {
  if (!values?.length) {
    return "";
  }

  const limited = values.slice(0, MAX_SHEET_ROWS_TO_RENDER);
  const normalizedRows = limited.map((row) =>
    row.map((cell) => {
      if (cell === null || cell === undefined) {
        return "";
      }
      if (typeof cell === "string") {
        return cell.replace(/\r?\n/g, " ").trim();
      }
      return String(cell);
    }),
  );

  const lines = normalizedRows.map((row) => row.join(" | ")).join("\n");
  const truncated = values.length > MAX_SHEET_ROWS_TO_RENDER;
  return truncated
    ? `${lines}\n\n[Truncated to first ${MAX_SHEET_ROWS_TO_RENDER} rows.]`
    : lines;
}

