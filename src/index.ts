/**
 * AgentProof Server Entry Point
 */

import { serve } from "@hono/node-server";
import app from "./app.js";
import { initializeDb } from "./db/index.js";
import { initializeKeys } from "./lib/jwt.js";

const PORT = parseInt(process.env.PORT || "3000", 10);

async function main() {
  console.log("🚀 Starting AgentProof...");

  // Initialize database
  try {
    initializeDb();
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    process.exit(1);
  }

  // Initialize JWT keys
  try {
    await initializeKeys();
  } catch (error) {
    console.error("❌ JWT key initialization failed:", error);
    process.exit(1);
  }

  // Start server
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     🪪  AgentProof - The DMV for AI Agents                ║
║                                                           ║
║     Server running at: http://localhost:${PORT}              ║
║     Documentation:     http://localhost:${PORT}/verify.md    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);

  serve({
    fetch: app.fetch,
    port: PORT,
  });
}

main().catch(console.error);
