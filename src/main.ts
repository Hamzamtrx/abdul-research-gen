import fs from "fs";
import path from "path";
import { runResearch } from "./research/index";

async function readPromptData(): Promise<unknown> {
  const inputPath = process.argv[2];
  if (inputPath) {
    const resolved = path.isAbsolute(inputPath)
      ? inputPath
      : path.resolve(process.cwd(), inputPath);
    const fileContents = await fs.promises.readFile(resolved, "utf8");
    return JSON.parse(fileContents);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const combined = Buffer.concat(chunks).toString("utf8").trim();
  if (!combined) {
    throw new Error(
      "No prompt data provided. Pass a JSON file path or pipe JSON to stdin.",
    );
  }
  return JSON.parse(combined);
}

async function main() {
  try {
    const promptData = await readPromptData();
    const result = await runResearch({
      promptData,
      onLog: (message) => {
        console.log(message);
      },
    });
    if (result.driveFile) {
      const link = result.driveFile.webViewLink ?? result.driveFile.webContentLink;
      if (link) {
        console.log(`Google Drive link: ${link}`);
      } else {
        console.log(`Google Drive file ID: ${result.driveFile.fileId}`);
      }
    }
  } catch (error) {
    console.error("Market research run failed:", error);
    process.exitCode = 1;
  }
}

await main();
