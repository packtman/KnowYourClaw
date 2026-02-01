/**
 * Platform Routes
 * POST /api/v1/platforms/register - Register a new platform (sends verification email)
 * GET /api/v1/platforms/verify - Verify email and get API key
 * POST /api/v1/platforms/resend-verification - Resend verification email
 */

import { Hono } from "hono";
import { z } from "zod";
import { 
  registerPlatform, 
  verifyPlatformEmail, 
  resendVerificationEmail 
} from "../services/platform.service.js";
import { 
  notifyPlatformRegistration, 
  sendPlatformVerificationEmail,
  sendPlatformApiKey
} from "../lib/email.js";

const platforms = new Hono();

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(1).max(100),
  domain: z.string().optional(),
  contact_email: z.string().email("Valid email is required"),
});

const resendSchema = z.object({
  email: z.string().email(),
});

/**
 * POST /api/v1/platforms/register
 * Register a new platform
 * - If REQUIRE_EMAIL_VERIFICATION=true: sends verification email
 * - If REQUIRE_EMAIL_VERIFICATION=false (default): returns API key immediately
 */
platforms.post("/register", async (c) => {
  try {
    const body = await c.req.json();
    const data = registerSchema.parse(body);

    const result = await registerPlatform(
      data.name,
      data.contact_email,
      data.domain
    );

    // Notify admin (async, don't block)
    notifyPlatformRegistration({
      platformId: result.platform.id,
      name: result.platform.name,
      domain: result.platform.domain,
      contactEmail: result.platform.contact_email,
      registeredAt: result.platform.created_at,
    }).catch(console.error);

    // Email verification flow
    if (result.verificationToken) {
      const emailSent = await sendPlatformVerificationEmail({
        email: data.contact_email,
        platformName: data.name,
        verificationToken: result.verificationToken,
      });

      return c.json({
        success: true,
        message: "Verification email sent. Check your inbox to get your API key.",
        platform: {
          id: result.platform.id,
          name: result.platform.name,
          domain: result.platform.domain,
          status: result.platform.status,
        },
        email_sent: emailSent,
        next_steps: [
          "1. Check your email inbox (and spam folder)",
          "2. Click the verification link",
          "3. You'll receive your API key after verification",
        ],
      });
    }

    // Immediate API key flow (old behavior, default)
    return c.json({
      success: true,
      message: "Platform registered successfully!",
      platform: {
        id: result.platform.id,
        name: result.platform.name,
        domain: result.platform.domain,
        tier: result.platform.tier,
        rate_limit: result.platform.rate_limit,
        status: result.platform.status,
      },
      api_key: result.apiKey,
      important: "Save your API key securely. It won't be shown again.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: "Validation error", details: error.errors },
        400
      );
    }
    if (error instanceof Error) {
      if (error.message.includes("already exists") || error.message.includes("pending")) {
        return c.json({ success: false, error: error.message }, 409);
      }
      if (error.message.includes("Valid email")) {
        return c.json({ success: false, error: error.message }, 400);
      }
    }
    console.error("Platform registration error:", error);
    return c.json({ success: false, error: "Failed to register platform" }, 500);
  }
});

/**
 * GET /api/v1/platforms/verify
 * Verify email and receive API key
 */
platforms.get("/verify", async (c) => {
  try {
    const token = c.req.query("token");

    if (!token) {
      return c.json({ success: false, error: "Verification token required" }, 400);
    }

    const result = await verifyPlatformEmail(token);

    if (!result) {
      return c.json({ 
        success: false, 
        error: "Invalid or expired verification token. Request a new one." 
      }, 400);
    }

    const { platform, apiKey } = result;

    // Send API key via email as well (backup)
    sendPlatformApiKey({
      email: platform.contact_email,
      platformName: platform.name,
      platformId: platform.id,
      apiKey,
    }).catch(console.error);

    return c.json({
      success: true,
      message: "Email verified! Your platform is now active.",
      platform: {
        id: platform.id,
        name: platform.name,
        domain: platform.domain,
        tier: platform.tier,
        rate_limit: platform.rate_limit,
        status: platform.status,
      },
      api_key: apiKey,
      important: "⚠️ SAVE YOUR API KEY! It will not be shown again (also sent to your email).",
      usage: {
        verification_endpoint: `${process.env.BASE_URL || "https://knowyourclaw.com"}/api/v1/verify`,
        header: "X-API-Key: " + apiKey,
        example: `curl -X POST ${process.env.BASE_URL || "https://knowyourclaw.com"}/api/v1/verify \\
  -H "X-API-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"token": "<agent_proof_token>"}'`,
      },
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return c.json({ success: false, error: "Verification failed" }, 500);
  }
});

/**
 * POST /api/v1/platforms/resend-verification
 * Resend verification email
 */
platforms.post("/resend-verification", async (c) => {
  try {
    const body = await c.req.json();
    const data = resendSchema.parse(body);

    const result = await resendVerificationEmail(data.email);

    if (!result) {
      return c.json({ 
        success: false, 
        error: "No pending verification found for this email" 
      }, 404);
    }

    const { platform, verificationToken } = result;

    // Send new verification email
    const emailSent = await sendPlatformVerificationEmail({
      email: platform.contact_email,
      platformName: platform.name,
      verificationToken,
    });

    return c.json({
      success: true,
      message: "Verification email resent. Check your inbox.",
      email_sent: emailSent,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: "Valid email required" },
        400
      );
    }
    console.error("Resend verification error:", error);
    return c.json({ success: false, error: "Failed to resend verification" }, 500);
  }
});

export default platforms;
