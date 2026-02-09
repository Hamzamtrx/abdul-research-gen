import { chromium, type Browser } from "playwright";

const FB_APP_ID = process.env.FACEBOOK_APP_ID ?? "895915319968387";
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET ?? "742da29c48b1cf749395153869d1b2df";
const DEFAULT_REDIRECT_PATH = "/api/facebook/oauth/callback";

const FB_SCOPES = [
  "ads_read",
  "ads_management",
  "business_management",
  "pages_read_engagement",
  "read_insights",
].join(",");

let browserInstance: Browser | null = null;

export interface FacebookTokens {
  accessToken: string;
  expiresIn?: number;
  tokenType?: string;
}

export interface FacebookAd {
  id: string;
  adCreativeId?: string;
  name?: string;
  status?: string;
  previewUrl?: string;
  createdTime?: string;
  creative?: {
    title?: string;
    body?: string;
    imageUrl?: string;
    videoUrl?: string;
    callToAction?: string;
    linkUrl?: string;
  };
  insights?: {
    impressions?: number;
    clicks?: number;
    spend?: string;
    reach?: number;
  };
}

export interface AdsLibraryAd {
  pageId: string;
  pageName: string;
  adText?: string;
  adUrl?: string;
  startDate?: string;
  endDate?: string;
  platform?: string[];
  mediaType?: string;
  imageUrls?: string[];
}

export function isFacebookConfigured(): boolean {
  return Boolean(FB_APP_ID && FB_APP_SECRET);
}

export function getFacebookOAuthRedirectUri(): string {
  const baseUrl = getPublicBaseUrl();
  return `${baseUrl}${DEFAULT_REDIRECT_PATH}`;
}

export function buildFacebookOAuthUrl(stateId?: string): string {
  const redirectUri = getFacebookOAuthRedirectUri();
  const params = new URLSearchParams({
    client_id: FB_APP_ID,
    redirect_uri: redirectUri,
    scope: FB_SCOPES,
    response_type: "code",
    auth_type: "rerequest",
  });
  if (stateId) {
    params.set("state", stateId);
  }
  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
}

export async function exchangeFacebookAuthCode(code: string): Promise<FacebookTokens> {
  const redirectUri = getFacebookOAuthRedirectUri();
  const params = new URLSearchParams({
    client_id: FB_APP_ID,
    client_secret: FB_APP_SECRET,
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Facebook token exchange failed: ${error.error?.message ?? response.statusText}`
    );
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
  };
}

export async function getLongLivedToken(shortLivedToken: string): Promise<FacebookTokens> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: FB_APP_ID,
    client_secret: FB_APP_SECRET,
    fb_exchange_token: shortLivedToken,
  });

  const response = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Failed to get long-lived token: ${error.error?.message ?? response.statusText}`
    );
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
  };
}

export async function getAdAccounts(accessToken: string): Promise<any[]> {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_status,currency&access_token=${accessToken}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to fetch ad accounts: ${error.error?.message ?? response.statusText}`);
  }

  const data = await response.json();
  return data.data ?? [];
}

export async function getAds(
  accessToken: string,
  adAccountId: string,
  options: { limit?: number; status?: string } = {}
): Promise<FacebookAd[]> {
  const { limit = 50, status } = options;

  const fields = [
    "id",
    "name",
    "status",
    "created_time",
    "creative{id,title,body,image_url,video_id,call_to_action_type,object_story_spec}",
    "insights{impressions,clicks,spend,reach}",
  ].join(",");

  let url = `https://graph.facebook.com/v18.0/${adAccountId}/ads?fields=${fields}&limit=${limit}&access_token=${accessToken}`;

  if (status) {
    url += `&filtering=[{"field":"effective_status","operator":"IN","value":["${status}"]}]`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to fetch ads: ${error.error?.message ?? response.statusText}`);
  }

  const data = await response.json();
  return (data.data ?? []).map((ad: any) => ({
    id: ad.id,
    name: ad.name,
    status: ad.status,
    createdTime: ad.created_time,
    creative: ad.creative
      ? {
          title: ad.creative.title,
          body: ad.creative.body,
          imageUrl: ad.creative.image_url,
          callToAction: ad.creative.call_to_action_type,
        }
      : undefined,
    insights: ad.insights?.data?.[0],
  }));
}

export async function getAdCreatives(
  accessToken: string,
  adAccountId: string,
  limit = 50
): Promise<any[]> {
  const fields = [
    "id",
    "name",
    "title",
    "body",
    "image_url",
    "thumbnail_url",
    "video_id",
    "call_to_action_type",
    "object_story_spec",
  ].join(",");

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${adAccountId}/adcreatives?fields=${fields}&limit=${limit}&access_token=${accessToken}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to fetch ad creatives: ${error.error?.message ?? response.statusText}`);
  }

  const data = await response.json();
  return data.data ?? [];
}

// Facebook Ads Library scraper (public data, no auth needed)
async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserInstance;
}

export async function scrapeAdsLibrary(
  pageName: string,
  options: { country?: string; limit?: number } = {}
): Promise<AdsLibraryAd[]> {
  const { country = "US", limit = 20 } = options;
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();
  const ads: AdsLibraryAd[] = [];

  try {
    const searchUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}&q=${encodeURIComponent(pageName)}&search_type=keyword_unordered&media_type=all`;

    await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Scroll to load more ads
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(1500);
    }

    // Extract ad data
    const adElements = await page.$$('[data-testid="ad_library_preview"]');

    for (const adEl of adElements.slice(0, limit)) {
      try {
        const adData: AdsLibraryAd = {
          pageId: "",
          pageName: pageName,
        };

        // Get ad text
        const textEl = await adEl.$(".x1lliihq");
        if (textEl) {
          adData.adText = await textEl.textContent() ?? undefined;
        }

        // Get page name from the ad
        const pageNameEl = await adEl.$("a[href*='/ads/library/']");
        if (pageNameEl) {
          adData.pageName = await pageNameEl.textContent() ?? pageName;
        }

        // Get start date
        const dateEl = await adEl.$("span:has-text('Started running')");
        if (dateEl) {
          const dateText = await dateEl.textContent();
          adData.startDate = dateText?.replace("Started running on ", "") ?? undefined;
        }

        // Get images
        const imgElements = await adEl.$$("img");
        adData.imageUrls = [];
        for (const img of imgElements) {
          const src = await img.getAttribute("src");
          if (src && !src.includes("emoji") && !src.includes("profile")) {
            adData.imageUrls.push(src);
          }
        }

        ads.push(adData);
      } catch {
        // Skip individual ad errors
      }
    }
  } finally {
    await page.close();
    await context.close();
  }

  return ads;
}

export async function getAdsLibraryByPageId(
  pageId: string,
  accessToken?: string,
  options: { country?: string; limit?: number } = {}
): Promise<any[]> {
  const { country = "US", limit = 50 } = options;

  // If we have an access token, use the official API
  if (accessToken) {
    const fields = [
      "id",
      "ad_creative_bodies",
      "ad_creative_link_titles",
      "ad_creative_link_captions",
      "ad_delivery_start_time",
      "ad_delivery_stop_time",
      "page_id",
      "page_name",
      "publisher_platforms",
    ].join(",");

    const response = await fetch(
      `https://graph.facebook.com/v18.0/ads_archive?ad_reached_countries=['${country}']&search_page_ids=['${pageId}']&fields=${fields}&limit=${limit}&access_token=${accessToken}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch from Ads Library API: ${error.error?.message ?? response.statusText}`);
    }

    const data = await response.json();
    return data.data ?? [];
  }

  // Fallback to scraping
  return scrapeAdsLibrary(pageId, options);
}

function getPublicBaseUrl(): string {
  const explicit = process.env.PUBLIC_BASE_URL?.trim();
  if (explicit) {
    return stripTrailingSlash(explicit);
  }
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railwayDomain) {
    const withProtocol = railwayDomain.startsWith("http")
      ? railwayDomain
      : `https://${railwayDomain}`;
    return stripTrailingSlash(withProtocol);
  }
  return "http://localhost:3000";
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

// Cleanup browser on process exit
process.on("exit", () => {
  browserInstance?.close();
});
