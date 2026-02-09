import fs from "fs";
import path from "path";
import { CLAUDE_TEMPLATE_DIR, OUTPUT_ROOT, PROJECTS_ROOT } from "../config/paths";
import { buildIntakeBriefContent } from "./intake";
import { deriveProjectFolderName, inferBrandNameFromPromptData } from "./brand";

export const PHASE_DIRECTORIES = [
  "01_Foundation",
  "02_Audience",
  "03_Content",
  "04_Competitive",
  "05_Synthesis",
  "06_Scripts",
];

export const INTAKE_FILENAME = "00_INTAKE_BRIEF.md";

export const PLACEHOLDER_FILES = [
  path.join("01_Foundation", "01_foundation_analysis.md"),
  path.join("02_Audience", "02_audience_intelligence.md"),
  path.join("03_Content", "03_content_performance.md"),
  path.join("04_Competitive", "04_competitive_intelligence.md"),
  path.join("05_Synthesis", "FINAL_MARKET_RESEARCH_REPORT.md"),
  path.join("06_Scripts", "FINAL_SCRIPTS.md"),
];

export interface ProjectDirectoryResolution {
  directory: string;
  inferredBrandName?: string;
  label: string;
  wasCreated: boolean;
  claudeConfigCopied: boolean;
}

function copyDirectoryRecursive(src: string, dest: string): void {
  if (!fs.existsSync(src)) {
    return;
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function ensureClaudeConfig(directory: string): boolean {
  const destClaudeDir = path.join(directory, ".claude");
  if (!fs.existsSync(CLAUDE_TEMPLATE_DIR)) {
    return false;
  }
  if (fs.existsSync(destClaudeDir)) {
    return false;
  }
  copyDirectoryRecursive(CLAUDE_TEMPLATE_DIR, destClaudeDir);
  return true;
}

function normalizeProvidedOutputDir(dir?: string): string | undefined {
  if (!dir) {
    return undefined;
  }
  const trimmed = dir.trim();
  if (!trimmed) {
    return undefined;
  }
  const resolvedPath = path.isAbsolute(trimmed) ? trimmed : path.resolve(trimmed);
  return path.normalize(resolvedPath);
}

export function ensureDirectoryExists(dir: string): boolean {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return true;
  }
  return false;
}

export function resolveProjectDirectory(
  promptData: unknown,
  providedOutputDir?: string,
): ProjectDirectoryResolution {
  const explicitDir = normalizeProvidedOutputDir(providedOutputDir);
  if (explicitDir) {
    const wasCreated = ensureDirectoryExists(explicitDir);
    const claudeConfigCopied = ensureClaudeConfig(explicitDir);
    return {
      directory: explicitDir,
      label: path.basename(explicitDir),
      wasCreated,
      claudeConfigCopied,
    };
  }

  ensureDirectoryExists(OUTPUT_ROOT);
  ensureDirectoryExists(PROJECTS_ROOT);

  const inferredBrand = inferBrandNameFromPromptData(promptData);
  const folderName = deriveProjectFolderName(inferredBrand);
  const directory = path.join(PROJECTS_ROOT, folderName);
  const wasCreated = ensureDirectoryExists(directory);
  const claudeConfigCopied = ensureClaudeConfig(directory);

  return {
    directory,
    inferredBrandName: inferredBrand,
    label: folderName,
    wasCreated,
    claudeConfigCopied,
  };
}

export function initializeProjectWorkspace({
  projectDir,
  promptData,
  inferredBrandName,
}: {
  projectDir: string;
  promptData: unknown;
  inferredBrandName?: string;
}): {
  createdDirs: string[];
  intakeCreated: boolean;
  intakePath: string;
  placeholderFilesCreated: string[];
} {
  const createdDirs: string[] = [];

  for (const dirName of PHASE_DIRECTORIES) {
    const dirPath = path.join(projectDir, dirName);
    if (ensureDirectoryExists(dirPath)) {
      createdDirs.push(dirName);
    }
  }

  const intakePath = path.join(projectDir, INTAKE_FILENAME);
  let intakeCreated = false;
  if (!fs.existsSync(intakePath)) {
    const contents = buildIntakeBriefContent(promptData, inferredBrandName);
    fs.writeFileSync(intakePath, contents, "utf8");
    intakeCreated = true;
  }

  const placeholderFilesCreated: string[] = [];
  for (const relativeFile of PLACEHOLDER_FILES) {
    const absolutePath = path.join(projectDir, relativeFile);
    if (!fs.existsSync(absolutePath)) {
      ensureDirectoryExists(path.dirname(absolutePath));
      fs.writeFileSync(absolutePath, "", "utf8");
      placeholderFilesCreated.push(relativeFile);
    }
  }

  return { createdDirs, intakeCreated, intakePath, placeholderFilesCreated };
}

