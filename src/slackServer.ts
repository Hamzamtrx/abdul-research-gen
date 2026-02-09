import fs from "fs";
import { startSlackBotServer } from "./slack/bot";
import { isSlackPersistenceEnabled, testMongoConnection } from "./slack/store";
import { CLAUDE_TEMPLATE_DIR } from "./config/paths";

async function main() {
  try {
    console.log("=".repeat(60));
    console.log("Starting Slack Bot Server...");
    console.log("=".repeat(60));
    
    // Verify Claude template directory exists
    if (fs.existsSync(CLAUDE_TEMPLATE_DIR)) {
      const skills = fs.readdirSync(`${CLAUDE_TEMPLATE_DIR}/skills`, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
      const agents = fs.readdirSync(`${CLAUDE_TEMPLATE_DIR}/agents`, { withFileTypes: true })
        .filter(f => f.isFile() && f.name.endsWith('.md'))
        .map(f => f.name.replace('.md', ''));
      
      console.log(`[Startup] ✓ Claude template directory found at: ${CLAUDE_TEMPLATE_DIR}`);
      console.log(`[Startup] ✓ Available skills: ${skills.join(', ')}`);
      console.log(`[Startup] ✓ Available agents: ${agents.join(', ')}`);
    } else {
      console.error(`[Startup] ✗ ERROR: Claude template directory NOT FOUND at: ${CLAUDE_TEMPLATE_DIR}`);
      console.error(`[Startup] ✗ Skills and agents will NOT be available in Slack threads!`);
      console.error(`[Startup] ✗ Please ensure src/output/.claude directory exists and is copied to the container`);
    }

    // Check MongoDB status
    if (isSlackPersistenceEnabled()) {
      console.log("[Startup] MongoDB persistence is ENABLED");
      console.log("[Startup] Testing MongoDB connection...");
      try {
        await testMongoConnection();
      } catch (error) {
        console.error("[Startup] MongoDB connection test FAILED:", error);
        console.error("[Startup] Bot will start but conversations will NOT persist!");
      }
    } else {
      console.warn("[Startup] MongoDB persistence is DISABLED (no MONGO_URI found)");
      console.warn("[Startup] Conversations will be lost on restart!");
    }

    console.log("=".repeat(60));
    await startSlackBotServer();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Slack bot failed to start:", errorMessage);
    process.exitCode = 1;
  }
}

await main();
