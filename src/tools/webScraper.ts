import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { chromium, type Browser, type Page } from "playwright";

const MAX_CONTENT_LENGTH = 50000;
const PAGE_TIMEOUT_MS = 30000;

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserInstance;
}

async function scrapeUrl(url: string): Promise<{ title: string; content: string; url: string }> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  let page: Page | null = null;
  try {
    page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });

    // Wait for content to settle
    await page.waitForTimeout(2000);

    // Handle Google Docs published pages specifically
    const isGoogleDoc = url.includes("docs.google.com") || url.includes("drive.google.com");
    
    let content: string;
    let title: string;

    if (isGoogleDoc) {
      // For Google Docs, try multiple selectors
      content = await page.evaluate(() => {
        // Published Google Doc
        const docContent = document.querySelector(".doc-content");
        if (docContent) return docContent.textContent || "";

        // Google Doc viewer
        const viewer = document.querySelector(".kix-appview-editor");
        if (viewer) return viewer.textContent || "";

        // Drive preview
        const preview = document.querySelector("[role='document']");
        if (preview) return preview.textContent || "";

        // Fallback to body
        const body = document.body;
        // Remove scripts, styles, navigation
        const clone = body.cloneNode(true) as HTMLElement;
        clone.querySelectorAll("script, style, nav, header, footer, [role='navigation']").forEach(el => el.remove());
        return clone.textContent || "";
      });

      title = await page.evaluate(() => {
        const titleEl = document.querySelector("title");
        return titleEl?.textContent?.replace(" - Google Docs", "").trim() || "Untitled Document";
      });
    } else {
      // Generic web scraping
      content = await page.evaluate(() => {
        const body = document.body;
        const clone = body.cloneNode(true) as HTMLElement;
        
        // Remove non-content elements
        clone.querySelectorAll(
          "script, style, nav, header, footer, aside, [role='navigation'], " +
          "[role='banner'], [role='complementary'], .sidebar, .navigation, .menu, " +
          ".ad, .advertisement, .social-share, .comments"
        ).forEach(el => el.remove());

        // Try to find main content area
        const main = clone.querySelector("main, article, [role='main'], .content, #content, .post, .article");
        if (main && main.textContent && main.textContent.trim().length > 100) {
          return main.textContent.trim();
        }

        return clone.textContent?.trim() || "";
      });

      title = await page.title();
    }

    // Clean up content
    content = content
      .replace(/\s+/g, " ")
      .replace(/\n\s*\n/g, "\n\n")
      .trim();

    return { title, content, url };
  } finally {
    if (page) await page.close();
    await context.close();
  }
}

export const WebScraperTool = createSdkMcpServer({
  name: "web-scraper-tool",
  version: "1.0.0",
  tools: [
    tool(
      "scrape_webpage",
      "Scrapes text content from a webpage URL using a browser. Use this for published Google Docs, HTML files, or any public webpage when API access fails. Handles JavaScript-rendered content.",
      {
        url: z
          .string()
          .url("Provide a valid URL to scrape")
          .describe("The full URL of the webpage to scrape"),
        maxChars: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Optional character limit (defaults to 50,000)"),
      },
      async ({ url, maxChars }) => {
        const limit = maxChars ?? MAX_CONTENT_LENGTH;

        try {
          const result = await scrapeUrl(url);
          
          let content = result.content;
          let truncated = false;
          
          if (content.length > limit) {
            content = content.slice(0, limit) + "…";
            truncated = true;
          }

          if (!content || content.length < 10) {
            return {
              content: [
                {
                  type: "text",
                  text: `Could not extract meaningful content from ${url}. The page may be empty, require login, or block automated access.`,
                },
              ],
            };
          }

          const header = [
            `Title: ${result.title}`,
            `URL: ${result.url}`,
            truncated ? `[Truncated to ${limit.toLocaleString()} characters]` : "",
          ].filter(Boolean).join("\n");

          return {
            content: [
              {
                type: "text",
                text: `${header}\n\n${content}`,
              },
            ],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          return {
            content: [
              {
                type: "text",
                text: `Failed to scrape ${url}: ${message}. The page may require authentication or block automated access.`,
              },
            ],
          };
        }
      },
    ),
    tool(
      "scrape_google_doc",
      "Scrapes content from a Google Docs URL (published or shared). Use this when google_docs_read fails due to permissions or published links.",
      {
        url: z
          .string()
          .min(10, "Provide a Google Docs URL")
          .describe("Google Docs URL (can be /pub, /preview, or /edit link)"),
      },
      async ({ url }) => {
        // Normalize URL - convert edit links to pub for better scraping
        let targetUrl = url;
        if (url.includes("/edit")) {
          // Try the pub version first for better text extraction
          targetUrl = url.replace(/\/edit.*$/, "/pub");
        }

        try {
          const result = await scrapeUrl(targetUrl);
          
          if (!result.content || result.content.length < 10) {
            // If pub didn't work, try the original URL
            if (targetUrl !== url) {
              const fallback = await scrapeUrl(url);
              if (fallback.content && fallback.content.length > 10) {
                return {
                  content: [
                    {
                      type: "text",
                      text: `Title: ${fallback.title}\nURL: ${url}\n\n${fallback.content.slice(0, MAX_CONTENT_LENGTH)}`,
                    },
                  ],
                };
              }
            }
            
            return {
              content: [
                {
                  type: "text",
                  text: `Could not extract content from Google Doc. The document may be private or require sign-in. Ask the user for a publicly accessible link or to share the document with "Anyone with the link".`,
                },
              ],
            };
          }

          let content = result.content;
          if (content.length > MAX_CONTENT_LENGTH) {
            content = content.slice(0, MAX_CONTENT_LENGTH) + "…\n[Content truncated]";
          }

          return {
            content: [
              {
                type: "text",
                text: `Title: ${result.title}\nURL: ${url}\n\n${content}`,
              },
            ],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          return {
            content: [
              {
                type: "text",
                text: `Failed to scrape Google Doc: ${message}. The document may require authentication.`,
              },
            ],
          };
        }
      },
    ),
  ],
});

// Cleanup browser on process exit
process.on("exit", () => {
  browserInstance?.close();
});

