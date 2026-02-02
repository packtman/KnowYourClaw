/**
 * Platform Service
 * Handles platform registration, email verification, and API key management
 */

import { query, queryOne, execute, generateId } from "../db/index.js";
import { generateApiKey, hashApiKey } from "../lib/crypto.js";
import * as crypto from "crypto";

export interface Platform {
  id: string;
  name: string;
  domain?: string;
  contact_email: string;
  tier: string;
  rate_limit: number;
  status: string;
  email_verified_at?: string;
  verifications_count: number;
  verifications_this_month: number;
  created_at: string;
}

const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;

// Feature flag: set to "true" to require email verification for new platforms
const REQUIRE_EMAIL_VERIFICATION = process.env.REQUIRE_EMAIL_VERIFICATION === "true";

/**
 * Generate a secure email verification token
 */
function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Register a new platform
 * If REQUIRE_EMAIL_VERIFICATION=true: requires email verification before getting API key
 * If REQUIRE_EMAIL_VERIFICATION=false (default): returns API key immediately (old behavior)
 */
export async function registerPlatform(
  name: string,
  contactEmail: string,
  domain?: string
): Promise<{ platform: Platform; verificationToken?: string; apiKey?: string }> {
  // Email is now required
  if (!contactEmail || !contactEmail.includes("@")) {
    throw new Error("Valid email address is required");
  }

  // Check if platform with same email exists
  const existingEmail = await queryOne<{ id: string; status: string }>(
    "SELECT id, status FROM platforms WHERE contact_email = $1",
    [contactEmail]
  );

  if (existingEmail) {
    if (existingEmail.status === "pending_email_verification") {
      throw new Error("Email verification pending. Check your inbox or request a new verification email.");
    }
    throw new Error("A platform with this email already exists");
  }

  // Check if platform with same domain exists
  if (domain) {
    const existingDomain = await queryOne<{ id: string }>(
      "SELECT id FROM platforms WHERE domain = $1",
      [domain]
    );

    if (existingDomain) {
      throw new Error("A platform with this domain already exists");
    }
  }

  const platformId = generateId("plt");
  const apiKey = generateApiKey("plt");
  const apiKeyHash = await hashApiKey(apiKey);

  if (REQUIRE_EMAIL_VERIFICATION) {
    // New behavior: require email verification
    const verificationToken = generateVerificationToken();
    const verificationTokenHash = crypto.createHash("sha256").update(verificationToken).digest("hex");
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

    await execute(
      `INSERT INTO platforms (id, name, domain, contact_email, api_key_hash, status, email_verification_token, email_verification_expires_at)
       VALUES ($1, $2, $3, $4, $5, 'pending_email_verification', $6, $7)`,
      [platformId, name, domain, contactEmail, apiKeyHash, verificationTokenHash, expiresAt]
    );

    const platform: Platform = {
      id: platformId,
      name,
      domain,
      contact_email: contactEmail,
      tier: "free",
      rate_limit: 100,
      status: "pending_email_verification",
      verifications_count: 0,
      verifications_this_month: 0,
      created_at: new Date().toISOString(),
    };

    // Return the raw token (will be sent via email), we only store the hash
    return { platform, verificationToken };
  } else {
    // Old behavior: return API key immediately (no email verification)
    await execute(
      `INSERT INTO platforms (id, name, domain, contact_email, api_key_hash, status)
       VALUES ($1, $2, $3, $4, $5, 'active')`,
      [platformId, name, domain, contactEmail, apiKeyHash]
    );

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
}

/**
 * Verify platform email and activate the platform
 */
export async function verifyPlatformEmail(
  token: string
): Promise<{ platform: Platform; apiKey: string } | null> {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  // Find platform with this token
  const row = await queryOne<any>(
    `SELECT * FROM platforms 
     WHERE email_verification_token = $1 
       AND status = 'pending_email_verification'`,
    [tokenHash]
  );

  if (!row) {
    return null;
  }

  // Check if token expired
  if (new Date(row.email_verification_expires_at) < new Date()) {
    return null;
  }

  // Generate new API key (the original was never revealed)
  const apiKey = generateApiKey("plt");
  const apiKeyHash = await hashApiKey(apiKey);

  // Activate the platform
  await execute(
    `UPDATE platforms 
     SET status = 'active',
         api_key_hash = $1,
         email_verification_token = NULL,
         email_verification_expires_at = NULL,
         email_verified_at = NOW(),
         updated_at = NOW()
     WHERE id = $2`,
    [apiKeyHash, row.id]
  );

  const platform: Platform = {
    id: row.id,
    name: row.name,
    domain: row.domain,
    contact_email: row.contact_email,
    tier: row.tier,
    rate_limit: row.rate_limit,
    status: "active",
    email_verified_at: new Date().toISOString(),
    verifications_count: row.verifications_count,
    verifications_this_month: row.verifications_this_month,
    created_at: row.created_at,
  };

  return { platform, apiKey };
}

/**
 * Resend verification email (generates new token)
 */
export async function resendVerificationEmail(
  email: string
): Promise<{ platform: Platform; verificationToken: string } | null> {
  const row = await queryOne<any>(
    `SELECT * FROM platforms 
     WHERE contact_email = $1 
       AND status = 'pending_email_verification'`,
    [email]
  );

  if (!row) {
    return null;
  }

  // Generate new token
  const verificationToken = generateVerificationToken();
  const verificationTokenHash = crypto.createHash("sha256").update(verificationToken).digest("hex");
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  await execute(
    `UPDATE platforms 
     SET email_verification_token = $1,
         email_verification_expires_at = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [verificationTokenHash, expiresAt, row.id]
  );

  const platform: Platform = {
    id: row.id,
    name: row.name,
    domain: row.domain,
    contact_email: row.contact_email,
    tier: row.tier,
    rate_limit: row.rate_limit,
    status: "pending_email_verification",
    verifications_count: row.verifications_count,
    verifications_this_month: row.verifications_this_month,
    created_at: row.created_at,
  };

  return { platform, verificationToken };
}

/**
 * Validate platform API key
 */
export async function validateApiKey(apiKey: string): Promise<Platform | null> {
  const apiKeyHash = await hashApiKey(apiKey);

  const row = await queryOne<any>(
    "SELECT * FROM platforms WHERE api_key_hash = $1 AND status = 'active'",
    [apiKeyHash]
  );

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    contact_email: row.contact_email,
    tier: row.tier,
    rate_limit: row.rate_limit,
    status: row.status,
    email_verified_at: row.email_verified_at,
    verifications_count: row.verifications_count,
    verifications_this_month: row.verifications_this_month,
    created_at: row.created_at,
  };
}

/**
 * Get platform by ID
 */
export async function getPlatform(platformId: string): Promise<Platform | null> {
  const row = await queryOne<any>(
    "SELECT * FROM platforms WHERE id = $1",
    [platformId]
  );

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    contact_email: row.contact_email,
    tier: row.tier,
    rate_limit: row.rate_limit,
    status: row.status,
    email_verified_at: row.email_verified_at,
    verifications_count: row.verifications_count,
    verifications_this_month: row.verifications_this_month,
    created_at: row.created_at,
  };
}

/**
 * Increment platform verification count
 */
export async function incrementVerificationCount(platformId: string): Promise<void> {
  await execute(
    `UPDATE platforms 
     SET verifications_count = verifications_count + 1,
         verifications_this_month = verifications_this_month + 1,
         last_verification_at = NOW()
     WHERE id = $1`,
    [platformId]
  );
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
export async function resetMonthlyCounts(): Promise<void> {
  await execute("UPDATE platforms SET verifications_this_month = 0");
}
