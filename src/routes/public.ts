/**
 * Public Routes
 * GET /api/v1/public/stats - Public statistics
 * GET /api/v1/public/agents - List verified agents
 */

import { Hono } from "hono";
import { query, queryOne } from "../db/index.js";

const publicRoutes = new Hono();

/**
 * GET /api/v1/public/stats
 * Get public statistics
 */
publicRoutes.get("/stats", async (c) => {
  const [totalAgents, verifiedAgents, platformCount, verificationsToday] = await Promise.all([
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM agents"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM agents WHERE status = 'verified'"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM platforms WHERE status = 'active'"),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM challenges WHERE status = 'completed' AND DATE(completed_at) = CURRENT_DATE"
    ),
  ]);

  const recentAgents = await query<{ id: string; name: string; verified_at: string }>(
    "SELECT id, name, verified_at FROM agents WHERE status = 'verified' ORDER BY verified_at DESC LIMIT 5"
  );

  return c.json({
    success: true,
    stats: {
      total_agents: parseInt(totalAgents?.count || "0"),
      verified_agents: parseInt(verifiedAgents?.count || "0"),
      platforms_integrated: parseInt(platformCount?.count || "0"),
      verifications_today: parseInt(verificationsToday?.count || "0"),
    },
    recent_agents: recentAgents.map((a) => ({
      id: a.id,
      name: a.name,
      verified_at: a.verified_at,
    })),
  });
});

/**
 * GET /api/v1/public/agents
 * List verified agents (paginated)
 */
publicRoutes.get("/agents", async (c) => {
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
  const offset = (page - 1) * limit;
  const sort = c.req.query("sort") || "recent";

  let orderBy = "a.verified_at DESC";
  if (sort === "name") orderBy = "a.name ASC";

  const agents = await query<any>(
    `SELECT a.id, a.name, a.description, a.status, a.capabilities, a.verified_at, a.owner_id,
            o.handle as owner_handle, o.provider as owner_provider
     FROM agents a
     LEFT JOIN owners o ON a.owner_id = o.id
     WHERE a.status = 'verified' 
     ORDER BY ${orderBy} 
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const total = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM agents WHERE status = 'verified'"
  );

  const baseUrl = process.env.BASE_URL || "https://knowyourclaw.com";

  return c.json({
    success: true,
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      capabilities: JSON.parse(a.capabilities || "[]"),
      verified_at: a.verified_at,
      profile_url: `${baseUrl}/a/${encodeURIComponent(a.name)}`,
      badge_url: `${baseUrl}/badge/${a.id}.svg`,
      owner: {
        claimed: !!a.owner_id,
        handle: a.owner_handle || null,
        provider: a.owner_provider || null,
      },
    })),
    pagination: {
      page,
      limit,
      total: parseInt(total?.count || "0"),
      total_pages: Math.ceil(parseInt(total?.count || "0") / limit),
    },
  });
});

export default publicRoutes;
