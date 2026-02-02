/**
 * Claim Routes - Tweet-based human-in-the-loop verification
 * 
 * Flow:
 * 1. User visits claim page with their claim token
 * 2. We show them a verification code to tweet
 * 3. User posts tweet with the code
 * 4. User pastes the tweet URL back
 * 5. We verify and link their X account to the agent
 * 
 * This approach doesn't require OAuth setup - just public tweet verification.
 */

import { Hono } from "hono";
import { query, queryOne, execute } from "../db/index.js";
import * as crypto from "crypto";

const claim = new Hono();

// Helper to generate random verification code
function generateVerificationCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase(); // 8 char hex code
}

// Get base URL from env
function getBaseUrl(): string {
  return process.env.BASE_URL || "https://knowyourclaw.com";
}

// Extract Twitter username from tweet URL
function extractTwitterUsername(url: string): string | null {
  // Match both twitter.com and x.com URLs
  // https://twitter.com/username/status/123456
  // https://x.com/username/status/123456
  const patterns = [
    /https?:\/\/(www\.)?(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/,
    /https?:\/\/(www\.)?(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/statuses\/(\d+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[3]; // username is in group 3
    }
  }
  return null;
}

// Extract tweet ID from URL
function extractTweetId(url: string): string | null {
  const patterns = [
    /https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/(\d+)/,
    /https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/statuses\/(\d+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[3]; // tweet ID is in group 3
    }
  }
  return null;
}

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

interface ClaimVerificationRow {
  id: string;
  claim_token: string;
  code_verifier: string;
  created_at: string;
  expires_at: string;
}

/**
 * GET /api/v1/claim/:token
 * Get claim information for an agent (used by ClaimPage)
 * Returns verification code for tweeting
 */
claim.get("/:token", async (c) => {
  const claimToken = c.req.param("token");
  
  // Don't match auth routes (legacy, keeping for safety)
  if (claimToken === "auth") {
    return c.notFound();
  }

  // Find agent by claim token
  const agent = await queryOne<AgentRow>(
    "SELECT * FROM agents WHERE claim_token = $1",
    [claimToken]
  );

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
  let owner: OwnerRow | null = null;
  if (agent.owner_id) {
    owner = await queryOne<OwnerRow>(
      "SELECT * FROM owners WHERE id = $1",
      [agent.owner_id]
    );
  }

  // Generate or retrieve verification code for this claim
  let verification = await queryOne<ClaimVerificationRow>(
    "SELECT * FROM oauth_states WHERE claim_token = $1 AND expires_at > NOW()",
    [claimToken]
  );

  if (!verification) {
    // Create new verification code
    const code = generateVerificationCode();
    const id = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    await execute(
      `INSERT INTO oauth_states (id, provider, claim_token, code_verifier, expires_at)
       VALUES ($1, 'twitter', $2, $3, $4)`,
      [id, claimToken, code, expiresAt]
    );

    verification = {
      id,
      claim_token: claimToken,
      code_verifier: code,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    };
  }

  // Build the tweet text
  const tweetText = `I'm claiming "${agent.name}" on @KnowYourClaw 🪪\n\nVerify: ${verification.code_verifier}\n\n${getBaseUrl()}/a/${encodeURIComponent(agent.name)}`;
  const tweetIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

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
    // Tweet verification data
    verification: !agent.owner_id ? {
      code: verification.code_verifier,
      tweet_text: tweetText,
      tweet_intent_url: tweetIntentUrl,
      expires_at: verification.expires_at,
    } : undefined,
  });
});

/**
 * POST /api/v1/claim/:token
 * Complete the claim by submitting tweet URL
 */
claim.post("/:token", async (c) => {
  const claimToken = c.req.param("token");

  try {
    const body = await c.req.json();
    const { tweet_url } = body;

    if (!tweet_url) {
      return c.json({
        success: false,
        error: "Missing tweet_url",
        hint: "Please provide the URL of your verification tweet",
      }, 400);
    }

    // Extract username from tweet URL
    const username = extractTwitterUsername(tweet_url);
    const tweetId = extractTweetId(tweet_url);

    if (!username || !tweetId) {
      return c.json({
        success: false,
        error: "Invalid tweet URL",
        hint: "Please provide a valid X/Twitter tweet URL (e.g., https://x.com/username/status/123456)",
      }, 400);
    }

    // Find agent by claim token
    const agent = await queryOne<AgentRow>(
      "SELECT * FROM agents WHERE claim_token = $1",
      [claimToken]
    );

    if (!agent) {
      return c.json({
        success: false,
        error: "Invalid or expired claim token",
      }, 404);
    }

    // Check expiry
    if (agent.claim_expires_at && new Date(agent.claim_expires_at) < new Date()) {
      return c.json({
        success: false,
        error: "Claim link has expired",
      }, 410);
    }

    // Check if already claimed
    if (agent.owner_id) {
      return c.json({
        success: false,
        error: "Agent has already been claimed",
      }, 400);
    }

    // Verify we have a verification code for this claim
    const verification = await queryOne<ClaimVerificationRow>(
      "SELECT * FROM oauth_states WHERE claim_token = $1 AND expires_at > NOW()",
      [claimToken]
    );

    if (!verification) {
      return c.json({
        success: false,
        error: "Verification code expired",
        hint: "Please refresh the page to get a new verification code",
      }, 400);
    }

    // Check if this Twitter account already claimed another agent
    const existingOwner = await queryOne<OwnerRow>(
      "SELECT * FROM owners WHERE provider = 'twitter' AND handle = $1",
      [username.toLowerCase()]
    );

    if (existingOwner) {
      const existingAgent = await queryOne<{ name: string }>(
        "SELECT name FROM agents WHERE owner_id = $1",
        [existingOwner.id]
      );

      if (existingAgent) {
        return c.json({
          success: false,
          error: `@${username} has already claimed agent "${existingAgent.name}"`,
          hint: "Each X/Twitter account can only claim one agent.",
        }, 400);
      }
    }

    // Create or update owner record
    let ownerId: string;
    if (existingOwner) {
      ownerId = existingOwner.id;
      await execute(
        `UPDATE owners SET updated_at = NOW() WHERE id = $1`,
        [ownerId]
      );
    } else {
      ownerId = `own_${Date.now().toString(36)}${crypto.randomBytes(3).toString("hex")}`;
      await execute(
        `INSERT INTO owners (id, provider, provider_id, handle, display_name, avatar_url)
         VALUES ($1, 'twitter', $2, $3, NULL, NULL)`,
        [ownerId, tweetId, username.toLowerCase()]
      );
    }

    // Update agent with owner and clear claim token
    await execute(
      `UPDATE agents SET owner_id = $1, claim_token = NULL, updated_at = NOW()
       WHERE id = $2`,
      [ownerId, agent.id]
    );

    // Clean up verification code
    await execute("DELETE FROM oauth_states WHERE claim_token = $1", [claimToken]);

    return c.json({
      success: true,
      message: "Agent claimed successfully!",
      agent: {
        id: agent.id,
        name: agent.name,
      },
      owner: {
        provider: "twitter",
        handle: username,
      },
      profile_url: `${getBaseUrl()}/a/${encodeURIComponent(agent.name)}`,
      tweet_url: tweet_url,
    });

  } catch (error) {
    console.error("Claim error:", error);
    return c.json({
      success: false,
      error: "Failed to process claim",
    }, 500);
  }
});

export default claim;
