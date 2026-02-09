const DIRECT_BRAND_KEYS = [
  "projectName",
  "brandName",
  "brand",
  "companyName",
  "businessName",
  "clientName",
  "productName",
  "campaignName",
  "project",
];

const BRAND_FIELD_KEYWORDS = [
  "brand name",
  "brand",
  "company name",
  "company",
  "business name",
  "business",
  "client name",
  "client",
  "product name",
  "campaign name",
  "campaign",
  "project name",
  "store name",
  "store",
  "shop name",
  "shop",
];

const COMMON_URL_PREFIXES = [
  "www",
  "shop",
  "try",
  "get",
  "go",
  "my",
  "use",
  "hey",
  "the",
  "its",
  "join",
  "app",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function captureString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function sanitizeFolderComponent(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9\s_-]+/g, " ").trim();
  if (!cleaned) {
    return "Research_Project";
  }
  const words = cleaned
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(
      (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    );
  return words.join("_");
}

function stripCommonPrefix(value: string): string {
  const lowerValue = value.toLowerCase();
  for (const prefix of COMMON_URL_PREFIXES) {
    if (lowerValue.startsWith(prefix) && value.length - prefix.length >= 3) {
      return value.slice(prefix.length);
    }
  }
  return value;
}

function extractBrandFromUrl(rawUrl: string): string | undefined {
  const normalizedUrl =
    rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
      ? rawUrl
      : `https://${rawUrl}`;
  try {
    const parsed = new URL(normalizedUrl);
    const hostname = parsed.hostname.split(":")[0] ?? "";
    if (!hostname) {
      return undefined;
    }
    const parts = hostname.split(".").filter(Boolean);
    if (parts.length === 0) {
      return undefined;
    }

    const firstPart = parts[0];
    if (!firstPart) {
      return undefined;
    }

    let candidate = firstPart;
    const nextPart = parts[1];
    const candidateLower = candidate.toLowerCase();
    if (candidateLower === "www" && nextPart) {
      candidate = nextPart;
    } else if (COMMON_URL_PREFIXES.includes(candidateLower) && nextPart) {
      candidate = nextPart;
    }

    const stripped = stripCommonPrefix(candidate);
    if (!stripped) {
      return undefined;
    }

    const words = stripped.split(/[-_]/).filter(Boolean);
    const pretty = words
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
    return pretty || undefined;
  } catch {
    return undefined;
  }
}

function extractBrandFromFields(fields: unknown): string | undefined {
  if (!Array.isArray(fields)) {
    return undefined;
  }

  const urlCandidates: string[] = [];

  for (const field of fields) {
    if (!isRecord(field)) {
      continue;
    }
    const label = captureString(field.label) ?? "";
    const value = captureString(field.value);
    if (!value) {
      continue;
    }

    if (
      label &&
      BRAND_FIELD_KEYWORDS.some((keyword) =>
        label.toLowerCase().includes(keyword),
      )
    ) {
      return value;
    }

    if (
      value.includes("http://") ||
      value.includes("https://") ||
      value.includes(".com") ||
      value.includes(".io") ||
      value.includes(".co")
    ) {
      urlCandidates.push(value);
    }
  }

  for (const url of urlCandidates) {
    const brand = extractBrandFromUrl(url);
    if (brand) {
      return brand;
    }
  }

  return undefined;
}

function extractBrandFromObject(source: unknown): string | undefined {
  if (!isRecord(source)) {
    return undefined;
  }

  for (const key of DIRECT_BRAND_KEYS) {
    const candidate = captureString(source[key]);
    if (candidate) {
      return candidate;
    }
  }

  return undefined;
}

export function inferBrandNameFromPromptData(
  promptData: unknown,
): string | undefined {
  const direct = extractBrandFromObject(promptData);
  if (direct) {
    return direct;
  }

  if (isRecord(promptData)) {
    const fromFields = extractBrandFromFields(promptData.fields);
    if (fromFields) {
      return fromFields;
    }

    if (isRecord(promptData.data)) {
      const fromData = extractBrandFromObject(promptData.data);
      if (fromData) {
        return fromData;
      }

      const fromNestedFields = extractBrandFromFields(
        (promptData.data as Record<string, unknown>).fields,
      );
      if (fromNestedFields) {
        return fromNestedFields;
      }
    }
  }

  return undefined;
}

export function deriveProjectFolderName(brandName?: string): string {
  const baseName = brandName ?? "Research_Project";
  const sanitized = sanitizeFolderComponent(baseName);
  return sanitized.endsWith("_Research")
    ? sanitized
    : `${sanitized}_Research`;
}

