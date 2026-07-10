import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema";
import path from "node:path";

/**
 * Database connection singleton.
 *
 * Reuses the same better-sqlite3 pragmas as the existing Express server:
 * - WAL journal mode (better concurrent reads)
 * - foreign_keys enforced
 * - busy_timeout 5s (wait instead of immediate SQLITE_BUSY)
 */

const dbPath = path.resolve(process.cwd(), "data.db");

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

export const db = drizzle(sqlite, { schema });
