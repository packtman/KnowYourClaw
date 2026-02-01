/**
 * Platform Service
 * Handles platform registration and API key management
 */

import { getDb, generateId } from "../db/index.js";
import { generateApiKey, hashApiKey } from "../lib/crypto.js";

export interface Platform {
  id: string;
  name: string;
  domain?: string;
  contact_email?: string;
  tier: string;
  rate_limit: number;
  status: string;
  verifications_count: number;
  verifications_this_month: number;
  created_at: string;
}

/**
 * Register a new platform
 */
export async function registerPlatform(
  name: string,
  domain?: string,
  contactEmail?: string
): Promise<{ platform: Platform; apiKey: string }> {
  const db = getDb();

  // Check if platform with same domain exists
  if (domain) {
    const existing = db
      .prepare("SELECT id FROM platforms WHERE domain = ?")
      .get(domain) as { id: string } | null;

    if (existing) {
      throw new Error("A platform with this domain already exists");
    }
  }

  const platformId = generateId("plt");
  const apiKey = generateApiKey("plt");
  const apiKeyHash = await hashApiKey(apiKey);

  db.prepare(
    `INSERT INTO platforms (id, name, domain, contact_email, api_key_hash)
     VALUES (?, ?, ?, ?, ?)`
  ).run(platformId, name, domain, contactEmail, apiKeyHash);

  const platform: Platform = {
    id: platformId,
    name,
    domain,
    contact_email: contactEmail,
    tier: "free",
    rate_limit: 100,
    status: "active",
    verifications_count: 0,
    verifications_this_month: 0,
    created_at: new Date().toISOString(),
  };

  return { platform, apiKey };
}

/**
 * Validate platform API key
 */
export async function validateApiKey(apiKey: string): Promise<Platform | null> {
  const db = getDb();
  const apiKeyHash = await hashApiKey(apiKey);

  const row = db
    .prepare("SELECT * FROM platforms WHERE api_key_hash = ? AND status = 'active'")
    .get(apiKeyHash) as any;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    contact_email: row.contact_email,
    tier: row.tier,
    rate_limit: row.rate_limit,
    status: row.status,
    verifications_count: row.verifications_count,
    verifications_this_month: row.verifications_this_month,
    created_at: row.created_at,
  };
}

/**
 * Get platform by ID
 */
export function getPlatform(platformId: string): Platform | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM platforms WHERE id = ?")
    .get(platformId) as any;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    contact_email: row.contact_email,
    tier: row.tier,
    rate_limit: row.rate_limit,
    status: row.status,
    verifications_count: row.verifications_count,
    verifications_this_month: row.verifications_this_month,
    created_at: row.created_at,
  };
}

/**
 * Increment platform verification count
 */
export function incrementVerificationCount(platformId: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE platforms 
     SET verifications_count = verifications_count + 1,
         verifications_this_month = verifications_this_month + 1,
         last_verification_at = datetime('now')
     WHERE id = ?`
  ).run(platformId);
}

/**
 * Check if platform is within rate limits
 */
export function checkRateLimit(platform: Platform): boolean {
  // Simple check - in production, use Redis with sliding window
  return platform.verifications_this_month < platform.rate_limit * 30 * 24 * 60;
}

/**
 * Reset monthly verification counts (run via cron)
 */
export function resetMonthlyCounts(): void {
  const db = getDb();
  db.prepare("UPDATE platforms SET verifications_this_month = 0").run();
}
