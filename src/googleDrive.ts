import fs from "fs";
import { promises as fsPromises } from "fs";
import path from "path";
import { google, drive_v3 } from "googleapis";
import { spawn } from "child_process";
import type { OAuth2Client, Credentials } from "google-auth-library";
import { WebClient } from "@slack/web-api";

const PDF_SUFFIX = "_Complete_Research_Report.pdf";
const DEFAULT_FOLDER_ID = "1SaFefdyoT8lFgTr3edb-swIoIeRGWLKh";
const DEFAULT_REDIRECT_PATH = "/api/google/oauth/callback";
const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive", // full read/write on all Drive files
  "https://www.googleapis.com/auth/documents", // full Google Docs read/write
  "https://www.googleapis.com/auth/spreadsheets", // full Google Sheets read/write
  "https://www.googleapis.com/auth/drive.metadata", // read metadata for all files
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "openid",
  "email",
  "profile",
];

const SLACK_UPLOAD_CHANNEL =
  process.env.SLACK_DRIVE_UPLOAD_CHANNEL ?? "C09MVERJFBK";
const SLACK_OAUTH_ALERT_CHANNEL =
  process.env.SLACK_OAUTH_ALERT_CHANNEL ?? "C09L1HZ5LBC";
const SLACK_OAUTH_ALERT_USER = process.env.SLACK_OAUTH_ALERT_USER ?? "U07MH6ALH7U";

let slackClient: WebClient | undefined;

export interface DriveUploadMetadata {
  fileId: string;
  name: string;
  webViewLink?: string;
  webContentLink?: string;
}

export interface DriveUploadOptions {
  brandLabel?: string;
  companyUrl?: string;
  announceInSlack?: boolean;
  onLog?: (message: string) => void;
}

export async function getAuthorizedGoogleClient(
  onLog?: (message: string) => void,
): Promise<OAuth2Client> {
  const { clientId, clientSecret } = ensureDriveClientCredentials();
  const { GOOGLE_DRIVE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_DRIVE_REFRESH_TOKEN) {
    throw new Error("GOOGLE_DRIVE_REFRESH_TOKEN is not configured.");
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: GOOGLE_DRIVE_REFRESH_TOKEN });

  try {
    await ensureAccessToken(auth);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown OAuth error occurred";
    onLog?.(`Drive auth refresh failed: ${message}`);
    await notifyOAuthFailure(message);
    throw error;
  }

  return auth;
}

interface DriveClientCredentials {
  clientId: string;
  clientSecret: string;
}

interface DriveConfig extends DriveClientCredentials {
  refreshToken: string;
  folderId: string;
}

export function isDriveUploadConfigured(): boolean {
  const {
    GOOGLE_DRIVE_CLIENT_ID,
    GOOGLE_DRIVE_CLIENT_SECRET,
    GOOGLE_DRIVE_REFRESH_TOKEN,
  } = process.env;
  return Boolean(
    GOOGLE_DRIVE_CLIENT_ID &&
      GOOGLE_DRIVE_CLIENT_SECRET &&
      GOOGLE_DRIVE_REFRESH_TOKEN,
  );
}

export function getDriveOAuthRedirectUri(): string {
  const baseUrl = getPublicBaseUrl();
  return `${baseUrl}${DEFAULT_REDIRECT_PATH}`;
}

export function buildDriveOAuthUrl(stateId?: string): string {
  const { clientId } = ensureDriveClientCredentials();
  const redirectUri = getDriveOAuthRedirectUri();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    scope: DRIVE_SCOPES.join(" "),
  });
  if (stateId) {
    params.set("state", stateId);
  }
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeDriveAuthCode(code: string): Promise<Credentials> {
  const { clientId, clientSecret } = ensureDriveClientCredentials();
  const redirectUri = getDriveOAuthRedirectUri();
  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const { tokens } = await auth.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "OAuth response did not include a refresh_token. Add prompt=consent & access_type=offline and try again.",
    );
  }
  return tokens;
}

export async function uploadResearchPdf(
  projectDir: string,
  options: DriveUploadOptions = {},
): Promise<DriveUploadMetadata> {
  const pdf = await ensureResearchPdfAvailable(projectDir, options.onLog);
  if (!pdf) {
    throw new Error(
      `No "${PDF_SUFFIX}" file found inside ${projectDir}. Generate the PDF before uploading.`,
    );
  }

  options.onLog?.(
    `Preparing Drive upload from ${pdf.relativePath} (modified ${new Date(pdf.mtimeMs).toISOString()})`,
  );

  const config = getDriveConfig();
  const auth = await getAuthorizedGoogleClient(options.onLog);
  const drive = google.drive({ version: "v3", auth });
  const requestBody: drive_v3.Schema$File = {
    name: pdf.name,
    parents: [config.folderId],
  };
  const media = {
    mimeType: "application/pdf",
    body: fs.createReadStream(pdf.path),
  };

  const createResponse = await drive.files.create({
    requestBody,
    media,
    fields: "id, name, webViewLink, webContentLink",
  });

  const file = createResponse.data;
  if (!file.id) {
    throw new Error("Google Drive API did not return a file ID.");
  }

  await ensureAnyoneWithLinkCanView(drive, file.id);

  const metadata: DriveUploadMetadata = {
    fileId: file.id,
    name: file.name ?? pdf.name,
    webViewLink: file.webViewLink ?? undefined,
    webContentLink: file.webContentLink ?? undefined,
  };

  if (options.announceInSlack !== false) {
    await announceDriveUpload(metadata, options.brandLabel, options.companyUrl, options.onLog);
  }

  return metadata;
}

async function ensureResearchPdfAvailable(
  projectDir: string,
  onLog?: (message: string) => void,
): Promise<
  | {
      path: string;
      name: string;
      relativePath: string;
      mtimeMs: number;
    }
  | undefined
> {
  const existing = await findLatestResearchPdf(projectDir, onLog);
  if (existing) {
    return existing;
  }

  const compiled = await tryAutoCompileResearchPdf(projectDir, onLog);
  if (!compiled) {
    return undefined;
  }

  return findLatestResearchPdf(projectDir, onLog);
}

async function findLatestResearchPdf(
  projectDir: string,
  onLog?: (message: string) => void,
): Promise<
  | {
      path: string;
      name: string;
      relativePath: string;
      mtimeMs: number;
    }
  | undefined
> {
  const searchRoots = new Set<string>([projectDir]);

  // If the agent nested "Projects/<brand>_Research" inside the provided projectDir, search there too.
  const brandDirName = path.basename(projectDir);
  const nestedProjects = path.join(projectDir, "Projects", brandDirName);
  if (fs.existsSync(nestedProjects)) {
    searchRoots.add(nestedProjects);
    onLog?.(
      `Including nested search path for PDF: ${path.relative(projectDir, nestedProjects)}`,
    );
  }

  // Some agent runs write to /tmp/code/Projects/<brand>_Research inside the container.
  const tmpCodeRoot = path.join("/tmp/code/Projects", brandDirName);
  if (fs.existsSync(tmpCodeRoot)) {
    searchRoots.add(tmpCodeRoot);
    onLog?.(`Including /tmp/code search path for PDF: ${tmpCodeRoot}`);
  }

  // Search recursively to catch PDFs created in nested folders (common in agent runs)
  const stack = Array.from(searchRoots);
  const candidates: Array<{
    path: string;
    name: string;
    relativePath: string;
    mtimeMs: number;
  }> = [];

  while (stack.length > 0) {
    const currentDir = stack.pop() as string;
    const entries = await fsPromises.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(PDF_SUFFIX)) {
        const stats = await fsPromises.stat(fullPath);
        candidates.push({
          path: fullPath,
          name: entry.name,
          relativePath: path.relative(projectDir, fullPath) || entry.name,
          mtimeMs: stats.mtimeMs,
        });
      }
    }
  }

  if (candidates.length === 0) {
    onLog?.(
      `No PDF matching "*${PDF_SUFFIX}" found in ${projectDir} (searched recursively).`,
    );
    return undefined;
  }

  const latest = candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0]!;
  onLog?.(
    `Found PDF candidate: ${latest.relativePath} (modified ${new Date(latest.mtimeMs).toISOString()})`,
  );
  return latest;
}

async function tryAutoCompileResearchPdf(
  projectDir: string,
  onLog?: (message: string) => void,
): Promise<boolean> {
  onLog?.(
    `No PDF found. Attempting automatic compile to create "*${PDF_SUFFIX}" in ${projectDir}...`,
  );

  const compileScripts = getCompileScriptCandidates(projectDir);
  for (const scriptPath of compileScripts) {
    if (!fs.existsSync(scriptPath)) {
      continue;
    }
    const scriptDir = path.dirname(scriptPath);
    onLog?.(
      `[Drive] Found compile script candidate: ${path.relative(projectDir, scriptPath)}`,
    );
    const ok = await runPythonScript(scriptPath, scriptDir, onLog);
    if (ok) {
      onLog?.(
        `[Drive] PDF compilation succeeded via ${path.relative(projectDir, scriptPath)}`,
      );
      return true;
    }
  }

  const generatedScript = await generateAutoCompileScript(projectDir, onLog);
  if (!generatedScript) {
    onLog?.(
      `[Drive] Unable to auto-generate compile script because no markdown files were found.`,
    );
    return false;
  }

  const generatedOk = await runPythonScript(
    generatedScript,
    path.dirname(generatedScript),
    onLog,
  );
  if (generatedOk) {
    onLog?.(
      `[Drive] PDF compilation succeeded via generated script ${path.relative(
        projectDir,
        generatedScript,
      )}`,
    );
  }
  return generatedOk;
}

function getCompileScriptCandidates(projectDir: string): string[] {
  const candidates = new Set<string>();
  const primary = path.join(projectDir, "compile_pdf.py");
  const auto = path.join(projectDir, "compile_pdf.auto.py");
  candidates.add(primary);
  candidates.add(auto);

  // Handle nested "Projects/<brand>" layout some agents create.
  const brandDir = path.basename(projectDir);
  const nested = path.join(projectDir, "Projects", brandDir, "compile_pdf.py");
  candidates.add(nested);

  return Array.from(candidates);
}

async function generateAutoCompileScript(
  projectDir: string,
  onLog?: (message: string) => void,
): Promise<string | undefined> {
  const markdownFiles = await gatherMarkdownFiles(projectDir);
  if (markdownFiles.length === 0) {
    return undefined;
  }

  const brandLabel = deriveBrandLabel(projectDir);
  const safeBrand = brandLabel.replace(/["\\]/g, "");
  const pdfName = `${safeBrand || "Research_Project"}_Complete_Research_Report.pdf`;
  const scriptPath = path.join(projectDir, "compile_pdf.auto.py");

  onLog?.(
    `[Drive] Generating ${path.relative(projectDir, scriptPath)} with ${
      markdownFiles.length
    } markdown files.`,
  );

  const escapedFiles = markdownFiles
    .map((relPath) => relPath.replace(/\\/g, "/"))
    .map((relPath) => `    "${relPath}",`)
    .join("\n");

  const scriptContent = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
\"\"\"
Auto-generated PDF compiler for research outputs
\"\"\"

import os
import sys
import markdown
from weasyprint import HTML, CSS
from datetime import datetime

# Ensure UTF-8 output (helps on Windows consoles)
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

project_dir = r"${projectDir.replace(/\\/g, "\\\\")}"
output_file = os.path.join(project_dir, "${pdfName}")

markdown_files = [
${escapedFiles}
]

cover_brand = "${safeBrand}"

custom_css = CSS(string=\"\"\"
    @page {
        size: letter;
        margin: 1in;
        @bottom-center {
            content: "Page " counter(page) " of " counter(pages);
            font-size: 9pt;
            color: #666;
        }
    }

    body {
        font-family: 'Georgia', 'Times New Roman', serif;
        font-size: 11pt;
        line-height: 1.6;
        color: #333;
    }

    h1 {
        font-size: 24pt;
        font-weight: bold;
        margin-top: 24pt;
        margin-bottom: 12pt;
        page-break-before: always;
        color: #1a1a1a;
        border-bottom: 2px solid #333;
        padding-bottom: 8pt;
    }

    h1:first-of-type { page-break-before: auto; }

    h2 { font-size: 18pt; font-weight: bold; margin-top: 18pt; margin-bottom: 10pt; color: #2a2a2a; }
    h3 { font-size: 14pt; font-weight: bold; margin-top: 14pt; margin-bottom: 8pt; color: #3a3a3a; }
    h4, h5, h6 { font-size: 12pt; font-weight: bold; margin-top: 12pt; margin-bottom: 6pt; color: #4a4a4a; }

    p { margin-bottom: 10pt; text-align: justify; }
    ul, ol { margin-left: 20pt; margin-bottom: 10pt; }
    li { margin-bottom: 5pt; }

    table { width: 100%; border-collapse: collapse; margin: 15pt 0; font-size: 10pt; }
    th, td { border: 1px solid #ddd; padding: 8pt; text-align: left; }
    th { background-color: #f2f2f2; font-weight: bold; }

    code { font-family: 'Courier New', monospace; background-color: #f5f5f5; padding: 2pt 4pt; border-radius: 3pt; font-size: 9pt; }
    pre { background-color: #f5f5f5; padding: 10pt; border-radius: 5pt; overflow-x: auto; margin: 10pt 0; border-left: 3px solid #666; }
    pre code { background-color: transparent; padding: 0; }

    blockquote { border-left: 4px solid #ccc; padding-left: 15pt; margin-left: 0; color: #666; font-style: italic; }
    hr { border: none; border-top: 1px solid #ccc; margin: 20pt 0; }
    a { color: #0066cc; text-decoration: none; }
    .page-break { page-break-after: always; }
\"\"\")


def build_table_of_contents(files):
    toc_lines = ["<div class=\\"toc\\">", "<h1>Table of Contents</h1>", "<ol>"]
    for idx, filename in enumerate(files, 1):
        toc_lines.append(f"<li>{idx}. {filename}</li>")
    toc_lines.append("</ol></div>")
    toc_lines.append('<div class="page-break"></div>')
    return "\\n".join(toc_lines)


def compile_markdown_to_pdf():
    if not markdown_files:
        print("No markdown files provided; cannot compile PDF.")
        sys.exit(1)

    html_parts = []

    cover_title = cover_brand.replace("_", " ") if cover_brand else "Research Report"
    today = datetime.utcnow().strftime("%Y-%m-%d")
    html_parts.append(f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset='utf-8'><title>{cover_title} Research Report</title></head>
    <body>
    <div style='text-align: center; margin-top: 180pt;'>
        <h1 style='font-size: 36pt; border: none; page-break-before: auto;'>{cover_title}</h1>
        <p style='font-size: 13pt; color: #666; margin-top: 12pt;'>Complete Research & Script Report</p>
        <p style='font-size: 11pt; color: #888; margin-top: 8pt;'>Generated on {today}</p>
    </div>
    <div class='page-break'></div>
    """)

    html_parts.append(build_table_of_contents(markdown_files))

    md_converter = markdown.Markdown(extensions=["tables", "fenced_code", "nl2br", "sane_lists"])
    for rel_path in markdown_files:
        file_path = os.path.join(project_dir, rel_path)
        if not os.path.exists(file_path):
            print(f"Skipping missing file: {file_path}")
            continue
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        html_content = md_converter.convert(content)
        md_converter.reset()
        html_parts.append(html_content)
        html_parts.append("<div class='page-break'></div>")

    html_parts.append("</body></html>")
    full_html = "\\n".join(html_parts)

    HTML(string=full_html).write_pdf(output_file, stylesheets=[custom_css])
    print(f"PDF created at: {output_file}")


if __name__ == "__main__":
    compile_markdown_to_pdf()
`;

  await fsPromises.writeFile(scriptPath, scriptContent, "utf8");
  return scriptPath;
}

async function gatherMarkdownFiles(projectDir: string): Promise<string[]> {
  const preferenceOrder = [
    "QUICK_REFERENCE.md",
    "01_Foundation/foundation_analysis.md",
    "02_Audience/audience_intelligence.md",
    "03_Content/content_performance.md",
    "04_Competitive/competitive_intelligence.md",
    "05_Synthesis/strategic_synthesis.md",
    "06_Scripts/UGC_Scripts.md",
    "06_Scripts/Podcast_Scripts.md",
    "06_Scripts/FINAL_SCRIPTS.md",
  ];

  // Files to exclude from the final PDF (intake/Tally submission data)
  const excludeFiles = new Set([
    "00_INTAKE_BRIEF.md",
  ]);

  const orderedExisting = preferenceOrder.filter((relPath) =>
    fs.existsSync(path.join(projectDir, relPath)),
  );

  const discovered = await listMarkdownFilesRecursively(projectDir);
  const seen = new Set<string>(orderedExisting);
  const merged: string[] = [...orderedExisting];

  for (const rel of discovered) {
    if (!seen.has(rel) && !excludeFiles.has(rel)) {
      merged.push(rel);
      seen.add(rel);
    }
  }

  return merged;
}

async function listMarkdownFilesRecursively(projectDir: string): Promise<string[]> {
  const stack: string[] = [projectDir];
  const results: string[] = [];
  const skipDirs = new Set([".git", "node_modules", ".claude", "__pycache__"]);

  while (stack.length > 0) {
    const currentDir = stack.pop() as string;
    const entries = await fsPromises.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (skipDirs.has(entry.name)) {
        continue;
      }
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        const rel = path
          .relative(projectDir, fullPath)
          .split(path.sep)
          .join("/");
        results.push(rel);
      }
    }
  }

  results.sort();
  return results;
}

async function runPythonScript(
  scriptPath: string,
  cwd: string,
  onLog?: (message: string) => void,
): Promise<boolean> {
  const commands = ["python3", "python"];
  for (const cmd of commands) {
    try {
      const ok = await runProcess(cmd, [scriptPath], cwd, onLog);
      if (ok) {
        return true;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onLog?.(`[Drive] Failed running ${cmd} ${scriptPath}: ${message}`);
    }
  }
  return false;
}

async function runProcess(
  cmd: string,
  args: string[],
  cwd: string,
  onLog?: (message: string) => void,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });
    proc.on("error", (error) => {
      reject(error);
    });
    proc.on("close", (code) => {
      const exitCode = code ?? 0;
      if (exitCode === 0) {
        if (stdout.trim()) {
          onLog?.(`[Drive] ${cmd} output: ${stdout.trim()}`);
        }
        resolve(true);
      } else {
        const detail = stderr.trim() || stdout.trim();
        onLog?.(
          `[Drive] ${cmd} exited with code ${exitCode}${
            detail ? `: ${detail}` : ""
          }`,
        );
        resolve(false);
      }
    });
  });
}

function deriveBrandLabel(projectDir: string): string {
  const dirName = path.basename(projectDir).replace(/\\/g, "/");
  const stripped = dirName.endsWith("_Research")
    ? dirName.slice(0, dirName.length - "_Research".length)
    : dirName;
  return stripped || "Research_Project";
}

async function ensureAccessToken(auth: OAuth2Client): Promise<void> {
  const tokenResponse = await auth.getAccessToken();
  if (!tokenResponse || !tokenResponse.token) {
    throw new Error("OAuth refresh failed to yield an access token.");
  }
}

function getDriveConfig(): DriveConfig {
  const { clientId, clientSecret } = ensureDriveClientCredentials();
  const { GOOGLE_DRIVE_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID } = process.env;

  if (!GOOGLE_DRIVE_REFRESH_TOKEN) {
    throw new Error("GOOGLE_DRIVE_REFRESH_TOKEN is not configured.");
  }

  return {
    clientId,
    clientSecret,
    refreshToken: GOOGLE_DRIVE_REFRESH_TOKEN,
    folderId: GOOGLE_DRIVE_FOLDER_ID ?? DEFAULT_FOLDER_ID,
  };
}

function ensureDriveClientCredentials(): DriveClientCredentials {
  const { GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET } = process.env;
  if (!GOOGLE_DRIVE_CLIENT_ID || !GOOGLE_DRIVE_CLIENT_SECRET) {
    throw new Error("GOOGLE_DRIVE_CLIENT_ID/SECRET are not configured.");
  }
  return {
    clientId: GOOGLE_DRIVE_CLIENT_ID,
    clientSecret: GOOGLE_DRIVE_CLIENT_SECRET,
  };
}

async function ensureAnyoneWithLinkCanView(
  drive: drive_v3.Drive,
  fileId: string,
): Promise<void> {
  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
        allowFileDiscovery: false,
      },
    });
  } catch (error) {
    throw new Error(
      `File uploaded but failed to set link-sharing permissions: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }
}

async function announceDriveUpload(
  metadata: DriveUploadMetadata,
  brandLabel?: string,
  companyUrl?: string,
  onLog?: (message: string) => void,
): Promise<void> {
  const client = getSlackClient(onLog);
  if (!client) {
    onLog?.("Skipping Slack announcement because SLACK_BOT_TOKEN is not set.");
    return;
  }

  const reportLink =
    metadata.webViewLink ??
    metadata.webContentLink ??
    `https://drive.google.com/file/d/${metadata.fileId}/view`;
  
  const messageLines = [
    "Research Report Finished:",
    "",
    `Report: ${reportLink}`,
  ];

  if (companyUrl) {
    messageLines.push("");
    messageLines.push(`Company : ${companyUrl}`);
  }

  const text = messageLines.join("\n");

  console.log(`[googleDrive] Posting PDF link to Slack channel ${SLACK_UPLOAD_CHANNEL}`);
  onLog?.(
    `[Drive] Posting PDF link to Slack channel ${SLACK_UPLOAD_CHANNEL}${brandLabel ? ` (brand: ${brandLabel})` : ""}`,
  );

  try {
    await client.chat.postMessage({
      channel: SLACK_UPLOAD_CHANNEL,
      text,
    });
    console.log(`[googleDrive] Successfully posted PDF link to Slack`);
    onLog?.("[Drive] Slack announcement posted.");
  } catch (error) {
    console.error("Failed to announce Drive upload in Slack:", error);
    onLog?.(
      `Failed to announce Drive upload in Slack: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }
}

async function notifyOAuthFailure(reason: string): Promise<void> {
  const client = getSlackClient();
  if (!client) {
    console.error(
      "Drive OAuth refresh failed but SLACK_BOT_TOKEN is not configured.",
    );
    return;
  }
  const mention = `<@${SLACK_OAUTH_ALERT_USER}>`;
  let threadTs: string | undefined;
  try {
    const parent = await client.chat.postMessage({
      channel: SLACK_OAUTH_ALERT_CHANNEL,
      text: `${mention} Google Drive access needs attention: ${reason}`,
    });
    threadTs =
      (parent.ts as string | undefined) ??
      ((parent as { message?: { ts?: string } }).message?.ts as string | undefined);
  } catch (error) {
    console.error("Failed to send OAuth failure alert to Slack:", error);
    return;
  }

  let oauthLink: string | undefined;
  try {
    oauthLink = buildDriveOAuthUrl();
  } catch (error) {
    console.error("Unable to build Drive OAuth URL:", error);
  }

  const redirectUri = getDriveOAuthRedirectUri();
  const followUpLines = [
    oauthLink
      ? `Auth link: ${oauthLink}`
      : "Auth link unavailable (missing GOOGLE_DRIVE_CLIENT_ID/SECRET).",
    `Redirect URI: ${redirectUri}`,
    "After approving, copy the new refresh token from the callback page and update `.env`.",
    "Reply in this thread once the token is rotated.",
  ].join("\n");

  try {
    await client.chat.postMessage({
      channel: SLACK_OAUTH_ALERT_CHANNEL,
      thread_ts: threadTs,
      text: followUpLines,
    });
  } catch (error) {
    console.error("Failed to post OAuth follow-up thread:", error);
  }
}

function getSlackClient(onLog?: (message: string) => void): WebClient | undefined {
  if (slackClient) {
    return slackClient;
  }
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    onLog?.("SLACK_BOT_TOKEN is not set; skipping Slack notifications.");
    return undefined;
  }
  slackClient = new WebClient(token);
  return slackClient;
}

function getPublicBaseUrl(): string {
  const explicit = process.env.PUBLIC_BASE_URL?.trim();
  if (explicit) {
    return stripTrailingSlash(explicit);
  }
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railwayDomain) {
    const withProtocol = railwayDomain.startsWith("http")
      ? railwayDomain
      : `https://${railwayDomain}`;
    return stripTrailingSlash(withProtocol);
  }
  return "http://localhost:3000";
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

