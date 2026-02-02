/**
 * Database connection and utilities
 * Using PostgreSQL with pg
 */

import pg from "pg";
import { schema } from "./schema.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    // Support both DATABASE_URL (DO App Platform format) and individual vars
    const connectionString = process.env.DATABASE_URL;
    
    // SSL config for DO managed databases (they use self-signed certs)
    const sslConfig = process.env.NODE_ENV === "production" 
      ? { rejectUnauthorized: false }
      : false;
    
    if (connectionString) {
      // Remove any existing sslmode from connection string to avoid conflicts
      // and use our explicit SSL config instead
      const cleanConnectionString = connectionString.replace(/[?&]sslmode=[^&]*/g, '');
      
      pool = new Pool({
        connectionString: cleanConnectionString,
        ssl: sslConfig,
      });
    } else {
      // Fallback to individual environment variables
      pool = new Pool({
        host: process.env.PGHOST || "localhost",
        port: parseInt(process.env.PGPORT || "5432", 10),
        database: process.env.PGDATABASE || "agentproof",
        user: process.env.PGUSER || "postgres",
        password: process.env.PGPASSWORD || "",
        ssl: sslConfig,
      });
    }
  }
  return pool;
}

/**
 * Execute a query and return all rows
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows;
}

/**
 * Execute a query and return the first row
 */
export async function queryOne<T = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const result = await getPool().query(text, params);
  return result.rows[0] || null;
}

/**
 * Execute a query (for INSERT/UPDATE/DELETE)
 */
export async function execute(
  text: string,
  params?: any[]
): Promise<{ rowCount: number }> {
  const result = await getPool().query(text, params);
  return { rowCount: result.rowCount || 0 };
}

export async function initializeDb(): Promise<void> {
  const p = getPool();
  
  // Split schema into individual statements (PostgreSQL doesn't support multi-statement exec like SQLite)
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      await p.query(statement);
    } catch (error: any) {
      // Ignore "already exists" errors for CREATE INDEX IF NOT EXISTS
      // PostgreSQL may throw errors even with IF NOT EXISTS in some cases
      if (!error.message.includes("already exists")) {
        console.error(`Schema error: ${error.message}`);
        throw error;
      }
    }
  }

  console.log("✅ Database initialized");
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
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

// Legacy export for compatibility - but should migrate to async functions
export function getDb() {
  return {
    query: getPool().query.bind(getPool()),
  };
}

export default { getPool, query, queryOne, execute, initializeDb, closeDb, generateId };
