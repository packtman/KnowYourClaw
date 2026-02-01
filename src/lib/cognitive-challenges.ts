/**
 * Cognitive Proof-of-Work Challenges
 * 
 * These tasks require genuine LLM inference to complete, creating an economic
 * barrier (~$0.05-$0.10 per verification) that makes bot farms expensive.
 * 
 * Design principles:
 * 1. Substantial input (2-3K tokens) - can't skip reading
 * 2. Substantial output (1-2K tokens) - can't give brief answers
 * 3. Verifiable structure - can check outputs programmatically
 * 4. Requires reasoning - can't pattern match or template
 */

import { generateToken } from "./crypto.js";

// Types
export interface CognitiveChallenge {
  id: string;
  type: "multi_document" | "code_review" | "scenario_analysis" | "constraint_generation";
  documents: CognitiveDocument[];
  questions: CognitiveQuestion[];
  verification: CognitiveVerification;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  generatedAt: string;
}

export interface CognitiveDocument {
  id: string;
  title: string;
  type: "api_spec" | "code" | "bug_report" | "requirements" | "email" | "log";
  content: string;
}

export interface CognitiveQuestion {
  id: string;
  question: string;
  requiresDocuments: string[]; // Which document IDs needed
  expectedFormat: "structured" | "freeform" | "list" | "code";
  minWords: number;
  maxWords: number;
  verificationHints: string[]; // Keywords/concepts that must appear
}

export interface CognitiveVerification {
  requiredConcepts: string[][]; // Each sub-array is OR'd, all arrays AND'd
  forbiddenPatterns: string[]; // Regex patterns that indicate cheating
  minTotalWords: number;
  maxTotalWords: number;
  structureChecks: StructureCheck[];
}

export interface StructureCheck {
  questionId: string;
  check: "contains_code" | "contains_list" | "references_document" | "min_sections";
  params?: Record<string, any>;
}

export interface CognitiveResponse {
  answers: {
    questionId: string;
    answer: string;
  }[];
}

// Document templates for multi-document reasoning
const API_SPEC_TEMPLATES = [
  {
    service: "UserAuthService",
    endpoints: [
      { method: "POST", path: "/auth/login", desc: "Authenticate user with email/password", returns: "JWT token with 1h expiry", errors: ["401 - Invalid credentials", "429 - Rate limited"] },
      { method: "POST", path: "/auth/refresh", desc: "Refresh expired token", returns: "New JWT token", errors: ["401 - Invalid refresh token"] },
      { method: "POST", path: "/auth/logout", desc: "Invalidate current session", returns: "204 No Content", errors: [] },
      { method: "GET", path: "/auth/me", desc: "Get current user info", returns: "User object", errors: ["401 - Not authenticated"] },
    ],
    notes: "All endpoints except /login require Authorization header. Refresh tokens are stored in httpOnly cookies.",
  },
  {
    service: "PaymentGateway",
    endpoints: [
      { method: "POST", path: "/payments/charge", desc: "Create a new charge", returns: "Charge object with ID", errors: ["400 - Invalid amount", "402 - Card declined", "500 - Gateway error"] },
      { method: "GET", path: "/payments/{id}", desc: "Get charge details", returns: "Charge object", errors: ["404 - Not found"] },
      { method: "POST", path: "/payments/{id}/refund", desc: "Refund a charge", returns: "Refund object", errors: ["400 - Already refunded", "404 - Charge not found"] },
      { method: "GET", path: "/payments/balance", desc: "Get account balance", returns: "Balance object", errors: ["401 - Unauthorized"] },
    ],
    notes: "Amounts are in cents. Refunds can be partial. Webhooks fire on charge.succeeded and charge.failed events.",
  },
  {
    service: "NotificationHub",
    endpoints: [
      { method: "POST", path: "/notify/email", desc: "Send email notification", returns: "Message ID", errors: ["400 - Invalid email", "429 - Quota exceeded"] },
      { method: "POST", path: "/notify/push", desc: "Send push notification", returns: "Message ID", errors: ["400 - Invalid device token", "404 - Device not registered"] },
      { method: "POST", path: "/notify/sms", desc: "Send SMS notification", returns: "Message ID", errors: ["400 - Invalid phone", "402 - Insufficient credits"] },
      { method: "GET", path: "/notify/status/{id}", desc: "Get delivery status", returns: "Status object", errors: ["404 - Message not found"] },
    ],
    notes: "Rate limits: 100 emails/min, 50 push/min, 10 SMS/min. Messages are queued and processed async.",
  },
];

const BUG_REPORT_TEMPLATES = [
  {
    id: "BUG-{n}",
    severity: "Critical",
    title: "Users logged out unexpectedly after token refresh",
    reporter: "Frontend Team",
    description: `When a user's JWT expires and the frontend attempts to refresh it, sometimes the user is 
logged out instead of receiving a new token. This happens approximately 15% of the time.

Steps to reproduce:
1. Login with valid credentials
2. Wait for token to expire (1 hour)
3. Perform any authenticated action
4. Sometimes redirected to login instead of continuing

Expected: Seamless token refresh
Actual: Intermittent logout

Logs show 401 errors from /auth/refresh endpoint, but the refresh token in cookies appears valid.
This started happening after the last deployment (v2.3.1).`,
    comments: [
      "Backend: Checking refresh token validation logic",
      "DevOps: No changes to auth service config",
      "Frontend: Confirmed httpOnly cookie is being sent correctly",
    ],
  },
  {
    id: "BUG-{n}",
    severity: "High",
    title: "Partial refunds not reflected in balance",
    reporter: "Finance Team",
    description: `When processing partial refunds through the payment gateway, the account balance 
doesn't update correctly. Full refunds work fine.

Steps to reproduce:
1. Create a charge for $100.00
2. Issue partial refund for $30.00
3. Check /payments/balance endpoint
4. Balance shows full amount was refunded

Expected: Balance reflects $30 refund
Actual: Balance shows $100 was refunded

This is causing accounting discrepancies. The individual refund records show correct amounts,
but the aggregate balance calculation is wrong.`,
    comments: [
      "Payment Team: Investigating balance calculation query",
      "QA: Confirmed issue with amounts ending in .00",
    ],
  },
  {
    id: "BUG-{n}",
    severity: "Medium",
    title: "Push notifications delayed during high traffic",
    reporter: "Mobile Team",
    description: `Push notifications are experiencing significant delays (30+ seconds) during peak hours.
Normal latency is under 2 seconds.

Observed: 10AM-2PM EST, notifications queued but not delivered
Metrics show queue depth increasing, processor throughput dropping.

This correlates with increased email volume during the same period.
Suspect shared queue or resource contention.`,
    comments: [
      "Infra: Checking queue service metrics",
      "Backend: Push and email share the same worker pool",
    ],
  },
];

const CODE_SNIPPET_TEMPLATES = [
  {
    language: "typescript",
    filename: "auth.service.ts",
    code: `import { sign, verify } from 'jsonwebtoken';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const JWT_SECRET = process.env.JWT_SECRET!;
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days

interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
}

export async function login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
  const user = await validateCredentials(email, password);
  if (!user) throw new AuthError('Invalid credentials', 401);
  
  const payload: TokenPayload = { userId: user.id, email: user.email, roles: user.roles };
  const accessToken = sign(payload, JWT_SECRET, { expiresIn: '1h' });
  const refreshToken = generateRefreshToken();
  
  // Store refresh token in Redis
  await redis.setex(\`refresh:\${user.id}\`, REFRESH_TOKEN_TTL, refreshToken);
  
  return { accessToken, refreshToken };
}

export async function refreshAccessToken(userId: string, providedToken: string): Promise<string> {
  const storedToken = await redis.get(\`refresh:\${userId}\`);
  
  if (storedToken !== providedToken) {
    // Token mismatch - possible theft, invalidate all sessions
    await redis.del(\`refresh:\${userId}\`);
    throw new AuthError('Invalid refresh token', 401);
  }
  
  const user = await getUserById(userId);
  const payload: TokenPayload = { userId: user.id, email: user.email, roles: user.roles };
  
  return sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

export async function logout(userId: string): Promise<void> {
  await redis.del(\`refresh:\${userId}\`);
}

function generateRefreshToken(): string {
  return require('crypto').randomBytes(32).toString('hex');
}`,
  },
  {
    language: "typescript",
    filename: "payment.service.ts",
    code: `import Stripe from 'stripe';
import { db } from './database';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

interface ChargeRequest {
  amount: number; // in cents
  currency: string;
  customerId: string;
  description?: string;
}

export async function createCharge(request: ChargeRequest): Promise<Charge> {
  const { amount, currency, customerId, description } = request;
  
  // Validate amount
  if (amount <= 0 || amount > 999999999) {
    throw new PaymentError('Invalid amount', 400);
  }
  
  const customer = await db.customers.findById(customerId);
  if (!customer || !customer.stripeCustomerId) {
    throw new PaymentError('Customer not found', 404);
  }
  
  const stripeCharge = await stripe.charges.create({
    amount,
    currency,
    customer: customer.stripeCustomerId,
    description,
  });
  
  const charge = await db.charges.create({
    id: generateChargeId(),
    stripeChargeId: stripeCharge.id,
    amount,
    currency,
    customerId,
    status: stripeCharge.status,
    createdAt: new Date(),
  });
  
  await updateBalance(customerId, amount, 'charge');
  
  return charge;
}

export async function refundCharge(chargeId: string, amount?: number): Promise<Refund> {
  const charge = await db.charges.findById(chargeId);
  if (!charge) throw new PaymentError('Charge not found', 404);
  
  const refundAmount = amount || charge.amount;
  
  if (charge.refundedAmount + refundAmount > charge.amount) {
    throw new PaymentError('Refund exceeds charge amount', 400);
  }
  
  const stripeRefund = await stripe.refunds.create({
    charge: charge.stripeChargeId,
    amount: refundAmount,
  });
  
  await db.charges.update(chargeId, {
    refundedAmount: charge.refundedAmount + refundAmount,
    status: refundAmount === charge.amount ? 'refunded' : 'partially_refunded',
  });
  
  // Bug: Always passing full amount to updateBalance
  await updateBalance(charge.customerId, charge.amount, 'refund');
  
  return { id: stripeRefund.id, amount: refundAmount, chargeId };
}

async function updateBalance(customerId: string, amount: number, type: 'charge' | 'refund'): Promise<void> {
  const delta = type === 'charge' ? amount : -amount;
  await db.balances.increment(customerId, delta);
}`,
  },
];

const REQUIREMENTS_TEMPLATES = [
  {
    title: "Multi-Factor Authentication Requirements",
    version: "1.2",
    content: `## Overview
Add MFA support to the authentication system. Users should be able to enable/disable MFA
and use TOTP (Time-based One-Time Password) apps like Google Authenticator.

## Functional Requirements

### FR-1: MFA Enrollment
- User can enable MFA from account settings
- System generates QR code with TOTP secret
- User must verify with a valid code before MFA is activated
- Backup codes (10) are generated and shown once

### FR-2: MFA Login Flow
- After password verification, prompt for MFA code if enabled
- Accept either TOTP code or backup code
- Backup codes are single-use
- Failed attempts increment lockout counter

### FR-3: MFA Recovery
- User can use backup codes if TOTP app is lost
- After using 8/10 backup codes, warn user to regenerate
- Support admin-initiated MFA reset with identity verification

## Non-Functional Requirements

### NFR-1: Security
- TOTP secrets encrypted at rest (AES-256)
- Codes valid for 30-second window, ±1 window tolerance
- 5 failed attempts triggers 15-minute lockout

### NFR-2: Performance
- MFA check adds <100ms to login flow
- QR code generation <500ms

## Dependencies
- Current auth service (UserAuthService)
- Redis for rate limiting
- Encryption key management service`,
  },
];

// Generator functions
function generateApiSpec(template: typeof API_SPEC_TEMPLATES[0], uniqueId: string): CognitiveDocument {
  let content = `# ${template.service} API Specification\n\n`;
  content += `**Base URL**: https://api.example.com/v1\n`;
  content += `**Authentication**: Bearer token (JWT)\n\n`;
  content += `## Endpoints\n\n`;
  
  for (const endpoint of template.endpoints) {
    content += `### ${endpoint.method} ${endpoint.path}\n`;
    content += `${endpoint.desc}\n\n`;
    content += `**Returns**: ${endpoint.returns}\n\n`;
    if (endpoint.errors.length > 0) {
      content += `**Errors**:\n`;
      for (const error of endpoint.errors) {
        content += `- ${error}\n`;
      }
      content += `\n`;
    }
  }
  
  content += `## Notes\n${template.notes}\n`;
  
  return {
    id: `doc_api_${uniqueId}`,
    title: `${template.service} API Specification`,
    type: "api_spec",
    content,
  };
}

function generateBugReport(template: typeof BUG_REPORT_TEMPLATES[0], bugNumber: number): CognitiveDocument {
  const id = template.id.replace("{n}", String(bugNumber));
  
  let content = `# ${id}: ${template.title}\n\n`;
  content += `**Severity**: ${template.severity}\n`;
  content += `**Reporter**: ${template.reporter}\n\n`;
  content += `## Description\n${template.description}\n\n`;
  content += `## Comments\n`;
  for (const comment of template.comments) {
    content += `- ${comment}\n`;
  }
  
  return {
    id: `doc_bug_${bugNumber}`,
    title: `${id}: ${template.title}`,
    type: "bug_report",
    content,
  };
}

function generateCodeDoc(template: typeof CODE_SNIPPET_TEMPLATES[0], uniqueId: string): CognitiveDocument {
  let content = `# ${template.filename}\n\n`;
  content += `\`\`\`${template.language}\n${template.code}\n\`\`\`\n`;
  
  return {
    id: `doc_code_${uniqueId}`,
    title: template.filename,
    type: "code",
    content,
  };
}

function generateRequirementsDoc(template: typeof REQUIREMENTS_TEMPLATES[0], uniqueId: string): CognitiveDocument {
  return {
    id: `doc_req_${uniqueId}`,
    title: template.title,
    type: "requirements",
    content: template.content,
  };
}

/**
 * Generate a multi-document reasoning challenge
 * Agent must synthesize information across multiple documents
 */
export function generateMultiDocumentChallenge(): CognitiveChallenge {
  const challengeId = `cog_${Date.now()}_${generateToken(6)}`;
  
  // Pick 2 API specs, 2 bug reports, 1 code file
  const apiSpec1 = generateApiSpec(API_SPEC_TEMPLATES[0], "auth");
  const apiSpec2 = generateApiSpec(API_SPEC_TEMPLATES[1], "payment");
  const bugReport1 = generateBugReport(BUG_REPORT_TEMPLATES[0], 1247);
  const bugReport2 = generateBugReport(BUG_REPORT_TEMPLATES[1], 1248);
  const codeFile1 = generateCodeDoc(CODE_SNIPPET_TEMPLATES[0], "auth");
  const codeFile2 = generateCodeDoc(CODE_SNIPPET_TEMPLATES[1], "payment");
  
  const documents = [apiSpec1, apiSpec2, bugReport1, bugReport2, codeFile1, codeFile2];
  
  const questions: CognitiveQuestion[] = [
    {
      id: "q1",
      question: `Based on the bug report BUG-1247 and the auth.service.ts code, identify the root cause of the 
intermittent logout issue. What function is involved and what might cause the 15% failure rate?`,
      requiresDocuments: [bugReport1.id, codeFile1.id],
      expectedFormat: "structured",
      minWords: 40,
      maxWords: 200,
      verificationHints: ["refresh", "token", "race", "concurrent"],
    },
    {
      id: "q2", 
      question: `Analyze BUG-1248 (partial refunds issue) by examining payment.service.ts. 
Find the specific bug in the code and explain why partial refunds show incorrect amounts.`,
      requiresDocuments: [bugReport2.id, codeFile2.id],
      expectedFormat: "structured",
      minWords: 40,
      maxWords: 150,
      verificationHints: ["refund", "amount", "balance", "charge"],
    },
  ];
  
  // Estimate tokens
  const inputTokens = documents.reduce((sum, doc) => sum + estimateTokens(doc.content), 0) +
    questions.reduce((sum, q) => sum + estimateTokens(q.question), 0);
  const outputTokens = questions.reduce((sum, q) => sum + Math.round((q.minWords + q.maxWords) / 2 * 1.3), 0);
  
  // Estimate cost (GPT-4o pricing: $0.005/1K in, $0.015/1K out)
  const estimatedCost = (inputTokens / 1000 * 0.005) + (outputTokens / 1000 * 0.015);
  
  return {
    id: challengeId,
    type: "multi_document",
    documents,
    questions,
    verification: {
      requiredConcepts: [
        ["refresh", "token"],
        ["refund", "amount", "balance"],
      ],
      forbiddenPatterns: [
        "I don't know",
        "I cannot",
      ],
      minTotalWords: 80,
      maxTotalWords: 500,
      structureChecks: [],
    },
    estimatedInputTokens: inputTokens,
    estimatedOutputTokens: outputTokens,
    estimatedCostUsd: Math.round(estimatedCost * 1000) / 1000,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate a scenario analysis challenge with requirements + code
 */
export function generateScenarioChallenge(): CognitiveChallenge {
  const challengeId = `cog_${Date.now()}_${generateToken(6)}`;
  
  const requirements = generateRequirementsDoc(REQUIREMENTS_TEMPLATES[0], "mfa");
  const authCode = generateCodeDoc(CODE_SNIPPET_TEMPLATES[0], "auth");
  const apiSpec = generateApiSpec(API_SPEC_TEMPLATES[0], "auth");
  
  const documents = [requirements, authCode, apiSpec];
  
  const questions: CognitiveQuestion[] = [
    {
      id: "q1",
      question: `Based on the MFA requirements document, what new database table would you need to store TOTP secrets?`,
      requiresDocuments: [requirements.id],
      expectedFormat: "structured",
      minWords: 40,
      maxWords: 150,
      verificationHints: ["totp", "secret", "table", "user"],
    },
    {
      id: "q2",
      question: `How would the login function in auth.service.ts need to change to support MFA?`,
      requiresDocuments: [requirements.id, authCode.id],
      expectedFormat: "structured",
      minWords: 40,
      maxWords: 150,
      verificationHints: ["login", "mfa", "verify", "code"],
    },
  ];
  
  const inputTokens = documents.reduce((sum, doc) => sum + estimateTokens(doc.content), 0) +
    questions.reduce((sum, q) => sum + estimateTokens(q.question), 0);
  const outputTokens = questions.reduce((sum, q) => sum + Math.round((q.minWords + q.maxWords) / 2 * 1.3), 0);
  const estimatedCost = (inputTokens / 1000 * 0.005) + (outputTokens / 1000 * 0.015);
  
  return {
    id: challengeId,
    type: "scenario_analysis",
    documents,
    questions,
    verification: {
      requiredConcepts: [
        ["mfa", "totp", "secret"],
        ["login", "verify"],
      ],
      forbiddenPatterns: [
        "I don't know",
        "I cannot", 
      ],
      minTotalWords: 80,
      maxTotalWords: 400,
      structureChecks: [],
    },
    estimatedInputTokens: inputTokens,
    estimatedOutputTokens: outputTokens,
    estimatedCostUsd: Math.round(estimatedCost * 1000) / 1000,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Main generator - randomly selects a challenge type
 */
export function generateCognitiveChallenge(): CognitiveChallenge {
  const types = [generateMultiDocumentChallenge, generateScenarioChallenge];
  const generator = types[Math.floor(Math.random() * types.length)];
  return generator();
}

/**
 * Validate cognitive challenge response
 */
export function validateCognitiveResponse(
  challenge: CognitiveChallenge,
  response: CognitiveResponse
): { 
  passed: boolean; 
  score: number; 
  errors: string[]; 
  details: Record<string, any>;
} {
  const errors: string[] = [];
  const details: Record<string, any> = {};
  let totalScore = 0;
  let maxScore = 0;
  
  // Check all questions are answered
  const answeredIds = new Set(response.answers.map(a => a.questionId));
  for (const q of challenge.questions) {
    if (!answeredIds.has(q.id)) {
      errors.push(`Missing answer for question ${q.id}`);
    }
  }
  
  // Validate each answer
  for (const answer of response.answers) {
    const question = challenge.questions.find(q => q.id === answer.questionId);
    if (!question) continue;
    
    maxScore += 100;
    const answerDetails: Record<string, any> = {};
    
    // Word count check
    const wordCount = countWords(answer.answer);
    answerDetails.wordCount = wordCount;
    
    if (wordCount < question.minWords) {
      errors.push(`Answer ${question.id}: Too short (${wordCount} words, minimum ${question.minWords})`);
      answerDetails.wordCountPassed = false;
    } else if (wordCount > question.maxWords) {
      errors.push(`Answer ${question.id}: Too long (${wordCount} words, maximum ${question.maxWords})`);
      answerDetails.wordCountPassed = false;
    } else {
      answerDetails.wordCountPassed = true;
      totalScore += 20;
    }
    
    // Verification hints check - simplified, just need 1 keyword
    const answerLower = answer.answer.toLowerCase();
    const foundHints = question.verificationHints.filter(hint => 
      answerLower.includes(hint.toLowerCase())
    );
    answerDetails.hintsFound = foundHints.length;
    answerDetails.hintsRequired = 1;
    
    if (foundHints.length >= 1) {
      answerDetails.hintsPassed = true;
      totalScore += 50;
    } else if (wordCount >= question.minWords) {
      // Give partial credit if answer is long enough even without keywords
      answerDetails.hintsPassed = false;
      totalScore += 25;
    } else {
      answerDetails.hintsPassed = false;
    }
    
    // Structure checks
    const structureCheck = challenge.verification.structureChecks.find(c => c.questionId === question.id);
    if (structureCheck) {
      const structurePassed = validateStructure(answer.answer, structureCheck);
      answerDetails.structurePassed = structurePassed;
      if (structurePassed) {
        totalScore += 30;
      } else {
        errors.push(`Answer ${question.id}: Does not meet structure requirements (${structureCheck.check})`);
      }
    } else {
      totalScore += 30; // No structure check, full points
    }
    
    details[question.id] = answerDetails;
  }
  
  // Check forbidden patterns
  const allAnswers = response.answers.map(a => a.answer).join(" ");
  for (const pattern of challenge.verification.forbiddenPatterns) {
    if (allAnswers.toLowerCase().includes(pattern.toLowerCase())) {
      errors.push(`Response contains forbidden pattern: "${pattern}"`);
      totalScore -= 50;
    }
  }
  
  // Check total word count
  const totalWords = response.answers.reduce((sum, a) => sum + countWords(a.answer), 0);
  details.totalWords = totalWords;
  
  if (totalWords < challenge.verification.minTotalWords) {
    errors.push(`Total response too short (${totalWords} words, minimum ${challenge.verification.minTotalWords})`);
  } else if (totalWords > challenge.verification.maxTotalWords) {
    errors.push(`Total response too long (${totalWords} words, maximum ${challenge.verification.maxTotalWords})`);
  }
  
  // Check required concepts across all answers
  for (const conceptGroup of challenge.verification.requiredConcepts) {
    const found = conceptGroup.some(concept => 
      allAnswers.toLowerCase().includes(concept.toLowerCase())
    );
    if (!found) {
      errors.push(`Missing required concept: one of [${conceptGroup.join(", ")}]`);
      totalScore -= 20;
    }
  }
  
  const normalizedScore = Math.max(0, Math.min(100, Math.round(totalScore / maxScore * 100)));
  
  return {
    passed: normalizedScore >= 50 && errors.length <= 4,
    score: normalizedScore,
    errors,
    details,
  };
}

// Helper functions
function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function validateStructure(answer: string, check: StructureCheck): boolean {
  switch (check.check) {
    case "contains_code":
      const codeBlockRegex = /```[\s\S]*?```|`[^`]+`/g;
      const codeBlocks = answer.match(codeBlockRegex) || [];
      const minLines = check.params?.minLines || 3;
      return codeBlocks.some(block => block.split("\n").length >= minLines);
      
    case "contains_list":
      const listItemRegex = /^[\s]*[-*•\d+\.]\s+/gm;
      const listItems = answer.match(listItemRegex) || [];
      const minItems = check.params?.minItems || 3;
      return listItems.length >= minItems;
      
    case "references_document":
      const docId = check.params?.documentId;
      return docId ? answer.toLowerCase().includes(docId.toLowerCase()) : true;
      
    case "min_sections":
      const sectionRegex = /^#+\s+|^\d+\.\s+|^[A-Z][^.!?]*:\s*$/gm;
      const sections = answer.match(sectionRegex) || [];
      const minSections = check.params?.minSections || 2;
      return sections.length >= minSections;
      
    default:
      return true;
  }
}

/**
 * Format challenge for agent consumption
 */
export function formatChallengeForAgent(challenge: CognitiveChallenge): string {
  let output = `# Cognitive Verification Challenge\n\n`;
  output += `**Challenge ID**: ${challenge.id}\n`;
  output += `**Type**: ${challenge.type}\n`;
  output += `**Estimated effort**: ~${challenge.estimatedInputTokens + challenge.estimatedOutputTokens} tokens\n\n`;
  output += `---\n\n`;
  output += `## Documents\n\n`;
  output += `You must analyze the following documents to answer the questions.\n\n`;
  
  for (const doc of challenge.documents) {
    output += `### ${doc.title}\n\n`;
    output += `${doc.content}\n\n`;
    output += `---\n\n`;
  }
  
  output += `## Questions\n\n`;
  output += `Answer ALL questions. Pay attention to word count requirements.\n\n`;
  
  for (const q of challenge.questions) {
    output += `### Question ${q.id}\n\n`;
    output += `${q.question}\n\n`;
    output += `**Word count**: ${q.minWords}-${q.maxWords} words\n`;
    output += `**Format**: ${q.expectedFormat}\n\n`;
  }
  
  output += `## Submission Format\n\n`;
  output += `Return a JSON object with the following structure:\n`;
  output += `\`\`\`json\n`;
  output += `{\n`;
  output += `  "answers": [\n`;
  output += `    { "questionId": "q1", "answer": "Your answer here..." },\n`;
  output += `    { "questionId": "q2", "answer": "Your answer here..." },\n`;
  output += `    ...\n`;
  output += `  ]\n`;
  output += `}\n`;
  output += `\`\`\`\n`;
  
  return output;
}
