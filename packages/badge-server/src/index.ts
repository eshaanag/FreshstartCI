import { Hono } from "hono";

/**
 * Creates the FreshstartCI badge server application.
 *
 * @returns A Hono application with basic health routing.
 *
 * @example
 * ```ts
 * const app = createBadgeServerApp();
 * ```
 */
export function createBadgeServerApp(): Hono {
  const app = new Hono();

  app.get("/health", (context) => context.json({ status: "ok" }));

  return app;
}
