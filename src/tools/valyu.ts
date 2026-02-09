import {
  query,
  tool,
  createSdkMcpServer,
} from "@anthropic-ai/claude-agent-sdk";
import { Valyu } from "valyu-js";
import { z } from "zod";
import { config } from "dotenv";

config();

export const ValyuTool = createSdkMcpServer({
  name: "valyu-search-tool",
  version: "1.0.0",
  tools: [
    tool(
      "valyu_deepsearch",
      "Searches the web for current information, news, weather, events, and other real-time data using Valyu's deep search. Returns AI-ready search results with titles, URLs, and content. Use this when you need up-to-date information from the internet.",
      {
        query: z.string().describe("The search query to look up on the web"),
      },
      async (args) => {
        const valyu = new Valyu(process.env.VALYU_API_KEY);
        try {
          const response = await valyu.search(args.query, {
            maxNumResults: 15,
            searchType: "all",
          });

          if (
            !response.success ||
            !response.results ||
            response.results.length === 0
          ) {
            return {
              content: [
                {
                  type: "text",
                  text: `No results found for query: "${args.query}"`,
                },
              ],
            };
          }

          // Format the results as readable text for Claude
          let output = `Search Results for "${response.query}" (${response.results.length} results):\n\n`;

          response.results.forEach((result: any, index: number) => {
            output += `${index + 1}. ${result.title || "No title"}\n`;
            output += `   URL: ${result.url || "No URL"}\n`;
            output += `   Description: ${result.description || "No description"}\n`;
            output += `   Source: ${result.source_type || "web"}\n`;
            output += `   Publication Date: ${result.publication_date || "Unknown"}\n`;
            output += `   Relevance: ${result.relevance_score || 0}\n`;

            // Safely handle content preview - convert to string and truncate
            let contentPreview = "No content";
            if (result.content != null) {
              const contentStr =
                typeof result.content === "string"
                  ? result.content
                  : String(result.content);
              contentPreview =
                contentStr.length > 500
                  ? contentStr.substring(0, 500) + "..."
                  : contentStr;
            }
            output += `   Content Preview: ${contentPreview}\n\n`;
          });

          return {
            content: [
              {
                type: "text",
                text: output,
              },
            ],
          };
        } catch (error) {
          console.error("Valyu DeepSearch Error:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred";
          return {
            content: [
              {
                type: "text",
                text: `Error performing search: ${errorMessage}`,
              },
            ],
          };
        }
      },
    ),
    tool(
      "valyu_contentextract",
      "Extracts detailed full content from specific web page URLs. Use this after valyu_deepsearch to get complete content from relevant pages when you need more detail than the search snippets provide.",
      {
        urls: z
          .array(z.string())
          .min(1)
          .describe("Array of URLs to extract full content from"),
      },
      async (args) => {
        console.log("Valyu Content Extract Called:", args.urls);
        try {
          const valyu = new Valyu(process.env.VALYU_API_KEY);
          const response = await valyu.contents(args.urls, {
            extractEffort: "auto",
            responseLength: "medium",
          });

          console.log(
            "Content extracted from",
            response.results?.length || 0,
            "URLs",
          );

          if (
            !response.success ||
            !response.results ||
            response.results.length === 0
          ) {
            return {
              content: [
                {
                  type: "text",
                  text: `No content extracted from the provided URLs.`,
                },
              ],
            };
          }

          // Format the results as readable text for Claude
          let output = `Content Extracted from ${response.results.length} URL(s):\n\n`;

          response.results.forEach((result: any, index: number) => {
            output += `${index + 1}. ${result.title || "No title"}\n`;
            output += `   URL: ${result.url || "No URL"}\n`;
            output += `   Content Length: ${result.length || 0} characters\n`;
            output += `   Content:\n${result.content || "No content"}\n\n`;
            output += `${"=".repeat(80)}\n\n`;
          });

          return {
            content: [
              {
                type: "text",
                text: output,
              },
            ],
          };
        } catch (error) {
          console.error("Valyu Content Extract Error:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred";
          return {
            content: [
              {
                type: "text",
                text: `Error extracting content: ${errorMessage}`,
              },
            ],
          };
        }
      },
    ),
  ],
});
