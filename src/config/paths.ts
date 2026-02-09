import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In production, use process.cwd() as the base since we run from the app root
// In development, files are in src/, in production they might be bundled or in dist/
const APP_ROOT = process.cwd();
const SRC_ROOT = path.join(APP_ROOT, "src");

export const OUTPUT_ROOT = path.join(SRC_ROOT, "output");
export const PROJECTS_ROOT = path.join(OUTPUT_ROOT, "Projects");
export const CLAUDE_TEMPLATE_DIR = path.join(OUTPUT_ROOT, ".claude");
export const SLACK_THREADS_ROOT = path.join(OUTPUT_ROOT, "SlackThreads");
export const SRC_ROOT_DIR = SRC_ROOT;

// Debug logging to help troubleshoot path issues
console.log(`[Paths] APP_ROOT: ${APP_ROOT}`);
console.log(`[Paths] SRC_ROOT: ${SRC_ROOT}`);
console.log(`[Paths] CLAUDE_TEMPLATE_DIR: ${CLAUDE_TEMPLATE_DIR}`);

