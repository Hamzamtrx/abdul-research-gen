import path from "path";
import fs from "fs";
import {
  INTAKE_FILENAME,
  PHASE_DIRECTORIES,
  PLACEHOLDER_FILES,
  initializeProjectWorkspace,
  resolveProjectDirectory,
} from "./workspace";
import { buildClaudeQueryOptions } from "../config/claude";
import { runQueryWithRetry } from "./queryRunner";
import {
  type DriveUploadMetadata,
  isDriveUploadConfigured,
  uploadResearchPdf,
} from "../googleDrive";
import { CLAUDE_TEMPLATE_DIR } from "../config/paths";

export interface RunResearchOptions {
  promptData: unknown;
  onLog?: (message: string) => void;
  outputDir?: string;
  uploadToDrive?: boolean;
  driveBrandLabel?: string;
}

export interface RunResearchResult {
  logs: string[];
  outputDir: string;
  driveFile?: DriveUploadMetadata;
}

export async function runResearch(
  options: RunResearchOptions,
): Promise<RunResearchResult> {
  const {
    promptData,
    onLog,
    outputDir,
    uploadToDrive = false,
    driveBrandLabel,
  } = options;
  const logs: string[] = [];
  const log = (message: string) => {
    logs.push(message);
    onLog?.(message);
  };

  log("Running Market Research");

  const {
    directory: resolvedOutputDir,
    inferredBrandName,
    wasCreated,
    claudeConfigCopied,
  } = resolveProjectDirectory(promptData, outputDir);
  if (wasCreated) {
    log(`Creating project directory at ${resolvedOutputDir}`);
  } else {
    log(`Using existing project directory at ${resolvedOutputDir}`);
  }
  if (claudeConfigCopied) {
    log(`Copied .claude config from ${CLAUDE_TEMPLATE_DIR} to project directory`);
  }

  const {
    createdDirs,
    intakeCreated,
    intakePath,
    placeholderFilesCreated,
  } = initializeProjectWorkspace({
    projectDir: resolvedOutputDir,
    promptData,
    inferredBrandName,
  });
  if (createdDirs.length > 0) {
    log(`Prepared workflow phase folders: ${createdDirs.join(", ")}`);
  }
  if (placeholderFilesCreated.length > 0) {
    log(`Seeded placeholder files: ${placeholderFilesCreated.join(", ")}`);
  }
  log(
    intakeCreated
      ? `Created intake brief at ${intakePath}`
      : `Reusing existing intake brief at ${intakePath}`,
  );
  if (inferredBrandName) {
    log(`Detected brand: ${inferredBrandName}`);
  }

  log(`Prompt data structure: ${typeof promptData}`);
  log(`Prompt data preview: ${JSON.stringify(promptData).substring(0, 200)}...`);

  const claudeDir = path.join(resolvedOutputDir, ".claude");
  const claudeDirExists = fs.existsSync(claudeDir);
  log(`Claude config directory (.claude): ${claudeDirExists ? "EXISTS" : "MISSING"}`);
  if (!claudeDirExists) {
    log(
      `WARNING: .claude directory not found at ${claudeDir} - using parent directory config`,
    );
  }

  const agentsDir = path.join(claudeDir, "agents");
  const skillsDir = path.join(claudeDir, "skills");
  if (claudeDirExists) {
    log(`Agents directory: ${fs.existsSync(agentsDir) ? "EXISTS" : "MISSING"}`);
    log(`Skills directory: ${fs.existsSync(skillsDir) ? "EXISTS" : "MISSING"}`);
  }

  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  log(`ANTHROPIC_API_KEY: ${hasAnthropicKey ? "CONFIGURED" : "MISSING"}`);

  if (!hasAnthropicKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required but not set");
  }

  const queryCwd = resolvedOutputDir;

  const expectedFilesForAgent = [
    INTAKE_FILENAME,
    ...PLACEHOLDER_FILES.map((relativePath) =>
      relativePath.split(path.sep).join("/"),
    ),
  ];
  const agentPayload = {
    intake: promptData,
    workspace: {
      projectDirectory: resolvedOutputDir,
      relativeProjectDirectory: ".",
      brand: inferredBrandName ?? "unknown",
      phaseDirectories: PHASE_DIRECTORIES,
      expectedFiles: expectedFilesForAgent,
      intakeFile: INTAKE_FILENAME,
    },
  };

  const queryOptions = buildClaudeQueryOptions({ cwd: queryCwd });
  log(
    `Claude query options prepared with model: ${queryOptions.model ?? "default"} (cwd=${queryOptions.cwd})`,
  );
  log(`Workspace scaffold ready with expected files: ${expectedFilesForAgent.join(", ")}`);
  log(`Starting Claude Agent SDK query...`);

  try {
    await runQueryWithRetry({
      promptData: agentPayload,
      queryOptions,
      log,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    const errorStack = error instanceof Error ? error.stack : "";
    log(`Research execution failed: ${errorMessage}`);
    log(`Error stack: ${errorStack}`);
    throw error;
  }

  let driveFile: DriveUploadMetadata | undefined;
  if (uploadToDrive) {
    if (isDriveUploadConfigured()) {
      try {
        const brandLabel =
          driveBrandLabel ??
          inferredBrandName ??
          labelFromDirectory(resolvedOutputDir);
        const companyUrl = extractCompanyUrl(promptData);
        log("Uploading final PDF to Google Drive...");
        driveFile = await uploadResearchPdf(resolvedOutputDir, {
          brandLabel,
          companyUrl,
          onLog: log,
        });
        const link = driveFile.webViewLink ?? driveFile.webContentLink;
        if (link) {
          log(`Drive upload complete: ${link}`);
        } else {
          log(`Drive upload complete. File ID: ${driveFile.fileId}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        log(`Google Drive upload failed: ${errorMessage}`);
      }
    } else {
      log(
        "Drive upload was requested but Google OAuth env vars are missing. Skipping upload.",
      );
    }
  }

  return {
    logs,
    outputDir: resolvedOutputDir,
    driveFile,
  };
}

function labelFromDirectory(projectDir: string): string {
  return path.basename(projectDir);
}

function extractCompanyUrl(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const WEBSITE_KEYWORDS = ["website", "site", "url", "link", "domain", "store", "shop"];
  const fallback: string[] = [];

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
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

  function extractFromObject(source: unknown, depth = 0): string | undefined {
    if (!isRecord(source) || depth > 3) {
      return undefined;
    }

    for (const [key, value] of Object.entries(source)) {
      const stringValue = captureString(value);
      if (stringValue) {
        const keyLower = key.toLowerCase();
        if (WEBSITE_KEYWORDS.some((keyword) => keyLower.includes(keyword))) {
          return stringValue;
        }
        if (looksLikeUrl(stringValue)) {
          fallback.push(stringValue);
        }
        continue;
      }

      if (key === "fields" && Array.isArray(value)) {
        for (const field of value) {
          if (!isRecord(field)) {
            continue;
          }
          const label = captureString(field.label) ?? "";
          const fieldValue = captureString(field.value);
          if (fieldValue) {
            if (
              label &&
              WEBSITE_KEYWORDS.some((keyword) => label.toLowerCase().includes(keyword))
            ) {
              return fieldValue;
            }
            if (looksLikeUrl(fieldValue)) {
              fallback.push(fieldValue);
            }
          }
        }
        continue;
      }

      if (isRecord(value)) {
        const nested = extractFromObject(value, depth + 1);
        if (nested) {
          return nested;
        }
      }
    }

    return fallback[0];
  }

  return extractFromObject(data);
}
