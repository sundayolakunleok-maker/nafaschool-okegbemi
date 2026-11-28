import "dotenv/config";
import {
  neon,
  Pool,
  type NeonQueryFunction,
} from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

export type Sql = NeonQueryFunction<false, false>;

// HTTP client, kept for the existing pupil registration endpoint.
export const sql = neon(connectionString);

// WebSocket pool, used where interactive transactions are required.
export const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (error: Error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});
