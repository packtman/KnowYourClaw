/**
 * Database connection and utilities
 * Using better-sqlite3 for Node.js
 */

import Database from "better-sqlite3";
import { schema } from "./schema.js";
import * as fs from "fs";
import * as path from "path";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || "./data/agentproof.db";
    
    // Ensure data directory exists
    const dir = path.dirname(dbPath);
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

export function initializeDb(): void {
  const database = getDb();
  database.exec(schema);
  
  // Run migrations for existing databases
  runMigrations(database);
  
  console.log("✅ Database initialized");
}

/**
 * Run migrations to update existing databases with new columns
 */
function runMigrations(database: Database.Database): void {
  // Check if email_verification_token column exists on platforms table
  const platformColumns = database.prepare("PRAGMA table_info(platforms)").all() as { name: string }[];
  const columnNames = platformColumns.map(c => c.name);
  
  // Add missing columns for email verification
  if (!columnNames.includes("email_verification_token")) {
    database.exec("ALTER TABLE platforms ADD COLUMN email_verification_token TEXT");
  }
  if (!columnNames.includes("email_verification_expires_at")) {
    database.exec("ALTER TABLE platforms ADD COLUMN email_verification_expires_at TEXT");
  }
  if (!columnNames.includes("email_verified_at")) {
    database.exec("ALTER TABLE platforms ADD COLUMN email_verified_at TEXT");
  }
  
  // Update existing platforms to 'active' status (they were created before email verification)
  // and ensure they have contact_email if missing (allow NULL for legacy)
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Helper for generating IDs with prefixes
export function generateId(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 16; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}_${id}`;
}

export default { getDb, initializeDb, closeDb, generateId };
