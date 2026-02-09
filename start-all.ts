import { spawn } from "child_process";

console.log("Starting webhook server and Slack bot...");

const webhookServer = spawn("tsx", ["src/server.ts"], {
  stdio: "inherit",
});

const slackBot = spawn("tsx", ["src/slackServer.ts"], {
  stdio: "inherit",
});

webhookServer.on("exit", (code) => {
  console.error(`Webhook server exited with code ${code}`);
  process.exit(code || 1);
});

slackBot.on("exit", (code) => {
  console.error(`Slack bot exited with code ${code}`);
  process.exit(code || 1);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down gracefully...");
  webhookServer.kill();
  slackBot.kill();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down gracefully...");
  webhookServer.kill();
  slackBot.kill();
  process.exit(0);
});

console.log("Both services started successfully");
