/**
 * Database schema for AgentProof
 * Using Bun's built-in SQLite
 */

export const schema = `
-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  public_key TEXT UNIQUE,
  status TEXT DEFAULT 'verified' CHECK(status IN ('pending', 'verified', 'suspended', 'revoked')),
  capabilities TEXT, -- JSON array stored as text
  model_family TEXT,
  framework TEXT,
  claim_token TEXT,
  claim_expires_at TEXT,
  owner_id TEXT,
  verified_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Challenges table
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  agent_id TEXT,
  agent_name TEXT NOT NULL,
  agent_description TEXT,
  nonce TEXT NOT NULL,
  difficulty TEXT DEFAULT 'standard' CHECK(difficulty IN ('easy', 'standard', 'hard')),
  tasks TEXT NOT NULL, -- JSON
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'failed', 'expired')),
  started_at TEXT,
  completed_at TEXT,
  expires_at TEXT NOT NULL,
  time_taken_ms INTEGER,
  tasks_completed INTEGER DEFAULT 0,
  tasks_failed INTEGER DEFAULT 0,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Challenge progress (for tool-use multi-step)
CREATE TABLE IF NOT EXISTS challenge_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id TEXT NOT NULL,
  step INTEGER NOT NULL,
  expected_value TEXT,
  received_value TEXT,
  completed_at TEXT,
  UNIQUE(challenge_id, step),
  FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);

-- Proofs table
CREATE TABLE IF NOT EXISTS proofs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  token TEXT NOT NULL,
  issued_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'revoked')),
  revoked_at TEXT,
  revoke_reason TEXT,
  times_verified INTEGER DEFAULT 0,
  last_verified_at TEXT,
  last_verified_by TEXT,
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);

-- Platforms table
CREATE TABLE IF NOT EXISTS platforms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  contact_email TEXT,
  api_key_hash TEXT NOT NULL UNIQUE,
  tier TEXT DEFAULT 'free' CHECK(tier IN ('free', 'platform', 'enterprise')),
  rate_limit INTEGER DEFAULT 100,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended')),
  verifications_count INTEGER DEFAULT 0,
  verifications_this_month INTEGER DEFAULT 0,
  last_verification_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Owners table (for claimed agents)
CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK(provider IN ('twitter', 'github', 'email')),
  provider_id TEXT NOT NULL,
  handle TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(provider, provider_id)
);

-- Agent bios (for uniqueness checking)
CREATE TABLE IF NOT EXISTS agent_bios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  bio TEXT NOT NULL,
  bio_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- Rate limiting log
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  challenge_id TEXT,
  public_key TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Timing log for completion analysis
CREATE TABLE IF NOT EXISTS timing_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  time_taken_ms INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Dynamic challenge storage (for validation after submission)
CREATE TABLE IF NOT EXISTS dynamic_challenges (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  language TEXT NOT NULL,
  code TEXT NOT NULL,
  answer_line INTEGER NOT NULL,
  answer_issue TEXT NOT NULL,
  answer_fix TEXT NOT NULL,
  bug_type TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);

-- Speed challenge tokens (for parallel task verification)
CREATE TABLE IF NOT EXISTS speed_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id TEXT NOT NULL,
  token_a TEXT NOT NULL,
  token_b TEXT NOT NULL,
  token_c TEXT NOT NULL,
  fetch_a_at TEXT,
  fetch_b_at TEXT,
  fetch_c_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(challenge_id),
  FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);

-- OAuth states (for CSRF protection and PKCE)
CREATE TABLE IF NOT EXISTS oauth_states (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK(provider IN ('twitter', 'github')),
  claim_token TEXT NOT NULL,
  code_verifier TEXT, -- For Twitter PKCE
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_expires_at ON challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_agents_public_key ON agents(public_key);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_proofs_agent_id ON proofs(agent_id);
CREATE INDEX IF NOT EXISTS idx_proofs_status ON proofs(status);
CREATE INDEX IF NOT EXISTS idx_platforms_api_key_hash ON platforms(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_rate_limit_ip ON rate_limit_log(ip);
CREATE INDEX IF NOT EXISTS idx_rate_limit_fingerprint ON rate_limit_log(fingerprint);
CREATE INDEX IF NOT EXISTS idx_rate_limit_created ON rate_limit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_timing_ip ON timing_log(ip);
CREATE INDEX IF NOT EXISTS idx_timing_fingerprint ON timing_log(fingerprint);
CREATE INDEX IF NOT EXISTS idx_oauth_states_claim_token ON oauth_states(claim_token);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);
`;

export default schema;
