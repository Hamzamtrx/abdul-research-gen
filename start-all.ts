import { spawn } from "bun";

console.log("Starting webhook server and Slack bot...");

const webhookServer = spawn({
  cmd: ["bun", "src/server.ts"],
  stdout: "inherit",
  stderr: "inherit",
  stdin: "inherit",
});

const slackBot = spawn({
  cmd: ["bun", "src/slackServer.ts"],
  stdout: "inherit",
  stderr: "inherit",
  stdin: "inherit",
});

webhookServer.exited.then((code) => {
  console.error(`Webhook server exited with code ${code}`);
  process.exit(code || 1);
});

slackBot.exited.then((code) => {
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

