import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

export const dashboardRoute = new Hono();

dashboardRoute.get("/dashboard", (c) => c.redirect("/dashboard/", 301));
dashboardRoute.use("/dashboard/*", serveStatic({ root: "./public", index: "index.html" }));
