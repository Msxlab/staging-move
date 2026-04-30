import "server-only";

/**
 * IndexNow ping helper.
 *
 * https://www.indexnow.org — a single POST tells Bing, Yandex,
 * Naver, and Seznam that a URL changed, so they crawl it within
 * minutes instead of waiting on their normal cycle. Google does NOT
 * accept IndexNow yet (you submit via Search Console / sitemap ping)
 * — we still get most of the value from Microsoft + Yandex coverage.
 *
 * No-op when `INDEXNOW_KEY` is unset, so dev and self-hosted
 * deployments without the env var stay cleanly silent.
 */

const ENDPOINT = "https://api.indexnow.org/indexnow";

export async function pingIndexNow(urls: string[]): Promise<void> {
  const key = process.env.INDEXNOW_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!key || !appUrl || urls.length === 0) return;

  const host = new URL(appUrl).host;
  const body = {
    host,
    key,
    // The key file MUST be reachable at this exact path or the ping
    // is rejected. Our `/api/blog/indexnow-key/<key>` route serves it.
    keyLocation: `${appUrl.replace(/\/+$/, "")}/api/blog/indexnow-key/${key}`,
    urlList: urls,
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    // 200/202 = accepted; 422 = some URLs invalid (still partial OK).
    if (!res.ok && res.status !== 422) {
      console.warn(`[indexnow] non-2xx: ${res.status}`);
    }
  } catch (e) {
    // Indexing is best-effort; never block a publish on this.
    console.warn("[indexnow] ping failed:", e);
  }
}
