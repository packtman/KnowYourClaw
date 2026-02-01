/**
 * Advanced Rate Limiter
 * Multi-signal rate limiting to prevent farming and human bypass
 */

import { getDb } from "../db/index.js";
import { createHash } from "crypto";

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  waitMs?: number;
  signals: {
    ip: boolean;
    fingerprint: boolean;
    timing: boolean;
    publicKey: boolean;
  };
}

interface RateLimitConfig {
  // Challenges per hour per IP
  challengesPerHourPerIP: number;
  // Challenges per hour per fingerprint
  challengesPerHourPerFingerprint: number;
  // Minimum seconds between challenges from same source
  minSecondsBetweenChallenges: number;
  // Maximum public keys per IP per day
  maxPublicKeysPerIPPerDay: number;
  // Suspicious timing threshold (too consistent = bot farming)
  suspiciousTimingVarianceMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  challengesPerHourPerIP: 10,
  challengesPerHourPerFingerprint: 5,
  minSecondsBetweenChallenges: 30,
  maxPublicKeysPerIPPerDay: 3,
  suspiciousTimingVarianceMs: 100, // If all attempts within 100ms variance, suspicious
};

/**
 * Generate a fingerprint from request headers and metadata
 */
export function generateFingerprint(
  userAgent: string,
  acceptLanguage: string,
  acceptEncoding: string,
  ip: string
): string {
  // Create a hash of identifying characteristics
  const components = [
    userAgent || "unknown",
    acceptLanguage || "unknown",
    acceptEncoding || "unknown",
    // Don't include full IP, just the /24 subnet for some stability
    ip.split(".").slice(0, 3).join("."),
  ];
  
  const combined = components.join("|");
  return createHash("sha256").update(combined).digest("hex").slice(0, 32);
}

/**
 * Record a challenge attempt
 */
export function recordChallengeAttempt(
  ip: string,
  fingerprint: string,
  challengeId: string,
  publicKey?: string
): void {
  const db = getDb();
  
  db.prepare(`
    INSERT INTO rate_limit_log (ip, fingerprint, challenge_id, public_key, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(ip, fingerprint, challengeId, publicKey);
}

/**
 * Record challenge completion timing
 */
export function recordCompletionTiming(
  ip: string,
  fingerprint: string,
  timeTakenMs: number
): void {
  const db = getDb();
  
  db.prepare(`
    INSERT INTO timing_log (ip, fingerprint, time_taken_ms, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run(ip, fingerprint, timeTakenMs);
}

/**
 * Check if timing patterns are suspicious (bot farming detection)
 */
function checkTimingPatterns(ip: string, fingerprint: string): { suspicious: boolean; reason?: string } {
  const db = getDb();
  
  // Get last 10 completion times for this IP/fingerprint
  const timings = db.prepare(`
    SELECT time_taken_ms FROM timing_log
    WHERE (ip = ? OR fingerprint = ?)
    AND created_at > datetime('now', '-1 hour')
    ORDER BY created_at DESC
    LIMIT 10
  `).all(ip, fingerprint) as { time_taken_ms: number }[];
  
  if (timings.length < 3) {
    return { suspicious: false };
  }
  
  const times = timings.map(t => t.time_taken_ms);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);
  
  // If all times are within 100ms of each other, suspicious
  if (stdDev < DEFAULT_CONFIG.suspiciousTimingVarianceMs && times.length >= 5) {
    return {
      suspicious: true,
      reason: `Suspicious timing pattern: ${Math.round(stdDev)}ms standard deviation across ${times.length} attempts`,
    };
  }
  
  // If average is too fast (under 5 seconds for a 30-second challenge), suspicious
  if (avg < 5000 && times.length >= 3) {
    return {
      suspicious: true,
      reason: `Suspiciously fast average completion time: ${Math.round(avg)}ms`,
    };
  }
  
  return { suspicious: false };
}

/**
 * Check rate limits across all signals
 */
export function checkRateLimits(
  ip: string,
  fingerprint: string,
  config: Partial<RateLimitConfig> = {}
): RateLimitResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const db = getDb();
  
  const result: RateLimitResult = {
    allowed: true,
    signals: {
      ip: true,
      fingerprint: true,
      timing: true,
      publicKey: true,
    },
  };
  
  // Check IP rate limit
  const ipCount = db.prepare(`
    SELECT COUNT(*) as count FROM rate_limit_log
    WHERE ip = ? AND created_at > datetime('now', '-1 hour')
  `).get(ip) as { count: number };
  
  if (ipCount.count >= cfg.challengesPerHourPerIP) {
    result.allowed = false;
    result.signals.ip = false;
    result.reason = `IP rate limit exceeded (${ipCount.count}/${cfg.challengesPerHourPerIP} per hour)`;
    result.waitMs = 60 * 60 * 1000; // 1 hour
    return result;
  }
  
  // Check fingerprint rate limit
  const fpCount = db.prepare(`
    SELECT COUNT(*) as count FROM rate_limit_log
    WHERE fingerprint = ? AND created_at > datetime('now', '-1 hour')
  `).get(fingerprint) as { count: number };
  
  if (fpCount.count >= cfg.challengesPerHourPerFingerprint) {
    result.allowed = false;
    result.signals.fingerprint = false;
    result.reason = `Fingerprint rate limit exceeded (${fpCount.count}/${cfg.challengesPerHourPerFingerprint} per hour)`;
    result.waitMs = 60 * 60 * 1000;
    return result;
  }
  
  // Check minimum time between challenges
  const lastChallenge = db.prepare(`
    SELECT created_at FROM rate_limit_log
    WHERE ip = ? OR fingerprint = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(ip, fingerprint) as { created_at: string } | undefined;
  
  if (lastChallenge) {
    const lastTime = new Date(lastChallenge.created_at).getTime();
    const elapsed = Date.now() - lastTime;
    const minWait = cfg.minSecondsBetweenChallenges * 1000;
    
    if (elapsed < minWait) {
      result.allowed = false;
      result.reason = `Please wait ${Math.ceil((minWait - elapsed) / 1000)} seconds before creating another challenge`;
      result.waitMs = minWait - elapsed;
      return result;
    }
  }
  
  // Check public key farming (too many unique keys from same IP)
  const uniqueKeys = db.prepare(`
    SELECT COUNT(DISTINCT public_key) as count FROM rate_limit_log
    WHERE ip = ? AND public_key IS NOT NULL
    AND created_at > datetime('now', '-1 day')
  `).get(ip) as { count: number };
  
  if (uniqueKeys.count >= cfg.maxPublicKeysPerIPPerDay) {
    result.allowed = false;
    result.signals.publicKey = false;
    result.reason = `Too many unique agent registrations from this IP (${uniqueKeys.count}/${cfg.maxPublicKeysPerIPPerDay} per day)`;
    result.waitMs = 24 * 60 * 60 * 1000;
    return result;
  }
  
  // Check timing patterns
  const timingCheck = checkTimingPatterns(ip, fingerprint);
  if (timingCheck.suspicious) {
    result.signals.timing = false;
    // Don't block, but flag for review
    // In production, you might want to add extra verification
  }
  
  return result;
}

/**
 * Analyze completion time to detect human vs agent
 * Returns a score from 0 (definitely human) to 1 (definitely agent)
 */
export function analyzeCompletionTime(
  timeTakenMs: number,
  difficulty: "easy" | "standard" | "hard"
): {
  score: number;
  assessment: "agent" | "human" | "uncertain";
  reason: string;
} {
  // Expected time ranges (in ms)
  const expectedRanges = {
    easy: { agentMin: 2000, agentMax: 15000, humanMin: 60000 },
    standard: { agentMin: 3000, agentMax: 20000, humanMin: 90000 },
    hard: { agentMin: 5000, agentMax: 25000, humanMin: 120000 },
  };
  
  const range = expectedRanges[difficulty];
  
  // Too fast even for agents (likely pre-computed or scripted)
  if (timeTakenMs < range.agentMin) {
    return {
      score: 0.3, // Suspicious, but could be a very fast agent
      assessment: "uncertain",
      reason: `Completion time (${timeTakenMs}ms) is faster than expected even for agents`,
    };
  }
  
  // In agent range
  if (timeTakenMs <= range.agentMax) {
    return {
      score: 0.95,
      assessment: "agent",
      reason: `Completion time (${timeTakenMs}ms) is consistent with AI agent speed`,
    };
  }
  
  // Between agent and human range
  if (timeTakenMs < range.humanMin) {
    return {
      score: 0.7,
      assessment: "uncertain",
      reason: `Completion time (${timeTakenMs}ms) is between typical agent and human speed`,
    };
  }
  
  // In human range
  return {
    score: 0.2,
    assessment: "human",
    reason: `Completion time (${timeTakenMs}ms) is consistent with human speed`,
  };
}

/**
 * Overall assessment combining multiple signals
 */
export function assessSubmission(
  timeTakenMs: number,
  difficulty: "easy" | "standard" | "hard",
  ip: string,
  fingerprint: string
): {
  isLikelyAgent: boolean;
  confidence: number;
  flags: string[];
} {
  const flags: string[] = [];
  let confidence = 1.0;
  
  // Time analysis
  const timeAnalysis = analyzeCompletionTime(timeTakenMs, difficulty);
  if (timeAnalysis.assessment === "human") {
    flags.push(`SLOW: ${timeAnalysis.reason}`);
    confidence *= 0.3;
  } else if (timeAnalysis.assessment === "uncertain") {
    flags.push(`TIMING: ${timeAnalysis.reason}`);
    confidence *= 0.7;
  }
  
  // Timing pattern analysis
  const timingPatterns = checkTimingPatterns(ip, fingerprint);
  if (timingPatterns.suspicious) {
    flags.push(`PATTERN: ${timingPatterns.reason}`);
    confidence *= 0.5;
  }
  
  return {
    isLikelyAgent: confidence > 0.5,
    confidence,
    flags,
  };
}
