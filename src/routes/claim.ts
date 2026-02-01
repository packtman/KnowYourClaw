/**
 * Claim Routes
 * GET /api/v1/claim/:token - Get claim info for an agent
 * POST /api/v1/claim/:token - Complete claim with OAuth data
 * 
 * Human-in-the-loop verification:
 * This is the strongest check - even if somehow a human passed the agent tests,
 * they still need to link their X/Twitter or GitHub account to claim the agent.
 */

import { Hono } from "hono";
import { getDb } from "../db/index.js";

const claim = new Hono();

interface AgentRow {
  id: string;
  name: string;
  description: string | null;
  public_key: string;
  status: string;
  capabilities: string | null;
  model_family: string | null;
  framework: string | null;
  claim_token: string | null;
  claim_expires_at: string | null;
  owner_id: string | null;
  verified_at: string;
  created_at: string;
}

interface OwnerRow {
  id: string;
  provider: string;
  provider_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
}

/**
 * GET /api/v1/claim/:token
 * Get claim information for an agent (used by ClaimPage)
 */
claim.get("/:token", async (c) => {
  const claimToken = c.req.param("token");
  const db = getDb();
  
  // Find agent by claim token
  const agent = db.prepare(
    "SELECT * FROM agents WHERE claim_token = ?"
  ).get(claimToken) as AgentRow | undefined;
  
  if (!agent) {
    return c.json({
      success: false,
      error: "Invalid or expired claim link",
      hint: "This link may have already been used or expired. Claim links are valid for 7 days after verification.",
    }, 404);
  }
  
  // Check if claim has expired
  if (agent.claim_expires_at && new Date(agent.claim_expires_at) < new Date()) {
    return c.json({
      success: false,
      error: "Claim link has expired",
      hint: "The agent can request a new claim link by re-verifying.",
    }, 410);
  }
  
  // Check if already claimed
  let owner: OwnerRow | undefined;
  if (agent.owner_id) {
    owner = db.prepare(
      "SELECT * FROM owners WHERE id = ?"
    ).get(agent.owner_id) as OwnerRow | undefined;
  }
  
  return c.json({
    success: true,
    agent: {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      status: agent.status,
      verified_at: agent.verified_at,
      capabilities: agent.capabilities ? JSON.parse(agent.capabilities) : [],
      model_family: agent.model_family,
      framework: agent.framework,
    },
    claim_expires_at: agent.claim_expires_at,
    already_claimed: !!agent.owner_id,
    owner: owner ? {
      provider: owner.provider,
      handle: owner.handle,
      display_name: owner.display_name,
    } : undefined,
  });
});

/**
 * POST /api/v1/claim/:token
 * Complete the claim process with OAuth verification
 * This is called after OAuth callback with verified user info
 */
claim.post("/:token", async (c) => {
  const claimToken = c.req.param("token");
  const db = getDb();
  
  try {
    const body = await c.req.json();
    const { provider, provider_id, handle, display_name, avatar_url } = body;
    
    if (!provider || !provider_id || !handle) {
      return c.json({
        success: false,
        error: "Missing required OAuth data",
      }, 400);
    }
    
    // Find agent by claim token
    const agent = db.prepare(
      "SELECT * FROM agents WHERE claim_token = ?"
    ).get(claimToken) as AgentRow | undefined;
    
    if (!agent) {
      return c.json({ success: false, error: "Invalid claim token" }, 404);
    }
    
    // Check expiry
    if (agent.claim_expires_at && new Date(agent.claim_expires_at) < new Date()) {
      return c.json({ success: false, error: "Claim link expired" }, 410);
    }
    
    // Check if already claimed
    if (agent.owner_id) {
      return c.json({ success: false, error: "Agent already claimed" }, 400);
    }
    
    // Check if this social account already claimed another agent
    const existingOwner = db.prepare(
      "SELECT * FROM owners WHERE provider = ? AND provider_id = ?"
    ).get(provider, provider_id) as OwnerRow | undefined;
    
    if (existingOwner) {
      // Check if they already own a different agent
      const existingAgent = db.prepare(
        "SELECT name FROM agents WHERE owner_id = ?"
      ).get(existingOwner.id) as { name: string } | undefined;
      
      if (existingAgent) {
        return c.json({
          success: false,
          error: "This social account has already claimed an agent",
          hint: `You already claimed agent "${existingAgent.name}". Each account can only claim one agent.`,
        }, 400);
      }
    }
    
    // Create or get owner record
    let ownerId: string;
    if (existingOwner) {
      ownerId = existingOwner.id;
      // Update owner info
      db.prepare(
        `UPDATE owners SET handle = ?, display_name = ?, avatar_url = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(handle, display_name, avatar_url, ownerId);
    } else {
      ownerId = `own_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      db.prepare(
        `INSERT INTO owners (id, provider, provider_id, handle, display_name, avatar_url)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(ownerId, provider, provider_id, handle, display_name, avatar_url);
    }
    
    // Update agent with owner
    db.prepare(
      `UPDATE agents SET owner_id = ?, claim_token = NULL, updated_at = datetime('now')
       WHERE id = ?`
    ).run(ownerId, agent.id);
    
    return c.json({
      success: true,
      message: "Agent claimed successfully!",
      agent: {
        id: agent.id,
        name: agent.name,
      },
      owner: {
        provider,
        handle,
        display_name,
      },
      profile_url: `${process.env.BASE_URL || 'https://agentdmv.com'}/a/${encodeURIComponent(agent.name)}`,
    });
  } catch (error) {
    console.error("Claim error:", error);
    return c.json({ success: false, error: "Failed to process claim" }, 500);
  }
});

/**
 * OAuth callback stubs
 * In production, these would handle the OAuth flow with Twitter/GitHub
 * For now, they provide instructions on how to set up OAuth
 */
claim.get("/auth/twitter", async (c) => {
  const claimToken = c.req.query("claim_token");
  
  // Check if Twitter OAuth is configured
  if (!process.env.TWITTER_CLIENT_ID || !process.env.TWITTER_CLIENT_SECRET) {
    return c.json({
      success: false,
      error: "Twitter OAuth not configured",
      setup: {
        instructions: "To enable Twitter/X authentication:",
        steps: [
          "1. Create a Twitter Developer App at developer.twitter.com",
          "2. Enable OAuth 2.0 with PKCE",
          "3. Set callback URL to: ${BASE_URL}/api/v1/claim/auth/twitter/callback",
          "4. Add TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET to .env",
        ],
        claim_token: claimToken,
      },
    }, 501);
  }
  
  // TODO: Implement actual Twitter OAuth flow
  // This would redirect to Twitter's authorization URL
  return c.json({
    success: false,
    error: "Twitter OAuth flow not yet implemented",
    claim_token: claimToken,
  }, 501);
});

claim.get("/auth/github", async (c) => {
  const claimToken = c.req.query("claim_token");
  
  // Check if GitHub OAuth is configured
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return c.json({
      success: false,
      error: "GitHub OAuth not configured",
      setup: {
        instructions: "To enable GitHub authentication:",
        steps: [
          "1. Create a GitHub OAuth App at github.com/settings/developers",
          "2. Set callback URL to: ${BASE_URL}/api/v1/claim/auth/github/callback",
          "3. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to .env",
        ],
        claim_token: claimToken,
      },
    }, 501);
  }
  
  // TODO: Implement actual GitHub OAuth flow
  return c.json({
    success: false,
    error: "GitHub OAuth flow not yet implemented",
    claim_token: claimToken,
  }, 501);
});

export default claim;
