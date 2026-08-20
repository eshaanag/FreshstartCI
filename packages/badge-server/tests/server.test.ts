import { describe, expect, it } from "vitest";
import { createBadgeServerApp, generateSvgBadge, getBadgeColor } from "../src/index.js";

describe("Badge Server", () => {
  it("calculates badge colors based on score thresholds", () => {
    expect(getBadgeColor(95)).toBe("#4c1");
    expect(getBadgeColor(80)).toBe("#97ca00");
    expect(getBadgeColor(65)).toBe("#dfb317");
    expect(getBadgeColor(45)).toBe("#fe7d37");
    expect(getBadgeColor(20)).toBe("#e05d44");
  });

  it("generates SVG badge string", () => {
    const svg = generateSvgBadge(94, "A");
    expect(svg).toContain("<svg");
    expect(svg).toContain("94/100 (A)");
  });

  it("handles HTTP routes via Hono app", async () => {
    const app = createBadgeServerApp();

    // Health check
    const healthRes = await app.request("/health");
    expect(healthRes.status).toBe(200);
    const healthJson = (await healthRes.json()) as { status: string };
    expect(healthJson.status).toBe("ok");

    // Post score
    const postRes = await app.request("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner: "freshstart-ci",
        repo: "example",
        score: 95,
        grade: "A",
      }),
    });
    expect(postRes.status).toBe(200);

    // Get badge
    const badgeRes = await app.request("/badge/freshstart-ci/example");
    expect(badgeRes.status).toBe(200);
    expect(badgeRes.headers.get("Content-Type")).toContain("image/svg+xml");
    const badgeSvg = await badgeRes.text();
    expect(badgeSvg).toContain("95/100 (A)");

    // Get HTML report
    const reportRes = await app.request("/report/freshstart-ci/example");
    expect(reportRes.status).toBe(200);
    const reportHtml = await reportRes.text();
    expect(reportHtml).toContain("FreshstartCI Report: freshstart-ci/example");
  });
});
