import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

// Auto-create data directory if missing
mkdirSync("./data", { recursive: true });

const sqlite = new Database("./data/blog.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite);
