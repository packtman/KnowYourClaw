/**
 * Admin Routes
 * Protected endpoints for managing platforms and viewing stats
 * 
 * Security features:
 * - Session-based auth (login once, get JWT)
 * - Rate limiting on login attempts
 * - Constant-time secret comparison
 * - Login attempt logging
 * - Session expiry (24h)
 */

import { Hono } from "hono";
import { query, queryOne, execute } from "../db/index.js";
import * as crypto from "crypto";

const admin = new Hono();

const ADMIN_SECRET = process.env.ADMIN_SECRET;
const SESSION_EXPIRY_HOURS = 24;
const MIN_SECRET_LENGTH = 16;

// Warn if secret is too weak
if (ADMIN_SECRET && ADMIN_SECRET.length < MIN_SECRET_LENGTH) {
  console.warn(`⚠️  ADMIN_SECRET is too short (${ADMIN_SECRET.length} chars). Use at least ${MIN_SECRET_LENGTH} characters.`);
}

// In-memory rate limiting for login attempts
const loginAttempts = new Map<string, { count: number; blockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// In-memory session store (in production, use Redis)
// Sessions are bound to IP for additional security
const sessions = new Map<string, { createdAt: number; ip: string }>();

// Optional: IP allowlist (set ADMIN_ALLOWED_IPS=ip1,ip2,ip3)
const ALLOWED_IPS = process.env.ADMIN_ALLOWED_IPS?.split(",").map(ip => ip.trim()).filter(Boolean) || [];

/**
 * Constant-time string comparison to prevent timing attacks
 * Pads shorter string to prevent length leakage
 */
function secureCompare(a: string, b: string): boolean {
  // Pad to same length to prevent length-based timing attacks
  const maxLen = Math.max(a.length, b.length, 1);
  const aBuf = Buffer.alloc(maxLen);
  const bBuf = Buffer.alloc(maxLen);
  Buffer.from(a).copy(aBuf);
  Buffer.from(b).copy(bBuf);
  
  // Length must also match (checked after constant-time compare)
  const lengthMatch = a.length === b.length;
  const contentMatch = crypto.timingSafeEqual(aBuf, bBuf);
  
  return lengthMatch && contentMatch;
}

/**
 * Generate a secure session token
 */
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Get client IP for rate limiting
 */
function getClientIp(c: any): string {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() 
    || c.req.header("x-real-ip") 
    || "unknown";
}

/**
 * Check if IP is rate limited
 */
function isRateLimited(ip: string): { limited: boolean; retryAfter?: number } {
  const attempt = loginAttempts.get(ip);
  if (!attempt) return { limited: false };
  
  if (attempt.blockedUntil > Date.now()) {
    return { 
      limited: true, 
      retryAfter: Math.ceil((attempt.blockedUntil - Date.now()) / 1000) 
    };
  }
  
  // Reset if block expired
  if (attempt.blockedUntil <= Date.now() && attempt.count >= MAX_ATTEMPTS) {
    loginAttempts.delete(ip);
  }
  
  return { limited: false };
}

/**
 * Record login attempt
 */
function recordLoginAttempt(ip: string, success: boolean): void {
  if (success) {
    loginAttempts.delete(ip);
    return;
  }
  
  const attempt = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 };
  attempt.count += 1;
  
  if (attempt.count >= MAX_ATTEMPTS) {
    attempt.blockedUntil = Date.now() + BLOCK_DURATION_MS;
    console.log(`🚫 Admin login blocked for IP ${ip} (${MAX_ATTEMPTS} failed attempts)`);
  }
  
  loginAttempts.set(ip, attempt);
}

/**
 * Validate session token (with optional IP binding)
 */
function validateSession(token: string, currentIp: string): boolean {
  const session = sessions.get(token);
  if (!session) return false;
  
  // Check expiry
  const expiryMs = SESSION_EXPIRY_HOURS * 60 * 60 * 1000;
  if (Date.now() - session.createdAt > expiryMs) {
    sessions.delete(token);
    return false;
  }
  
  // Optional: Check IP hasn't changed (stricter security)
  // Disabled by default as it can cause issues with mobile/VPN users
  // Enable with ADMIN_BIND_SESSION_TO_IP=true
  if (process.env.ADMIN_BIND_SESSION_TO_IP === "true" && session.ip !== currentIp) {
    console.log(`⚠️ Session IP mismatch: expected ${session.ip}, got ${currentIp}`);
    sessions.delete(token);
    return false;
  }
  
  return true;
}

/**
 * POST /api/v1/admin/login
 * Authenticate and get session token
 */
admin.post("/login", async (c) => {
  const ip = getClientIp(c);
  
  // Check IP allowlist (if configured)
  if (ALLOWED_IPS.length > 0 && !ALLOWED_IPS.includes(ip)) {
    console.log(`🚫 Admin login blocked - IP ${ip} not in allowlist`);
    return c.json({ success: false, error: "Access denied" }, 403);
  }
  
  // Check rate limit
  const { limited, retryAfter } = isRateLimited(ip);
  if (limited) {
    console.log(`⚠️ Rate limited admin login attempt from ${ip}`);
    return c.json({ 
      success: false, 
      error: "Too many login attempts. Try again later.",
      retry_after_seconds: retryAfter
    }, 429);
  }
  
  if (!ADMIN_SECRET) {
    return c.json({
      success: false,
      error: "Admin not configured",
    }, 503);
  }
  
  if (ADMIN_SECRET.length < MIN_SECRET_LENGTH) {
    return c.json({
      success: false,
      error: "Admin secret too weak. Contact administrator.",
    }, 503);
  }
  
  try {
    const body = await c.req.json();
    const { secret } = body;
    
    if (!secret || typeof secret !== "string") {
      recordLoginAttempt(ip, false);
      return c.json({ success: false, error: "Secret required" }, 400);
    }
    
    // Constant-time comparison
    if (!secureCompare(secret, ADMIN_SECRET)) {
      recordLoginAttempt(ip, false);
      console.log(`❌ Failed admin login attempt from ${ip}`);
      return c.json({ success: false, error: "Invalid credentials" }, 401);
    }
    
    // Success - create session
    recordLoginAttempt(ip, true);
    const sessionToken = generateSessionToken();
    sessions.set(sessionToken, { createdAt: Date.now(), ip });
    
    console.log(`✅ Admin login successful from ${ip}`);
    
    return c.json({
      success: true,
      session_token: sessionToken,
      expires_in_hours: SESSION_EXPIRY_HOURS,
    });
  } catch (error) {
    recordLoginAttempt(ip, false);
    return c.json({ success: false, error: "Invalid request" }, 400);
  }
});

/**
 * POST /api/v1/admin/logout
 * Invalidate session
 */
admin.post("/logout", (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (token) {
    sessions.delete(token);
  }
  return c.json({ success: true });
});

/**
 * Auth middleware for protected routes
 */
admin.use("/*", async (c, next) => {
  // Skip auth for login/logout
  if (c.req.path.endsWith("/login") || c.req.path.endsWith("/logout")) {
    return next();
  }
  
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  
  if (!token) {
    return c.json({ success: false, error: "Authentication required" }, 401);
  }
  
  const ip = getClientIp(c);
  
  // Check IP allowlist (if configured)
  if (ALLOWED_IPS.length > 0 && !ALLOWED_IPS.includes(ip)) {
    return c.json({ success: false, error: "Access denied" }, 403);
  }
  
  if (!validateSession(token, ip)) {
    return c.json({ success: false, error: "Session expired or invalid" }, 401);
  }
  
  await next();
});

/**
 * GET /api/v1/admin/stats
 * Get overview statistics
 */
admin.get("/stats", async (c) => {
  const [
    platforms,
    platformsActive,
    agents,
    agentsVerified,
    agentsClaimed,
    challengesTotal,
    challengesCompleted,
    challengesFailed,
    proofsActive,
    verificationsTotal,
  ] = await Promise.all([
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM platforms"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM platforms WHERE status = 'active'"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM agents"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM agents WHERE status = 'verified'"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM agents WHERE owner_id IS NOT NULL"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM challenges"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM challenges WHERE status = 'completed'"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM challenges WHERE status = 'failed'"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM proofs WHERE status = 'active'"),
    queryOne<{ count: string }>("SELECT COALESCE(SUM(verifications_count), 0) as count FROM platforms"),
  ]);

  // Recent activity
  const recentPlatforms = await query(
    `SELECT id, name, domain, contact_email, tier, status, verifications_count, created_at
     FROM platforms 
     ORDER BY created_at DESC 
     LIMIT 10`
  );

  const recentAgents = await query(
    `SELECT id, name, status, verified_at, created_at
     FROM agents 
     ORDER BY created_at DESC 
     LIMIT 10`
  );

  return c.json({
    success: true,
    stats: {
      platforms: {
        total: parseInt(platforms?.count || "0"),
        active: parseInt(platformsActive?.count || "0"),
      },
      agents: {
        total: parseInt(agents?.count || "0"),
        verified: parseInt(agentsVerified?.count || "0"),
        claimed: parseInt(agentsClaimed?.count || "0"),
      },
      challenges: {
        total: parseInt(challengesTotal?.count || "0"),
        completed: parseInt(challengesCompleted?.count || "0"),
        failed: parseInt(challengesFailed?.count || "0"),
        success_rate: parseInt(challengesTotal?.count || "0") > 0 
          ? Math.round((parseInt(challengesCompleted?.count || "0") / parseInt(challengesTotal?.count || "0")) * 100) 
          : 0,
      },
      proofs: {
        active: parseInt(proofsActive?.count || "0"),
      },
      verifications: {
        total: parseInt(verificationsTotal?.count || "0"),
      },
    },
    recent: {
      platforms: recentPlatforms,
      agents: recentAgents,
    },
  });
});

/**
 * GET /api/v1/admin/platforms
 * List all platforms with details
 */
admin.get("/platforms", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = (page - 1) * limit;

  const platforms = await query(
    `SELECT 
      id, name, domain, contact_email, tier, rate_limit, status,
      verifications_count, verifications_this_month, 
      last_verification_at, created_at, updated_at
    FROM platforms 
    ORDER BY created_at DESC 
    LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const total = await queryOne<{ count: string }>("SELECT COUNT(*) as count FROM platforms");

  return c.json({
    success: true,
    platforms,
    pagination: {
      page,
      limit,
      total: parseInt(total?.count || "0"),
      pages: Math.ceil(parseInt(total?.count || "0") / limit),
    },
  });
});

/**
 * GET /api/v1/admin/platforms/:id
 * Get platform details
 */
admin.get("/platforms/:id", async (c) => {
  const platformId = c.req.param("id");

  const platform = await queryOne(
    `SELECT 
      id, name, domain, contact_email, tier, rate_limit, status,
      verifications_count, verifications_this_month, 
      last_verification_at, created_at, updated_at
    FROM platforms 
    WHERE id = $1`,
    [platformId]
  );

  if (!platform) {
    return c.json({ success: false, error: "Platform not found" }, 404);
  }

  return c.json({ success: true, platform });
});

/**
 * PATCH /api/v1/admin/platforms/:id
 * Update platform (tier, rate_limit, status)
 */
admin.patch("/platforms/:id", async (c) => {
  const platformId = c.req.param("id");
  const body = await c.req.json();

  const platform = await queryOne("SELECT id FROM platforms WHERE id = $1", [platformId]);
  if (!platform) {
    return c.json({ success: false, error: "Platform not found" }, 404);
  }

  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (body.tier && ["free", "platform", "enterprise"].includes(body.tier)) {
    updates.push(`tier = $${paramIndex++}`);
    values.push(body.tier);
  }

  if (body.rate_limit && typeof body.rate_limit === "number") {
    updates.push(`rate_limit = $${paramIndex++}`);
    values.push(body.rate_limit);
  }

  if (body.status && ["active", "suspended"].includes(body.status)) {
    updates.push(`status = $${paramIndex++}`);
    values.push(body.status);
  }

  if (updates.length === 0) {
    return c.json({ success: false, error: "No valid fields to update" }, 400);
  }

  updates.push(`updated_at = NOW()`);
  values.push(platformId);

  await execute(
    `UPDATE platforms SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
    values
  );

  const updated = await queryOne("SELECT * FROM platforms WHERE id = $1", [platformId]);

  return c.json({ success: true, platform: updated });
});

/**
 * DELETE /api/v1/admin/platforms/:id
 * Delete/suspend a platform
 */
admin.delete("/platforms/:id", async (c) => {
  const platformId = c.req.param("id");
  const hardDelete = c.req.query("hard") === "true";

  const platform = await queryOne<{ id: string; name: string }>(
    "SELECT id, name FROM platforms WHERE id = $1",
    [platformId]
  );
  if (!platform) {
    return c.json({ success: false, error: "Platform not found" }, 404);
  }

  if (hardDelete) {
    await execute("DELETE FROM platforms WHERE id = $1", [platformId]);
    return c.json({ success: true, message: `Platform ${platform.name} deleted permanently` });
  } else {
    await execute(
      "UPDATE platforms SET status = 'suspended', updated_at = NOW() WHERE id = $1",
      [platformId]
    );
    return c.json({ success: true, message: `Platform ${platform.name} suspended` });
  }
});

/**
 * GET /api/v1/admin/agents
 * List all agents with details
 */
admin.get("/agents", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = (page - 1) * limit;
  const status = c.req.query("status");

  let whereClause = "";
  const params: any[] = [];
  let paramIndex = 1;

  if (status) {
    whereClause = `WHERE a.status = $${paramIndex++}`;
    params.push(status);
  }

  const agents = await query(
    `SELECT 
      a.id, a.name, a.description, a.status, a.capabilities, 
      a.model_family, a.framework, a.verified_at, a.created_at,
      a.owner_id,
      o.provider as owner_provider, o.handle as owner_handle
    FROM agents a
    LEFT JOIN owners o ON a.owner_id = o.id
    ${whereClause}
    ORDER BY a.created_at DESC 
    LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  const total = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM agents ${status ? "WHERE status = $1" : ""}`,
    status ? [status] : []
  );

  return c.json({
    success: true,
    agents,
    pagination: {
      page,
      limit,
      total: parseInt(total?.count || "0"),
      pages: Math.ceil(parseInt(total?.count || "0") / limit),
    },
  });
});

/**
 * PATCH /api/v1/admin/agents/:id
 * Update agent status
 */
admin.patch("/agents/:id", async (c) => {
  const agentId = c.req.param("id");
  const body = await c.req.json();

  const agent = await queryOne("SELECT id FROM agents WHERE id = $1", [agentId]);
  if (!agent) {
    return c.json({ success: false, error: "Agent not found" }, 404);
  }

  if (body.status && ["pending", "verified", "suspended", "revoked"].includes(body.status)) {
    await execute(
      "UPDATE agents SET status = $1, updated_at = NOW() WHERE id = $2",
      [body.status, agentId]
    );
  }

  const updated = await queryOne("SELECT * FROM agents WHERE id = $1", [agentId]);

  return c.json({ success: true, agent: updated });
});

export default admin;
