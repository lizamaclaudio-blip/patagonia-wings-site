import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export type NewsItem = {
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  source: string;
};

type NewsApiArticle = {
  title?: string | null;
  description?: string | null;
  url?: string | null;
  publishedAt?: string | null;
  source?: { name?: string | null } | null;
};

type NewsApiResponse = {
  articles?: NewsApiArticle[];
  status?: string;
  message?: string;
};

function sanitize(value: string | null | undefined) {
  return (value ?? "").trim();
}

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function GET(request: NextRequest) {
  const city = sanitize(request.nextUrl.searchParams.get("city"));
  const country = sanitize(request.nextUrl.searchParams.get("country"));

  const apiKey = process.env.NEWS_API_KEY?.trim();

  // If no API key, silently return empty (component should hide)
  if (!apiKey) {
    return jsonResponse({ ok: true, items: [], reason: "no_key" });
  }

  // Build a contextual query: aviation news for city/country
  const location = [city, country].filter(Boolean).join(" ");
  const query = location
    ? `aviacion OR aeropuerto OR vuelo ${location}`
    : "aviacion aeropuerto vuelo";

  try {
    const url = new URL("https://newsapi.org/v2/everything");
    url.searchParams.set("q", query);
    url.searchParams.set("language", "es");
    url.searchParams.set("sortBy", "publishedAt");
    url.searchParams.set("pageSize", "5");
    url.searchParams.set("apiKey", apiKey);

    const response = await fetch(url.toString(), {
      next: { revalidate: 60 * 30 }, // 30 min cache
    });

    if (!response.ok) {
      return jsonResponse({ ok: true, items: [], reason: "api_error" });
    }

    const payload = (await response.json().catch(() => null)) as NewsApiResponse | null;

    if (!payload?.articles?.length) {
      return jsonResponse({ ok: true, items: [], reason: "no_results" });
    }

    const items: NewsItem[] = payload.articles
      .filter((a): a is NewsApiArticle => Boolean(a.title && a.url))
      .slice(0, 5)
      .map((a) => ({
        title: sanitize(a.title),
        description: a.description ? sanitize(a.description) : null,
        url: sanitize(a.url),
        publishedAt: sanitize(a.publishedAt),
        source: sanitize(a.source?.name),
      }));

    return jsonResponse({ ok: true, items });
  } catch {
    return jsonResponse({ ok: true, items: [], reason: "fetch_error" });
  }
}
