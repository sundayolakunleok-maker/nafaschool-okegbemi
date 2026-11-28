import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "@neondatabase/serverless";

const helpersDir = dirname(fileURLToPath(import.meta.url));

/**
 * Returns the dedicated test database URL, or undefined when integration
 * tests should be skipped. Production DATABASE_URL is never used.
 */
export function getTestDatabaseUrl(): string | undefined {
  const testUrl = process.env.TEST_DATABASE_URL;

  if (!testUrl) {
    return undefined;
  }

  if (process.env.DATABASE_URL && testUrl === process.env.DATABASE_URL) {
    throw new Error(
      "TEST_DATABASE_URL must not be the same as DATABASE_URL. " +
        "Use a dedicated test database or Neon branch."
    );
  }

  return testUrl;
}

export async function createTestPool(connectionString: string): Promise<Pool> {
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

  const schemaSql = readFileSync(join(helpersDir, "schema.sql"), "utf8");

  try {
    await pool.query(schemaSql);
    return pool;
  } catch (error) {
    await pool.end();
    throw error;
  }
}

export async function truncateAll(pool: Pool): Promise<void> {
  await pool.query(
    "TRUNCATE TABLE payments, pupils, guardians, fee_schedules RESTART IDENTITY CASCADE"
  );
}

export interface SeededPupil {
  guardianId: number;
  pupilId: number;
}

export interface SeededFeeSchedule {
  id: number;
  term: string;
  amount: number;
  installmentsAllowed: number;
}

export async function seedPupil(pool: Pool): Promise<SeededPupil> {
  const guardian = await pool.query<{ id: number }>(
    "INSERT INTO guardians (name, phone) VALUES ($1, $2) RETURNING id",
    ["Test Guardian", "+221700000000"]
  );

  const guardianId = guardian.rows[0].id;

  const pupil = await pool.query<{ id: number }>(
    "INSERT INTO pupils (name, class, guardian_id) VALUES ($1, $2, $3) RETURNING id",
    ["Test Pupil", "CM2", guardianId]
  );

  return { guardianId, pupilId: pupil.rows[0].id };
}

export async function seedFeeSchedule(
  pool: Pool,
  overrides: {
    term?: string;
    amount?: number;
    installmentsAllowed?: number;
  } = {}
): Promise<SeededFeeSchedule> {
  const result = await pool.query<{
    id: number;
    term: string;
    amount: number;
    installments_allowed: number;
  }>(
    `INSERT INTO fee_schedules (term, amount, installments_allowed)
     VALUES ($1, $2, $3)
     RETURNING id, term, amount, installments_allowed`,
    [
      overrides.term ?? "2026-2027 First Term",
      overrides.amount ?? 90_000,
      overrides.installmentsAllowed ?? 3,
    ]
  );

  const row = result.rows[0];

  return {
    id: row.id,
    term: row.term,
    amount: row.amount,
    installmentsAllowed: row.installments_allowed,
  };
}
