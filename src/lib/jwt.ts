/**
 * JWT utilities for AgentProof proof tokens
 * Using Ed25519 for signing
 */

import * as jose from "jose";

// Types
export interface AgentProofPayload {
  version: string;
  challenge_id: string;
  difficulty: string;
  tasks_passed: string[];
  time_taken_ms: number;
  agent: {
    name: string;
    public_key: string;
    capabilities: string[];
  };
}

export interface ProofTokenPayload {
  iss: string;
  sub: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
  agp: AgentProofPayload;
}

// Singleton for keys
let privateKey: jose.KeyLike | null = null;
let publicKey: jose.KeyLike | null = null;

/**
 * Initialize JWT keys from environment
 */
export async function initializeKeys(): Promise<void> {
  const privateKeyB64 = process.env.JWT_PRIVATE_KEY;
  const publicKeyB64 = process.env.JWT_PUBLIC_KEY;

  if (!privateKeyB64 || !publicKeyB64) {
    console.error("❌ FATAL: JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be set in .env");
    console.error("");
    console.error("   To generate keys, run:");
    console.error("   openssl genpkey -algorithm ed25519 -out private.pem");
    console.error("   openssl pkey -in private.pem -pubout -out public.pem");
    console.error("   Then base64 encode and add to .env:");
    console.error("   JWT_PRIVATE_KEY=$(cat private.pem | base64)");
    console.error("   JWT_PUBLIC_KEY=$(cat public.pem | base64)");
    console.error("");
    process.exit(1);
  }

  try {
    const privateKeyPem = Buffer.from(privateKeyB64, "base64").toString("utf-8");
    const publicKeyPem = Buffer.from(publicKeyB64, "base64").toString("utf-8");
    
    privateKey = await jose.importPKCS8(privateKeyPem, "EdDSA");
    publicKey = await jose.importSPKI(publicKeyPem, "EdDSA");
    console.log("✅ JWT keys loaded");
  } catch (error) {
    console.error("❌ Failed to load JWT keys:", error);
    throw error;
  }
}

/**
 * Generate a new Ed25519 key pair
 */
export async function generateKeyPair(): Promise<jose.GenerateKeyPairResult> {
  return await jose.generateKeyPair("EdDSA", { crv: "Ed25519" });
}

/**
 * Sign a proof token
 */
export async function signProofToken(
  agentId: string,
  proofId: string,
  payload: AgentProofPayload,
  expiresInDays: number = 365
): Promise<string> {
  if (!privateKey) {
    throw new Error("JWT keys not initialized. Call initializeKeys() first.");
  }

  const baseUrl = process.env.BASE_URL || "https://agentdmv.com";
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInDays * 24 * 60 * 60;

  const token = await new jose.SignJWT({
    agp: payload,
  })
    .setProtectedHeader({ alg: "EdDSA", typ: "JWT" })
    .setIssuer(baseUrl)
    .setSubject(agentId)
    .setAudience("*")
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setJti(proofId)
    .sign(privateKey);

  return token;
}

/**
 * Verify a proof token
 */
export async function verifyProofToken(
  token: string
): Promise<{ valid: boolean; payload?: ProofTokenPayload; error?: string }> {
  if (!publicKey) {
    throw new Error("JWT keys not initialized. Call initializeKeys() first.");
  }

  try {
    const baseUrl = process.env.BASE_URL || "https://agentdmv.com";
    
    const { payload } = await jose.jwtVerify(token, publicKey, {
      issuer: baseUrl,
      audience: "*",
    });

    return {
      valid: true,
      payload: payload as unknown as ProofTokenPayload,
    };
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      return { valid: false, error: "Token expired" };
    }
    if (error instanceof jose.errors.JWTInvalid) {
      return { valid: false, error: "Invalid token" };
    }
    return { valid: false, error: "Token verification failed" };
  }
}

/**
 * Get the public key in JWK format (for /.well-known/jwks.json)
 */
export async function getPublicKeyJwk(): Promise<jose.JWK> {
  if (!publicKey) {
    throw new Error("JWT keys not initialized. Call initializeKeys() first.");
  }
  return await jose.exportJWK(publicKey);
}

/**
 * Decode a token without verification (for inspection)
 */
export function decodeToken(token: string): {
  header: jose.JWTHeaderParameters;
  payload: ProofTokenPayload;
} | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const header = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf-8")
    );
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );

    return { header, payload };
  } catch {
    return null;
  }
}
