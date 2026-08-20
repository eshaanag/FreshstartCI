import { Hono } from "hono";

export interface StoredRepoScore {
  owner: string;
  repo: string;
  score: number;
  grade: string;
  timestamp: string;
  details?: unknown;
}

const scoreStore = new Map<string, StoredRepoScore>();

export function getBadgeColor(score: number): string {
  if (score >= 90) return "#4c1"; // Green
  if (score >= 75) return "#97ca00"; // Light green
  if (score >= 60) return "#dfb317"; // Yellow
  if (score >= 40) return "#fe7d37"; // Orange
  return "#e05d44"; // Red
}

export function generateSvgBadge(score: number, grade: string): string {
  const color = getBadgeColor(score);
  const label = "quickstart health";
  const status = `${score}/100 (${grade})`;

  const labelWidth = 120;
  const valueWidth = 90;
  const totalWidth = labelWidth + valueWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${status}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text x="${(labelWidth * 10) / 2}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">${label}</text>
    <text x="${(labelWidth * 10) / 2}" y="140" transform="scale(.1)">${label}</text>
    <text x="${(labelWidth + valueWidth / 2) * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">${status}</text>
    <text x="${(labelWidth + valueWidth / 2) * 10}" y="140" transform="scale(.1)">${status}</text>
  </g>
</svg>`;
}

export function createBadgeServerApp(): Hono {
  const app = new Hono();

  app.get("/health", (context) => context.json({ status: "ok" }));

  app.post("/api/score", async (context) => {
    try {
      const body = await context.req.json<StoredRepoScore>();
      if (!body.owner || !body.repo || typeof body.score !== "number" || !body.grade) {
        return context.json({ error: "Missing required fields (owner, repo, score, grade)" }, 400);
      }
      const key = `${body.owner}/${body.repo}`.toLowerCase();
      scoreStore.set(key, {
        owner: body.owner,
        repo: body.repo,
        score: body.score,
        grade: body.grade,
        timestamp: body.timestamp || new Date().toISOString(),
        details: body.details,
      });
      return context.json({ success: true, key });
    } catch {
      return context.json({ error: "Invalid JSON request body" }, 400);
    }
  });

  app.get("/badge/:owner/:repo", (context) => {
    const owner = context.req.param("owner");
    const repo = context.req.param("repo").replace(/\.svg$/, "");
    const key = `${owner}/${repo}`.toLowerCase();
    const stored = scoreStore.get(key);

    const score = stored ? stored.score : 0;
    const grade = stored ? stored.grade : "N/A";
    const svg = generateSvgBadge(score, grade);

    return context.text(svg, 200, {
      "Content-Type": "image/svg+xml;charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    });
  });

  app.get("/report/:owner/:repo", (context) => {
    const owner = context.req.param("owner");
    const repo = context.req.param("repo");
    const key = `${owner}/${repo}`.toLowerCase();
    const stored = scoreStore.get(key);

    if (!stored) {
      return context.html(
        `<html><body><h1>Report Not Found for ${owner}/${repo}</h1></body></html>`,
        404,
      );
    }

    return context.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>FreshstartCI Report - ${stored.owner}/${stored.repo}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; }
            .card { border: 1px solid #e1e4e8; border-radius: 6px; padding: 24px; background: #f6f8fa; }
            .score { font-size: 48px; font-weight: bold; color: ${getBadgeColor(stored.score)}; }
          </style>
        </head>
        <body>
          <h1>FreshstartCI Report: ${stored.owner}/${stored.repo}</h1>
          <div class="card">
            <div class="score">${stored.score}/100</div>
            <div><strong>Grade:</strong> ${stored.grade}</div>
            <div><strong>Last Updated:</strong> ${stored.timestamp}</div>
          </div>
        </body>
      </html>
    `);
  });

  return app;
}
