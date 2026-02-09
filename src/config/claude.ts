import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type {
  SettingSource,
  McpSSEServerConfig,
} from "@anthropic-ai/claude-agent-sdk";
import { ValyuTool } from "../tools/valyu";
import { GoogleDocsTool } from "../tools/googleDocs";
import { PdfTool } from "../tools/pdf";
import { WebScraperTool } from "../tools/webScraper";

const META_ADS_SERVER_NAME = "meta-ads-remote";
const META_ADS_DEFAULT_URL = "https://mcp.pipeboard.co/meta-ads-mcp";
const META_ADS_TOKEN =
  process.env.PIPEBOARD_TOKEN ??
  process.env.META_ACCESS_TOKEN ??
  process.env.META_ADS_MCP_TOKEN;
const META_ADS_BASE_URL = process.env.META_ADS_MCP_URL ?? META_ADS_DEFAULT_URL;
const META_ADS_URL = appendTokenParam(META_ADS_BASE_URL, META_ADS_TOKEN);
const META_ADS_SSE_SERVER: McpSSEServerConfig = {
  type: "sse",
  url: META_ADS_URL,
};

// Only include meta-ads server if token is configured
const META_ADS_ENABLED = Boolean(META_ADS_TOKEN);

const META_ADS_TOOLS = [
  "mcp_meta_ads_get_ad_accounts",
  "mcp_meta_ads_get_account_info",
  "mcp_meta_ads_get_account_pages",
  "mcp_meta_ads_get_campaigns",
  "mcp_meta_ads_get_campaign_details",
  "mcp_meta_ads_create_campaign",
  "mcp_meta_ads_get_adsets",
  "mcp_meta_ads_get_adset_details",
  "mcp_meta_ads_create_adset",
  "mcp_meta_ads_get_ads",
  "mcp_meta_ads_create_ad",
  "mcp_meta_ads_get_ad_details",
  "mcp_meta_ads_get_ad_creatives",
  "mcp_meta_ads_create_ad_creative",
  "mcp_meta_ads_update_ad_creative",
  "mcp_meta_ads_upload_ad_image",
  "mcp_meta_ads_get_ad_image",
  "mcp_meta_ads_update_ad",
  "mcp_meta_ads_update_adset",
  "mcp_meta_ads_get_insights",
  "mcp_meta_ads_get_login_link",
  "mcp_meta_ads_create_budget_schedule",
  "mcp_meta_ads_search_interests",
  "mcp_meta_ads_get_interest_suggestions",
  "mcp_meta_ads_validate_interests",
  "mcp_meta_ads_search_behaviors",
  "mcp_meta_ads_search_demographics",
  "mcp_meta_ads_search_geo_locations",
  "mcp_meta_ads_search",
] as const;

const META_ADS_ALLOWED_TOOLS = META_ADS_TOOLS.map(
  (tool) => `mcp__${META_ADS_SERVER_NAME}__${tool}`,
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESEARCH_PROMPT_PATH = path.join(__dirname, "..", "main.md");
const SLACK_PROMPT_PATH = path.join(__dirname, "..", "slackPrompt.md");

export const RESEARCH_SYSTEM_PROMPT = fs.readFileSync(RESEARCH_PROMPT_PATH, "utf8");
export const SLACK_SYSTEM_PROMPT = fs.readFileSync(SLACK_PROMPT_PATH, "utf8");

const DEFAULT_SETTING_SOURCES: SettingSource[] = ["user", "project"];

const BASE_QUERY_OPTIONS = {
  model: "claude-sonnet-4-5",
  allowedTools: [
    "Skill",
    "Read",
    "Write",
    "Bash",
    "Glob",
    "Grep",
    "mcp__valyu-search-tool__valyu_deepsearch",
    "mcp__valyu-search-tool__valyu_contentextract",
    "mcp__google-docs-tool__google_docs_read",
    "mcp__google-docs-tool__google_sheets_read",
    "mcp__pdf-tool__pdf_extract_text",
    "mcp__pdf-tool__pdf_find",
    "mcp__web-scraper-tool__scrape_webpage",
    "mcp__web-scraper-tool__scrape_google_doc",
    ...(META_ADS_ENABLED ? META_ADS_ALLOWED_TOOLS : []),
  ],
  mcpServers: {
    "valyu-search-tool": ValyuTool,
    "google-docs-tool": GoogleDocsTool,
    "pdf-tool": PdfTool,
    "web-scraper-tool": WebScraperTool,
    ...(META_ADS_ENABLED ? { [META_ADS_SERVER_NAME]: META_ADS_SSE_SERVER } : {}),
  },
  cwd: process.cwd(),
  settingSources: DEFAULT_SETTING_SOURCES,
  systemPrompt: RESEARCH_SYSTEM_PROMPT,
};

export type ClaudeQueryOptions = typeof BASE_QUERY_OPTIONS;

export function buildClaudeQueryOptions(
  overrides: Partial<ClaudeQueryOptions> = {},
): ClaudeQueryOptions {
  return {
    ...BASE_QUERY_OPTIONS,
    ...overrides,
  };
}

function appendTokenParam(baseUrl: string, token?: string): string {
  if (!token || /[?&]token=/.test(baseUrl)) {
    return baseUrl;
  }
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
}

