/**
 * Database connection and utilities
 * Using better-sqlite3 for Node.js
 */

import Database from "better-sqlite3";
import { schema } from "./schema.ts";
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
  console.log("✅ Database initialized");
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
