/**
 * Email Service
 * Uses Resend for sending notifications
 * Falls back to console logging if not configured
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface PlatformRegistrationData {
  platformId: string;
  name: string;
  domain?: string;
  contactEmail?: string;
  registeredAt: string;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const FROM_EMAIL = process.env.FROM_EMAIL || "KnowYourClaw <noreply@knowyourclaw.com>";

/**
 * Send an email using Resend API
 */
async function sendEmail(options: EmailOptions & { debugData?: Record<string, string> }): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log("📧 [Email Not Configured] Would send email:");
    console.log(`   To: ${options.to}`);
    console.log(`   Subject: ${options.subject}`);
    if (options.debugData) {
      for (const [key, value] of Object.entries(options.debugData)) {
        console.log(`   ${key}: ${value}`);
      }
    }
    console.log(`   ---`);
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Email send failed:", error);
      return false;
    }

    console.log(`📧 Email sent to ${options.to}: ${options.subject}`);
    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
}

/**
 * Notify admin about new platform registration
 */
export async function notifyPlatformRegistration(data: PlatformRegistrationData): Promise<void> {
  const adminEmail = ADMIN_EMAIL;
  
  if (!adminEmail) {
    console.log("📧 [No ADMIN_EMAIL configured] New platform registered:");
    console.log(`   Platform: ${data.name} (${data.platformId})`);
    console.log(`   Domain: ${data.domain || "not specified"}`);
    console.log(`   Contact: ${data.contactEmail || "not specified"}`);
    return;
  }

  const subject = `🆕 New Platform Registration: ${data.name}`;
  
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10b981;">🪪 New Platform Registered</h2>
      
      <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; width: 120px;">Platform ID</td>
            <td style="padding: 8px 0; font-family: monospace; color: #374151;">${data.platformId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Name</td>
            <td style="padding: 8px 0; font-weight: 600; color: #374151;">${data.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Domain</td>
            <td style="padding: 8px 0; color: #374151;">${data.domain || "<em>not specified</em>"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Contact Email</td>
            <td style="padding: 8px 0; color: #374151;">${data.contactEmail || "<em>not specified</em>"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Registered At</td>
            <td style="padding: 8px 0; color: #374151;">${data.registeredAt}</td>
          </tr>
        </table>
      </div>
      
      <p style="color: #6b7280; font-size: 14px;">
        View all platforms: <a href="${process.env.BASE_URL || "https://knowyourclaw.com"}/admin" style="color: #10b981;">Admin Dashboard</a>
      </p>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      
      <p style="color: #9ca3af; font-size: 12px;">
        This notification was sent by KnowYourClaw.
      </p>
    </div>
  `;

  const text = `
New Platform Registered

Platform ID: ${data.platformId}
Name: ${data.name}
Domain: ${data.domain || "not specified"}
Contact Email: ${data.contactEmail || "not specified"}
Registered At: ${data.registeredAt}

View admin dashboard: ${process.env.BASE_URL || "https://knowyourclaw.com"}/admin
`;

  await sendEmail({ to: adminEmail, subject, html, text });
}

/**
 * Notify admin about new agent verification
 */
export async function notifyAgentVerification(data: {
  agentId: string;
  name: string;
  timeTakenMs: number;
  difficulty: string;
}): Promise<void> {
  const adminEmail = ADMIN_EMAIL;
  
  if (!adminEmail) {
    console.log("📧 [No ADMIN_EMAIL configured] New agent verified:");
    console.log(`   Agent: ${data.name} (${data.agentId})`);
    console.log(`   Time: ${data.timeTakenMs}ms (${data.difficulty})`);
    return;
  }

  const subject = `✅ Agent Verified: ${data.name}`;
  
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10b981;">✅ New Agent Verified</h2>
      
      <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; width: 120px;">Agent ID</td>
            <td style="padding: 8px 0; font-family: monospace; color: #374151;">${data.agentId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Name</td>
            <td style="padding: 8px 0; font-weight: 600; color: #374151;">${data.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Time Taken</td>
            <td style="padding: 8px 0; color: #374151;">${data.timeTakenMs}ms</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Difficulty</td>
            <td style="padding: 8px 0; color: #374151;">${data.difficulty}</td>
          </tr>
        </table>
      </div>
      
      <p style="color: #6b7280; font-size: 14px;">
        View agent: <a href="${process.env.BASE_URL || "https://knowyourclaw.com"}/a/${data.name}" style="color: #10b981;">Agent Profile</a>
      </p>
    </div>
  `;

  await sendEmail({ to: adminEmail, subject, html, text: `Agent verified: ${data.name}` });
}

/**
 * Send platform email verification
 */
export async function sendPlatformVerificationEmail(data: {
  email: string;
  platformName: string;
  verificationToken: string;
}): Promise<boolean> {
  const baseUrl = process.env.BASE_URL || "https://knowyourclaw.com";
  const verifyUrl = `${baseUrl}/platforms/verify?token=${encodeURIComponent(data.verificationToken)}`;
  
  const subject = `Verify your email for KnowYourClaw`;
  
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="text-align: center; padding: 20px 0;">
        <h1 style="color: #6366f1; margin: 0;">🪪 KnowYourClaw</h1>
        <p style="color: #6b7280; margin: 10px 0 0 0;">Know Your Claw</p>
      </div>
      
      <div style="background: #f9fafb; border-radius: 12px; padding: 30px; margin: 20px 0;">
        <h2 style="color: #111827; margin: 0 0 20px 0;">Verify your email</h2>
        
        <p style="color: #374151; line-height: 1.6;">
          Thanks for registering <strong>${data.platformName}</strong> on KnowYourClaw!
        </p>
        
        <p style="color: #374151; line-height: 1.6;">
          Click the button below to verify your email and get your API key:
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; font-weight: 600; padding: 14px 28px; border-radius: 8px; text-decoration: none;">
            Verify Email & Get API Key
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          Or copy this link: <br />
          <a href="${verifyUrl}" style="color: #6366f1; word-break: break-all;">${verifyUrl}</a>
        </p>
        
        <p style="color: #9ca3af; font-size: 13px; margin-top: 20px;">
          This link expires in 24 hours.
        </p>
      </div>
      
      <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          If you didn't create this account, you can ignore this email.
        </p>
      </div>
    </div>
  `;

  const text = `
Verify your email for KnowYourClaw

Thanks for registering ${data.platformName} on KnowYourClaw!

Click this link to verify your email and get your API key:
${verifyUrl}

This link expires in 24 hours.

If you didn't create this account, you can ignore this email.
`;

  return sendEmail({ 
    to: data.email, 
    subject, 
    html, 
    text,
    debugData: { "Verify URL": verifyUrl }
  });
}

/**
 * Send platform API key after verification
 */
export async function sendPlatformApiKey(data: {
  email: string;
  platformName: string;
  platformId: string;
  apiKey: string;
}): Promise<boolean> {
  const baseUrl = process.env.BASE_URL || "https://knowyourclaw.com";
  
  const subject = `Your KnowYourClaw API Key`;
  
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="text-align: center; padding: 20px 0;">
        <h1 style="color: #6366f1; margin: 0;">🪪 KnowYourClaw</h1>
        <p style="color: #6b7280; margin: 10px 0 0 0;">Know Your Claw</p>
      </div>
      
      <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 30px; margin: 20px 0;">
        <h2 style="color: #166534; margin: 0 0 20px 0;">✅ Email Verified!</h2>
        
        <p style="color: #374151; line-height: 1.6;">
          Your platform <strong>${data.platformName}</strong> is now active. Here's your API key:
        </p>
        
        <div style="background: #1f2937; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <code style="color: #a5f3fc; font-size: 14px; word-break: break-all;">${data.apiKey}</code>
        </div>
        
        <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px; margin: 20px 0;">
          <p style="color: #92400e; margin: 0; font-size: 14px;">
            <strong>⚠️ Important:</strong> Save this API key securely. It won't be shown again!
          </p>
        </div>
      </div>
      
      <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #111827; margin: 0 0 15px 0;">Quick Start</h3>
        
        <p style="color: #374151; font-size: 14px; margin: 0 0 10px 0;">Verify an agent token:</p>
        
        <div style="background: #1f2937; border-radius: 8px; padding: 12px; overflow-x: auto;">
          <pre style="color: #e5e7eb; margin: 0; font-size: 12px; white-space: pre-wrap;">curl -X POST ${baseUrl}/api/v1/verify \\
  -H "X-API-Key: ${data.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"token": "<agent_proof_token>"}'</pre>
        </div>
        
        <p style="margin: 15px 0 0 0;">
          <a href="${baseUrl}/docs" style="color: #6366f1;">View full documentation →</a>
        </p>
      </div>
      
      <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          Platform ID: ${data.platformId}
        </p>
      </div>
    </div>
  `;

  const text = `
Your KnowYourClaw API Key

Email Verified! Your platform ${data.platformName} is now active.

Your API Key:
${data.apiKey}

⚠️ IMPORTANT: Save this API key securely. It won't be shown again!

Quick Start - Verify an agent token:
curl -X POST ${baseUrl}/api/v1/verify \\
  -H "X-API-Key: ${data.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"token": "<agent_proof_token>"}'

View documentation: ${baseUrl}/docs

Platform ID: ${data.platformId}
`;

  return sendEmail({ to: data.email, subject, html, text });
}

export { sendEmail };
