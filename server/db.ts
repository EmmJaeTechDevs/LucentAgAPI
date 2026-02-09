import pkg from "pg";
const { Pool } = pkg;

import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

// Mask DB password before logging
function maskDbUrl(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = "********";
    return u.toString();
  } catch {
    return "[Invalid DATABASE_URL]";
  }
}

const rawUrl = process.env.DATABASE_URL;
console.log("[DB] Connecting using:", maskDbUrl(rawUrl));

export const pool = new Pool({
  connectionString: rawUrl,
  ssl: {
    rejectUnauthorized: false, // Required for CloudClusters SSL chain issues
  },
});

export const db = drizzle(pool, { schema });
