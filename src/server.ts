import express from "express";
import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { WebClient } from "@slack/web-api";
import { TallySchema, type Tally } from "../tally";
import {
  exchangeDriveAuthCode,
  getDriveOAuthRedirectUri,
} from "./googleDrive";
import {
  buildFacebookOAuthUrl,
  exchangeFacebookAuthCode,
  getFacebookOAuthRedirectUri,
  getLongLivedToken,
  getAdAccounts,
  getAds,
  scrapeAdsLibrary,
  isFacebookConfigured,
} from "./facebook";
import path from "path";
import fs from "fs";
import { runResearch } from "./research/index";
import { OUTPUT_ROOT } from "./config/paths";

const app = express();
app.use(express.json());

app.get("/api/health", async (req: Request, res: Response) => {
  const checks = {
    server: "ok",
    timestamp: new Date().toISOString(),
    environment: {
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      SLACK_BOT_TOKEN: !!process.env.SLACK_BOT_TOKEN,
      GOOGLE_DRIVE_CLIENT_ID: !!process.env.GOOGLE_DRIVE_CLIENT_ID,
      GOOGLE_DRIVE_CLIENT_SECRET: !!process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      GOOGLE_DRIVE_REFRESH_TOKEN: !!process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
      FACEBOOK_APP_ID: !!process.env.FACEBOOK_APP_ID,
      FACEBOOK_APP_SECRET: !!process.env.FACEBOOK_APP_SECRET,
      VALYU_API_KEY: !!process.env.VALYU_API_KEY,
    },
    config: {
      slackUploadChannel: process.env.SLACK_DRIVE_UPLOAD_CHANNEL ?? "C09MVERJFBK (default)",
      slackNewClientChannel: process.env.SLACK_NEW_CLIENT_CHANNEL ?? "C09MVERJFBK (default)",
    },
    warnings: [] as string[],
  };

  // Check for critical missing environment variables
  if (!process.env.ANTHROPIC_API_KEY) {
    checks.warnings.push("ANTHROPIC_API_KEY is not set - workflow will fail!");
  }
  if (!process.env.SLACK_BOT_TOKEN) {
    checks.warnings.push("SLACK_BOT_TOKEN is not set - Slack notifications disabled");
  }
  if (!process.env.GOOGLE_DRIVE_CLIENT_ID || !process.env.GOOGLE_DRIVE_CLIENT_SECRET || !process.env.GOOGLE_DRIVE_REFRESH_TOKEN) {
    checks.warnings.push("Google Drive OAuth not fully configured - uploads disabled");
  }

  // Check if .claude directory exists in the expected locations
  const claudeConfigDir = path.join(OUTPUT_ROOT, ".claude");

  const claudeDirExists = fs.existsSync(claudeConfigDir);
  (checks as any).claudeConfig = {
    outputDir: OUTPUT_ROOT,
    claudeConfigExists: claudeDirExists,
  };

  if (!claudeDirExists) {
    checks.warnings.push(`.claude directory not found at ${claudeConfigDir}`);
  }

  const status = checks.warnings.length === 0 ? 200 : 503;
  res.status(status).json(checks);
});

app.get("/api/google/oauth/callback", async (req: Request, res: Response) => {
  const { code, error, state } = req.query;
  if (typeof error === "string") {
    res
      .status(400)
      .send(
        renderOAuthResultPage({
          success: false,
          heading: "Authorization Failed",
          details: `Google returned an error: ${error}`,
        }),
      );
    return;
  }
  if (typeof code !== "string" || !code) {
    res
      .status(400)
      .send(
        renderOAuthResultPage({
          success: false,
          heading: "Missing Authorization Code",
          details: "No ?code parameter was provided by Google.",
        }),
      );
    return;
  }

  try {
    const tokens = await exchangeDriveAuthCode(code);
    const redirectUri = getDriveOAuthRedirectUri();
    res.send(
      renderOAuthResultPage({
        success: true,
        heading: "Google Drive OAuth Complete",
        details:
          "Copy the refresh token below into your `.env`, redeploy/restart the app, and reply in Slack once done.",
        refreshToken: tokens.refresh_token ?? undefined,
        accessToken: tokens.access_token ?? undefined,
        scope: tokens.scope ?? undefined,
        expiresIn: tokens.expiry_date
          ? Math.round((tokens.expiry_date - Date.now()) / 1000)
          : undefined,
        stateToken: typeof state === "string" ? state : undefined,
        redirectUri,
      }),
    );
  } catch (authError) {
    const errMessage =
      authError instanceof Error ? authError.message : "Unknown error";
    res
      .status(500)
      .send(
        renderOAuthResultPage({
          success: false,
          heading: "Token Exchange Failed",
          details: errMessage,
        }),
      );
  }
});

// Facebook OAuth - Start authorization
app.get("/api/facebook/oauth", (req: Request, res: Response) => {
  if (!isFacebookConfigured()) {
    res.status(500).json({ error: "Facebook App not configured" });
    return;
  }
  const state = req.query.state as string | undefined;
  const authUrl = buildFacebookOAuthUrl(state);
  res.redirect(authUrl);
});

// Facebook OAuth - Callback
app.get("/api/facebook/oauth/callback", async (req: Request, res: Response) => {
  const { code, error, error_description } = req.query;

  if (error) {
    res.status(400).send(
      renderOAuthResultPage({
        success: false,
        heading: "Facebook Authorization Failed",
        details: `${error}: ${error_description ?? "Unknown error"}`,
      })
    );
    return;
  }

  if (typeof code !== "string" || !code) {
    res.status(400).send(
      renderOAuthResultPage({
        success: false,
        heading: "Missing Authorization Code",
        details: "No code parameter was provided by Facebook.",
      })
    );
    return;
  }

  try {
    const tokens = await exchangeFacebookAuthCode(code);
    const longLivedTokens = await getLongLivedToken(tokens.accessToken);

    res.send(
      renderOAuthResultPage({
        success: true,
        heading: "Facebook OAuth Complete",
        details: "Copy the access token below into your environment variables.",
        accessToken: longLivedTokens.accessToken,
        expiresIn: longLivedTokens.expiresIn,
        redirectUri: getFacebookOAuthRedirectUri(),
      })
    );
  } catch (authError) {
    const errMessage = authError instanceof Error ? authError.message : "Unknown error";
    res.status(500).send(
      renderOAuthResultPage({
        success: false,
        heading: "Facebook Token Exchange Failed",
        details: errMessage,
      })
    );
  }
});

// Get Facebook Ad Accounts
app.get("/api/facebook/ad-accounts", async (req: Request, res: Response) => {
  const accessToken = req.headers.authorization?.replace("Bearer ", "") ||
    (req.query.access_token as string);

  if (!accessToken) {
    res.status(401).json({ error: "Access token required" });
    return;
  }

  try {
    const accounts = await getAdAccounts(accessToken);
    res.json({ data: accounts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Get Ads from an Ad Account
app.get("/api/facebook/ads/:adAccountId", async (req: Request, res: Response) => {
  const { adAccountId } = req.params;
  const accessToken = req.headers.authorization?.replace("Bearer ", "") ||
    (req.query.access_token as string);
  const limit = parseInt(req.query.limit as string) || 50;
  const status = req.query.status as string | undefined;

  if (!accessToken) {
    res.status(401).json({ error: "Access token required" });
    return;
  }

  try {
    const ads = await getAds(accessToken, adAccountId, { limit, status });
    res.json({ data: ads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Scrape Facebook Ads Library (public, no auth needed)
app.get("/api/facebook/ads-library", async (req: Request, res: Response) => {
  const { q, country = "US", limit = "20" } = req.query;

  if (!q || typeof q !== "string") {
    res.status(400).json({ error: "Query parameter 'q' is required (brand/page name)" });
    return;
  }

  try {
    const ads = await scrapeAdsLibrary(q, {
      country: country as string,
      limit: parseInt(limit as string),
    });
    res.json({ data: ads, query: q, count: ads.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

const DEFAULT_ALERT_CHANNEL_ID = "C09MVERJFBK";
const WEBSITE_FIELD_KEYWORDS = [
  "website",
  "site",
  "url",
  "link",
  "domain",
  "store",
  "shop",
];
const ACTION_ASSIGNEES = [
  { userId: "U03V4E6LJDC", task: "make the slack" },
  { userId: "U07JMFQQ8DS", task: "To make notion/wrike + tracker + bookmarks" },
  { userId: "U0409M216GZ", task: "Scripts + assign workload" },
];

let slackWebClient: WebClient | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

app.post("/api/webhook", async (req: Request, res: Response) => {
  if (!isRecord(req.body)) {
    res.status(400).json({
      status: "error",
      message: "Invalid JSON payload.",
    });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const outputDir =
    typeof body.outputDir === "string" ? (body.outputDir as string) : undefined;

  const uploadToDrive =
    typeof body.uploadToDrive === "boolean" ? body.uploadToDrive : true;
  const rawDriveBrandLabel =
    typeof body.driveBrandLabel === "string"
      ? body.driveBrandLabel.trim() || undefined
      : undefined;
  const parsedTally = TallySchema.safeParse(body);
  const tallyBrandLabel = parsedTally.success
    ? deriveWebsiteFromTally(parsedTally.data)
    : undefined;
  const driveBrandLabel = rawDriveBrandLabel ?? tallyBrandLabel;

  const bodyWithoutMeta = Object.fromEntries(
    Object.entries(body).filter(
      ([key]) => !["outputDir", "uploadToDrive", "driveBrandLabel"].includes(key),
    ),
  );
  const promptData =
    "data" in body && body.data !== undefined
      ? body.data
      : bodyWithoutMeta;

  if (typeof promptData === "undefined") {
    res.status(400).json({
      status: "error",
      message: "Webhook payload must include data to research.",
    });
    return;
  }

  // Post immediate Slack alert for new Tally submissions (non-blocking)
  handleTallyNewClientAlert(req.body).catch((error) => {
    console.warn("Failed to send Tally new-client alert:", error);
  });

  const requestId = randomUUID();

  // Log received webhook data
  console.log(`[webhook:${requestId}] Received webhook request`);
  console.log(`[webhook:${requestId}] Upload to Drive: ${uploadToDrive}`);
  console.log(`[webhook:${requestId}] Brand Label: ${driveBrandLabel ?? 'none'}`);
  console.log(`[webhook:${requestId}] Output Dir: ${outputDir ?? 'auto-generated'}`);
  console.log(`[webhook:${requestId}] Prompt Data Type: ${typeof promptData}`);

  // Check environment variables
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const hasSlackToken = !!process.env.SLACK_BOT_TOKEN;
  console.log(`[webhook:${requestId}] ANTHROPIC_API_KEY: ${hasAnthropicKey ? 'SET' : 'MISSING'}`);
  console.log(`[webhook:${requestId}] SLACK_BOT_TOKEN: ${hasSlackToken ? 'SET' : 'MISSING'}`);

  if (!hasAnthropicKey) {
    console.error(`[webhook:${requestId}] ERROR: ANTHROPIC_API_KEY is not set! Workflow will fail.`);
  }

  res.status(200).json({
    status: "started",
    requestId,
    uploadToDrive,
  });

  console.log(`[webhook:${requestId}] Starting research workflow...`);

  runResearch({
    promptData,
    outputDir,
    uploadToDrive,
    driveBrandLabel,
    onLog: (message) => {
      console.log(`[research:${requestId}] ${message}`);
    },
  })
    .then((result) => {
      const link =
        result.driveFile?.webViewLink ?? result.driveFile?.webContentLink ?? "";
      console.log(
        `[research:${requestId}] COMPLETED in ${result.outputDir} ${
          link ? `Drive: ${link}` : ""
        }`,
      );
    })
    .catch((error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      const errorStack = error instanceof Error ? error.stack : '';
      console.error(
        `[research:${requestId}] WORKFLOW FAILED: ${errorMessage}`,
      );
      console.error(`[research:${requestId}] Error stack:`, errorStack);
      console.error(`[research:${requestId}] Full error object:`, error);
    });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Research API listening on port ${port}`);
});

function renderOAuthResultPage({
  success,
  heading,
  details,
  refreshToken,
  accessToken,
  scope,
  expiresIn,
  stateToken,
  redirectUri,
}: {
  success: boolean;
  heading: string;
  details: string;
  refreshToken?: string;
  accessToken?: string | null;
  scope?: string | null;
  expiresIn?: number;
  stateToken?: string;
  redirectUri?: string;
}): string {
  const items: string[] = [];
  if (refreshToken) {
    items.push(
      `<li><strong>Refresh Token:</strong> <code>${escapeHtml(refreshToken)}</code></li>`,
    );
  } else {
    items.push(
      "<li><strong>Refresh Token:</strong> not provided (make sure prompt=consent & access_type=offline)</li>",
    );
  }
  if (accessToken) {
    items.push(
      `<li><strong>Access Token:</strong> <code>${escapeHtml(accessToken)}</code></li>`,
    );
  }
  if (typeof expiresIn === "number") {
    items.push(`<li><strong>Access Token Expires In:</strong> ${expiresIn}s</li>`);
  }
  if (scope) {
    items.push(`<li><strong>Scopes:</strong> ${escapeHtml(scope)}</li>`);
  }
  if (stateToken) {
    items.push(`<li><strong>State:</strong> ${escapeHtml(stateToken)}</li>`);
  }
  if (redirectUri) {
    items.push(`<li><strong>Redirect URI:</strong> ${escapeHtml(redirectUri)}</li>`);
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading)}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 2rem; line-height: 1.6; }
      h1 { color: ${success ? "#1a7f37" : "#b42318"}; }
      code { background: #f2f4f7; padding: 0.2rem 0.4rem; border-radius: 4px; word-break: break-all; }
      ul { padding-left: 1.25rem; }
      li { margin-bottom: 0.4rem; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(heading)}</h1>
    <p>${escapeHtml(details)}</p>
    <ul>
      ${items.join("\n      ")}
    </ul>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function handleTallyNewClientAlert(payload: unknown): Promise<void> {
  const parsed = TallySchema.safeParse(payload);
  if (!parsed.success) {
    return;
  }
  const brandWebsite = deriveWebsiteFromTally(parsed.data);
  await postSlackNewClientAlert(brandWebsite);
}

function deriveWebsiteFromTally(tally: Tally): string | undefined {
  return (
    extractWebsiteFromFields(tally.data.fields) ??
    extractWebsiteFromObject(tally.data)
  );
}

async function postSlackNewClientAlert(brandWebsite?: string): Promise<void> {
  const client = ensureSlackWebClient();
  if (!client) {
    return;
  }

  const channelId =
    process.env.SLACK_NEW_CLIENT_CHANNEL ?? DEFAULT_ALERT_CHANNEL_ID;
  const text = buildNewClientAlertMessage({
    brandWebsite,
    channelIdToMention:
      process.env.SLACK_NEW_CLIENT_CHANNEL_MENTION ?? channelId,
  });

  try {
    await client.chat.postMessage({
      channel: channelId,
      text,
    });
  } catch (error) {
    console.error("Failed to send Slack new client alert:", error);
  }
}

function ensureSlackWebClient(): WebClient | undefined {
  if (slackWebClient) {
    return slackWebClient;
  }
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.warn(
      "Skipping Slack new client alert because SLACK_BOT_TOKEN is not set.",
    );
    return undefined;
  }
  slackWebClient = new WebClient(token);
  return slackWebClient;
}

function buildNewClientAlertMessage({
  brandWebsite,
  channelIdToMention
}: {
  brandWebsite?: string
  channelIdToMention: string
}): string {

  const websiteDisplay = brandWebsite?.trim() || "TBD";

  const channelMention = `<#${channelIdToMention}>`;
  const channelCallout = "<!channel>";

  const headerLine = `🚨 🚨 🚨  New Client  🚨 🚨 🚨  ${channelCallout}`;

  const messageLines = [
    headerLine,
    "",
    `Brand: (${websiteDisplay})`,
    "",
    "Ads = (Market Research, 7x5 Podcast 5x5 UGC)",
    "",
    "Starts: (ASAP)",
    "",
    "Action Items:",
    "",
    // This matches EXACTLY the style of Hamza's example
    ...ACTION_ASSIGNEES.map(
      ({ userId, task }) => `<@${userId}> ${task}`
    )
  ];

  return messageLines.join("\n");
}


function extractWebsiteFromFields(fields: unknown): string | undefined {
  if (!Array.isArray(fields)) {
    return undefined;
  }

  const fallback: string[] = [];
  for (const field of fields) {
    if (!isRecord(field)) {
      continue;
    }
    const label = captureString(field.label) ?? "";
    const value = captureString(field.value);
    if (!value) {
      continue;
    }

    if (
      label &&
      WEBSITE_FIELD_KEYWORDS.some((keyword) =>
        label.toLowerCase().includes(keyword),
      )
    ) {
      return value;
    }

    if (looksLikeUrl(value)) {
      fallback.push(value);
    }
  }

  return fallback[0];
}

function extractWebsiteFromObject(
  source: unknown,
  depth = 0,
): string | undefined {
  if (!isRecord(source) || depth > 3) {
    return undefined;
  }

  const fallback: string[] = [];
  for (const [key, value] of Object.entries(source)) {
    const stringValue = captureString(value);
    if (stringValue) {
      const keyLower = key.toLowerCase();
      if (
        WEBSITE_FIELD_KEYWORDS.some((keyword) => keyLower.includes(keyword))
      ) {
        return stringValue;
      }
      if (looksLikeUrl(stringValue)) {
        fallback.push(stringValue);
      }
      continue;
    }

    if (key === "fields" && Array.isArray(value)) {
      const fromFields = extractWebsiteFromFields(value);
      if (fromFields) {
        return fromFields;
      }
      continue;
    }

    if (isRecord(value)) {
      const nested = extractWebsiteFromObject(value, depth + 1);
      if (nested) {
        return nested;
      }
    }
  }

  return fallback[0];
}

function captureString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function looksLikeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (/https?:\/\//i.test(trimmed)) {
    return true;
  }
  if (/\s/.test(trimmed)) {
    return /(https?:\/\/|www\.)/i.test(trimmed);
  }
  return (
    trimmed.includes(".com") ||
    trimmed.includes(".co") ||
    trimmed.includes(".io") ||
    trimmed.includes(".net") ||
    trimmed.includes(".org")
  );
}
