export function buildIntakeBriefContent(
  promptData: unknown,
  inferredBrandName?: string,
): string {
  const createdAt = new Date().toISOString();
  const brandLine = inferredBrandName ?? "Unknown / not detected";

  return [
    "# Intake Brief",
    "",
    `- Created: ${createdAt}`,
    `- Detected brand: ${brandLine}`,
    "",
  ].join("\n");
}

