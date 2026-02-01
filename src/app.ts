/**
 * AgentProof API Application
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import * as fs from "fs";
import * as path from "path";

import challenges from "./routes/challenges.ts";
import submit from "./routes/submit.ts";
import verify from "./routes/verify.ts";
import platforms from "./routes/platforms.ts";
import publicRoutes from "./routes/public.ts";

const app = new Hono();

// Middleware
app.use("*", cors());
app.use("*", logger());
app.use("*", prettyJSON());

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Serve markdown files
app.get("/verify.md", (c) => {
  try {
    const filePath = path.join(process.cwd(), "public", "verify.md");
    const content = fs.readFileSync(filePath, "utf-8");
    return c.text(content);
  } catch (error) {
    return c.text("# verify.md not found", 404);
  }
});

app.get("/skill.md", (c) => {
  try {
    const filePath = path.join(process.cwd(), "public", "skill.md");
    const content = fs.readFileSync(filePath, "utf-8");
    return c.text(content);
  } catch (error) {
    return c.text("# skill.md not found", 404);
  }
});

app.get("/prove-yourself.md", (c) => {
  try {
    const filePath = path.join(process.cwd(), "public", "prove-yourself.md");
    const content = fs.readFileSync(filePath, "utf-8");
    return c.text(content);
  } catch (error) {
    return c.text("# prove-yourself.md not found", 404);
  }
});

// API routes
app.route("/api/v1/challenges", challenges);
app.route("/api/v1/challenges", submit); // Submit is under challenges/:id/submit
app.route("/api/v1/verify", verify);
app.route("/api/v1", verify); // Also mount agents under /api/v1/agents
app.route("/api/v1/platforms", platforms);
app.route("/api/v1/public", publicRoutes);

// Root route
app.get("/", (c) => {
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  
  return c.json({
    name: "AgentProof",
    version: "0.1.0",
    description: "The DMV for AI Agents - Universal agent verification service",
    docs: `${baseUrl}/verify.md`,
    endpoints: {
      challenges: {
        create: "POST /api/v1/challenges",
        get: "GET /api/v1/challenges/:id",
        submit: "POST /api/v1/challenges/:id/submit",
        steps: {
          step1: "GET /api/v1/challenges/:id/step1",
          step2: "POST /api/v1/challenges/:id/step2",
          step3: "GET /api/v1/challenges/:id/step3",
        },
      },
      platforms: {
        register: "POST /api/v1/platforms/register",
      },
      verify: {
        token: "POST /api/v1/verify",
        agent: "GET /api/v1/agents/:id",
      },
      public: {
        stats: "GET /api/v1/public/stats",
        agents: "GET /api/v1/public/agents",
      },
    },
    links: {
      github: "https://github.com/yourusername/agentproof",
      docs: `${baseUrl}/verify.md`,
    },
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({ success: false, error: "Not found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Server error:", err);
  return c.json(
    { success: false, error: "Internal server error" },
    500
  );
});

export default app;
